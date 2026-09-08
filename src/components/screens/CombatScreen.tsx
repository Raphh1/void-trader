import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import type { CombatAction } from '../../engine/combat'
import type { CombatLogEntry } from '../../types'
import { HackSequence } from '../minigames/HackSequence'
import { StopTheBar } from '../minigames/StopTheBar'
import { QuickDraw } from '../minigames/QuickDraw'
import { ReactFlash } from '../minigames/ReactFlash'
import { getSubBossMinigame } from '../../data/subBosses'
import type { SubBossMinigameKind } from '../../data/subBosses'
import { useFloatingNumbers, FloatingNumbersLayer } from '../ui/FloatingNumber'
import { playHit, playCrit, playHeal, playFlee, playClick, playVictory, playDeath, playFinisher } from '../../engine/sfx'
import { translateGood, translateWeaponName, translateArmorName, translateEnemyName } from '../../engine/goodsI18n'

type NegotiateCondition = {
  id: string
  label: string
  desc: string
  available: boolean
  whyNot?: string
  accept: () => void
}

const ANIM_DELAY_MS = 850

const INTENT_CLASS: Record<string, string> = {
  normal: 'intent--normal', heavy: 'intent--heavy', charge: 'intent--charge',
  disarm: 'intent--disarm', defend: 'intent--defend',
}

export function CombatScreen() {
  const { t } = useTranslation('combatScreen')
  const gs             = useGameStore(s => s.gs!)
  const submit         = useGameStore(s => s.submitCombatAction)
  const resolveVictory = useGameStore(s => s.resolveVictory)
  const resolveDeath   = useGameStore(s => s.resolveDeath)
  const victoryPending = useGameStore(s => s.combatVictoryPending)
  const deathPending   = useGameStore(s => s.playerDeathPending)
  const enemy  = gs.combatEnemy!
  const cs     = gs.combatState!
  const logRef = useRef<HTMLDivElement>(null)

  const patch = useGameStore(s => s.patch)

  const [visibleLog, setVisibleLog]           = useState<CombatLogEntry[]>([])
  const [queue, setQueue]                     = useState<CombatLogEntry[]>([])
  const [frozenHp, setFrozenHp]               = useState<{ player: number; enemy: number } | null>(null)
  const [hackOpen, setHackOpen]               = useState(false)
  // Coup ciblé sous-boss : mini-jeu en attente + l'action à résoudre à sa fin
  const [sbGame, setSbGame]                   = useState<{ kind: SubBossMinigameKind; difficulty: 1 | 2 | 3; action: CombatAction } | null>(null)
  const [negotiateConditions, setNegotiateConditions] = useState<NegotiateCondition[] | null>(null)
  const [enemyDamaged, setEnemyDamaged]       = useState(false)
  const [playerDamaged, setPlayerDamaged]     = useState(false)
  const [critShake, setCritShake]             = useState(false)
  const prevEnemyHp  = useRef(cs.enemyHp)
  const prevPlayerHp = useRef(gs.playerHp)
  const isAnimating = queue.length > 0

  const { containerRef: playerRef, entries: playerFloats, fire: firePlayer } = useFloatingNumbers()
  const { containerRef: enemyRef,  entries: enemyFloats,  fire: fireEnemy  } = useFloatingNumbers()

  // Pause mort : montrer l'ennemi à 0 PV puis transitionner
  useEffect(() => {
    if (!victoryPending) return
    const t = setTimeout(() => resolveVictory(), 1400)
    return () => clearTimeout(t)
  }, [victoryPending])

  // Pause mort joueur : laisser le temps de lire "Vous êtes mort." avant le game over
  useEffect(() => {
    if (!deathPending) return
    const t = setTimeout(() => resolveDeath(), 2200)
    return () => clearTimeout(t)
  }, [deathPending])

  // Chaque nouveau tour → on enfile les entrées
  useEffect(() => {
    if (cs.log.length > 0) {
      setQueue(prev => [...prev, ...cs.log])
    }
  }, [cs.log])

  // Dépiler une entrée toutes les ANIM_DELAY_MS ms
  useEffect(() => {
    if (queue.length === 0) return
    const t = setTimeout(() => {
      setVisibleLog(prev => [...prev, queue[0]])
      setQueue(prev => prev.slice(1))
    }, ANIM_DELAY_MS)
    return () => clearTimeout(t)
  }, [queue])

  // Libérer les HP gelés quand l'animation se termine
  useEffect(() => {
    if (queue.length === 0 && frozenHp !== null) {
      setFrozenHp(null)
    }
  }, [queue.length])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleLog])

  useEffect(() => {
    if (cs.log.some(e => e.type === 'crit')) {
      setCritShake(true)
      const t = setTimeout(() => setCritShake(false), 500)
      return () => clearTimeout(t)
    }
  }, [cs.log])

  // Shake + SFX + chiffres flottants quand les HP changent
  useEffect(() => {
    const delta = cs.enemyHp - prevEnemyHp.current
    if (delta < 0) {
      setEnemyDamaged(true)
      const t = setTimeout(() => setEnemyDamaged(false), 380)
      fireEnemy(`-${Math.abs(delta)}`, delta < -30 ? 'var(--red)' : 'var(--orange)')
      if (delta < -30) playCrit(); else playHit()
      prevEnemyHp.current = cs.enemyHp
      return () => clearTimeout(t)
    }
    prevEnemyHp.current = cs.enemyHp
  }, [cs.enemyHp])

  useEffect(() => {
    const delta = gs.playerHp - prevPlayerHp.current
    if (delta < 0) {
      setPlayerDamaged(true)
      const t = setTimeout(() => setPlayerDamaged(false), 380)
      firePlayer(`-${Math.abs(delta)}`, 'var(--red)')
      prevPlayerHp.current = gs.playerHp
      return () => clearTimeout(t)
    } else if (delta > 0) {
      firePlayer(`+${delta}`, 'var(--green)')
      playHeal()
    }
    prevPlayerHp.current = gs.playerHp
  }, [gs.playerHp])

  useEffect(() => {
    if (victoryPending) playVictory()
  }, [victoryPending])

  useEffect(() => {
    if (deathPending) playDeath()
  }, [deathPending])

  const shownPlayerHp = frozenHp?.player ?? gs.playerHp
  const shownEnemyHp  = frozenHp?.enemy  ?? cs.enemyHp
  const hpPct  = (shownEnemyHp  / enemy.maxHp)    * 100
  const phPct  = (shownPlayerHp / gs.playerMaxHp) * 100
  const staPct = (gs.stamina    / gs.maxStamina)  * 100

  // Actions qui portent un coup → soumises au mini-jeu de coup ciblé vs sous-boss
  const DAMAGE_ACTIONS = new Set(['attack', 'offensive', 'defensive', 'dodge', 'focused', 'special', 'finisher'])

  function act(action: CombatAction) {
    if (isAnimating || victoryPending) return
    // Sous-boss : chaque coup passe d'abord par un mini-jeu qui module les dégâts.
    // On saute si l'action porte déjà un precisionMult (rebond post-mini-jeu).
    if (enemy.isSubBoss && DAMAGE_ACTIONS.has(action.type) && !('precisionMult' in action)) {
      const mg = getSubBossMinigame(enemy.name)
      if (mg) { setSbGame({ ...mg, action }); return }
    }
    setFrozenHp({ player: gs.playerHp, enemy: cs.enemyHp })
    playClick()
    submit(action)
  }

  // Fin du mini-jeu de coup ciblé : applique le multiplicateur puis résout l'action.
  function resolveSubBossGame(mult: number) {
    if (!sbGame) return
    const action = { ...sbGame.action, precisionMult: mult }
    setSbGame(null)
    setFrozenHp({ player: gs.playerHp, enemy: cs.enemyHp })
    playClick()
    submit(action)
  }

  function flee() {
    playFlee()
    act({ type: 'flee' })
  }

  function generateNegotiateConditions(): NegotiateCondition[] {
    const pool: NegotiateCondition[] = []
    const demand = (Math.floor(Math.random() * 8) + 3) * 100

    pool.push({
      id: 'credits',
      label: t('negotiate.payLabel', { amount: demand.toLocaleString() }),
      desc: t('negotiate.payDesc'),
      available: gs.credits >= demand,
      whyNot: gs.credits < demand ? t('negotiate.payWhyNot', { missing: (demand - gs.credits).toLocaleString() }) : undefined,
      accept: () => { patch({ credits: gs.credits - demand }); act({ type: 'negotiate-accept' }); setNegotiateConditions(null) },
    })

    if (Object.keys(gs.cargo).length > 0) {
      const cargoLabel = Object.entries(gs.cargo).map(([k, v]) => `${translateGood(k)} ×${v}`).join(', ')
      pool.push({
        id: 'cargo',
        label: t('negotiate.cargoLabel'),
        desc: t('negotiate.cargoDesc', { cargo: cargoLabel }),
        available: true,
        accept: () => { patch({ cargo: {} }); act({ type: 'negotiate-accept' }); setNegotiateConditions(null) },
      })
    }

    pool.push({
      id: 'favor',
      label: t('negotiate.favorLabel'),
      desc: t('negotiate.favorDesc'),
      available: true,
      accept: () => { patch({ reputation: gs.reputation - 5 }); act({ type: 'negotiate-accept' }); setNegotiateConditions(null) },
    })

    if (gs.equippedWeapon) {
      const w = gs.equippedWeapon
      pool.push({
        id: 'weapon',
        label: t('negotiate.weaponLabel', { weapon: translateWeaponName(w.name) }),
        desc: t('negotiate.weaponDesc'),
        available: true,
        accept: () => {
          patch({ weapons: gs.weapons.filter(x => x !== w), equippedWeapon: null })
          act({ type: 'negotiate-accept' })
          setNegotiateConditions(null)
        },
      })
    }

    if (gs.equippedArmor) {
      pool.push({
        id: 'armor',
        label: t('negotiate.armorLabel'),
        desc: t('negotiate.armorDesc'),
        available: true,
        accept: () => { patch({ equippedArmor: null }); act({ type: 'negotiate-accept' }); setNegotiateConditions(null) },
      })
    }

    pool.push({
      id: 'rep',
      label: t('negotiate.repLabel'),
      desc: t('negotiate.repDesc'),
      available: true,
      accept: () => { patch({ reputation: gs.reputation - 15 }); act({ type: 'negotiate-accept' }); setNegotiateConditions(null) },
    })

    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(pool.length, Math.floor(Math.random() * 2) + 2))
  }

  const weapon = gs.equippedWeapon
  const hasSpecial = weapon && !['none','silence','armorPierce'].includes(weapon.effect)

  function dmgRange(mult: number): string {
    const classMult = gs.class.combatAttackMult ?? 1.0
    let min: number, max: number
    if (weapon) {
      const aff = (weapon.affinities as Record<string, number>)[gs.class.name] ?? 1.0
      const ap = weapon.effect === 'armorPierce' ? 1.3 : 1.0
      min = Math.floor(weapon.damageMin * aff * ap * classMult * mult)
      max = Math.floor(weapon.damageMax * aff * ap * classMult * mult)
    } else {
      let bMin = 5, bMax = 18
      if (gs.class.name === 'Seigneur de guerre') { bMin += 8; bMax += 20 }
      else if (gs.class.name === 'Vétéran') { bMin += 5; bMax += 12 }
      else if (gs.class.name === 'Vagabond') { bMin = Math.max(1, bMin - 5) }
      min = Math.floor(bMin * classMult * mult)
      max = Math.floor(bMax * classMult * mult)
    }
    return `${min}–${max}`
  }

  function enemyDmgRange(stanceMult = 1.0): string {
    const armor = gs.equippedArmor
    const defMult = gs.class.combatDefenseMult ?? 1.0
    const reductPct = armor ? armor.defense / 100 : 0
    const min = Math.max(0, Math.floor(enemy.damageMin * defMult * stanceMult * (1 - reductPct)))
    const max = Math.max(0, Math.floor(enemy.damageMax * defMult * stanceMult * (1 - reductPct)))
    return `${min}–${max}`
  }

  return (
    <div className={`layout ${critShake ? 'crit-shake' : ''}`}>
      {/* Overlay mort ennemi */}
      {victoryPending && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease-in' }}>
            <div style={{ fontSize: '11px', letterSpacing: '6px', color: 'var(--gold)', textShadow: '0 0 20px var(--gold)', marginBottom: '8px' }}>{t('victoryTitle')}</div>
            <div className="t-xs t-dim">{t('defeated', { enemy: gs.combatEnemy ? translateEnemyName(gs.combatEnemy.name) : undefined })}</div>
          </div>
        </div>
      )}
      {negotiateConditions && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ maxWidth: '600px', width: '100%' }} className="col gap4">
            <div className="t-xs t-dim t-center">{t('negotiate.modalTitle')}</div>
            <div className="px-box" style={{ borderColor: 'var(--cyan)' }}>
              <div className="t-sm t-bright mb4">{t('negotiate.conditionsTitle', { enemy: translateEnemyName(enemy.name) })}</div>
              <div className="t-xs t-dim mb8" style={{ fontStyle: 'italic', lineHeight: '2' }}>
                {t('negotiate.quote')}
              </div>
              <div className="col gap4">
                {negotiateConditions.map(c => (
                  <button key={c.id} className="px-btn" disabled={!c.available}
                    style={{ borderColor: c.available ? 'var(--cyan)' : undefined, textAlign: 'left' }}
                    onClick={() => c.accept()}>
                    <div className="t-xs t-bright mb4">{c.label}</div>
                    <div className="t-xs t-dim" style={{ lineHeight: '1.8' }}>{c.desc}</div>
                    {!c.available && c.whyNot && <div className="t-xs t-red mt2">{c.whyNot}</div>}
                  </button>
                ))}
              </div>
            </div>
            <button className="px-btn t-dim" onClick={() => setNegotiateConditions(null)}>
              {t('negotiate.refuse')}
            </button>
          </div>
        </div>
      )}
      {hackOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '600px', width: '100%', padding: '16px' }}>
            <HackSequence difficulty={2} onResult={(success) => {
              setHackOpen(false)
              if (success) {
                act({ type: 'class' })
              } else {
                // Hack raté : attaque normale
                act({ type: 'attack' })
              }
            }} />
          </div>
        </div>
      )}

      {sbGame && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ maxWidth: '600px', width: '100%' }}>
            {sbGame.kind === 'stop' && (
              <StopTheBar
                difficulty={sbGame.difficulty}
                label={t('targetedHit', { enemy: translateEnemyName(enemy.name) })}
                onResult={(r) => resolveSubBossGame(r === 'perfect' ? 1.8 : r === 'good' ? 1.15 : 0.4)}
              />
            )}
            {sbGame.kind === 'hack' && (
              <HackSequence
                difficulty={sbGame.difficulty}
                onResult={(success) => resolveSubBossGame(success ? 1.6 : 0.5)}
              />
            )}
            {sbGame.kind === 'draw' && (
              <QuickDraw
                difficulty={sbGame.difficulty}
                label={t('targetedHit', { enemy: translateEnemyName(enemy.name) })}
                onResult={(mult) => resolveSubBossGame(mult)}
              />
            )}
            {sbGame.kind === 'react' && (
              <ReactFlash
                difficulty={sbGame.difficulty}
                label={t('targetedHit', { enemy: translateEnemyName(enemy.name) })}
                onResult={(mult) => resolveSubBossGame(mult)}
              />
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="t-center t-dim t-xs">{t('header')}</div>

      {/* Enemy + Player status */}
      <div className="grid2">
        {/* Player */}
        <div className="px-box" ref={playerRef} style={{ position: 'relative', overflow: 'visible' }}>
          <FloatingNumbersLayer entries={playerFloats} />
          <div className="t-sm t-bright mb8">{t('you')}</div>
          <div className="t-xs t-dim mb4">{t('hp')}</div>
          <div className={`bar bar--hp ${phPct < 30 ? 'low' : phPct < 60 ? 'medium' : ''} ${playerDamaged ? 'hp-damaged' : ''}`}>
            <div className="bar__fill" style={{ width: `${phPct}%` }} />
          </div>
          <div className="t-xs mt4" style={{ color: phPct < 30 ? 'var(--red)' : phPct < 60 ? 'var(--orange)' : 'var(--green)' }}>
            {shownPlayerHp}/{gs.playerMaxHp}
          </div>

          <div className="t-xs t-dim mb4 mt8">{t('stamina')}</div>
          <div className="bar bar--sta">
            <div className="bar__fill" style={{ width: `${staPct}%` }} />
          </div>
          <div className="t-xs t-cyan mt4">{gs.stamina}/{gs.maxStamina}</div>

          <div className="mt8 t-xs t-dim">
            {weapon ? <span className="t-orange">{translateWeaponName(weapon.name)}</span> : t('bareHands')}
            {gs.equippedArmor && <span className="t-blue" style={{ color: 'var(--blue)' }}> · {translateArmorName(gs.equippedArmor.name)}</span>}
          </div>

          <div className="momentum mt8">
            <span className="t-xs t-dim">{t('momentum')}</span>
            {[0,1,2].map(i => (
              <div key={i} className={`momentum__pip ${cs.momentum > i ? `momentum__pip--${cs.momentum}` : ''}`} />
            ))}
            {cs.momentum >= 3 && <span className="t-gold t-xs blink">{t('finisherTag')}</span>}
          </div>
        </div>

        {/* Enemy */}
        <div className="px-box px-box--hi" ref={enemyRef} style={{ position: 'relative', overflow: 'visible' }}>
          <FloatingNumbersLayer entries={enemyFloats} />
          <div className="t-sm t-red mb4">{translateEnemyName(enemy.name)}</div>
          <div className="t-xs t-dim mb8">{enemy.description}</div>

          <div className="t-xs t-dim mb4">{t('enemyHp')}</div>
          <div className={`bar bar--hp ${hpPct < 30 ? 'low' : hpPct < 60 ? 'medium' : ''} ${enemyDamaged ? 'hp-damaged' : ''}`}>
            <div className="bar__fill" style={{ width: `${hpPct}%` }} />
          </div>
          <div className="t-xs mt4" style={{ color: hpPct < 30 ? 'var(--red)' : hpPct < 60 ? 'var(--orange)' : 'var(--green)' }}>
            {shownEnemyHp}/{enemy.maxHp}
          </div>

          <div className={`t-xs mt8 ${INTENT_CLASS[cs.currentIntent]}`}>
            {t('intentLabel', { label: t(`intent.${cs.currentIntent}`) })}
          </div>

          {cs.enemyStunTurns > 0    && <div className="t-xs t-yellow mt4">{t('stunned', { turns: cs.enemyStunTurns, plural: cs.enemyStunTurns > 1 ? 's' : '' })}</div>}
          {cs.enemyBlinded           && <div className="t-xs t-yellow mt4">{t('blinded')}</div>}
          {cs.enemyBurnTurns > 0    && <div className="t-xs t-orange mt4" style={{ color: 'var(--orange)' }}>{t('burning', { turns: cs.enemyBurnTurns })}</div>}
          {cs.enemyWeaponDisabledTurns > 0 && <div className="t-xs t-cyan mt4">{t('hacked', { turns: cs.enemyWeaponDisabledTurns })}</div>}
          {cs.enemyCharging          && <div className="t-xs t-red mt4 blink">{t('charging')}</div>}
        </div>
      </div>

      {/* Combat log */}
      <div className="combat-log-wrap">
        <div className="px-box px-box--dark combat-log" ref={logRef}>
          {visibleLog.length === 0
            ? <div className="log-entry log-entry--info">{t('combatStart')}</div>
            : visibleLog.map(entry => (
                <div key={entry.id} className={`log-entry log-entry--${entry.type}`}>
                  {entry.text}
                </div>
              ))
          }
          {isAnimating && <div className="log-entry log-entry--info blink">▌</div>}
        </div>
      </div>

      {/* Actions */}
      <div className="px-box">
        <div className="t-xs t-dim mb8">{isAnimating ? '...' : t('actionLabel')}</div>
        {enemy.isSubBoss && getSubBossMinigame(enemy.name) && !isAnimating && (
          <div className="t-xs t-cyan mb8" style={{ opacity: 0.8 }}>
            {t('subBossHint')}
          </div>
        )}
        <div className="col gap4">
          {cs.momentum >= 3 && (
            <button className="px-btn px-btn--primary momentum-pulse" disabled={isAnimating} onClick={() => { playFinisher(); act({ type: 'finisher' }) }}>
              {t('actions.finisher')}<span className="t-gold">{dmgRange(3)}{t('actions.finisherSuffix')}</span>
            </button>
          )}

          <button className="px-btn" disabled={isAnimating} onClick={() => act({ type: 'attack' })}>
            {weapon ? t('actions.attackWeapon', { weapon: translateWeaponName(weapon.name) }) : t('bareHandsAction')}
            <span className="t-dim" style={{ marginLeft: '8px' }}><span className="t-bright">{dmgRange(1)}</span>{t('actions.dmgSuffix')}</span>
          </button>

          {gs.stamina >= 30 && (
            <button className="px-btn" disabled={isAnimating} onClick={() => act({ type: 'offensive' })}>
              {t('actions.offensive')}<span className="t-bright">{dmgRange(1.3)}{t('actions.offensiveDmgSuffix')}</span>
              <span className="t-dim" style={{ marginLeft: '6px' }}>{t('actions.offensiveSuffix')}</span>
            </button>
          )}
          {gs.stamina >= 15 && (
            <button className="px-btn" disabled={isAnimating} onClick={() => act({ type: 'defensive' })}>
              {t('actions.defensive')}<span className="t-bright">{dmgRange(1)}{t('actions.defensiveDmgSuffix')}</span>
              <span className="t-dim" style={{ marginLeft: '6px' }}>{t('actions.defensiveSuffix')}<span className="t-green">{enemyDmgRange(0.70)}</span>{t('actions.defensiveSuffix2')}</span>
            </button>
          )}
          {gs.stamina >= 10 && (
            <button className="px-btn" disabled={isAnimating} onClick={() => act({ type: 'dodge' })}>
              {t('actions.dodge')}<span className="t-bright">{dmgRange(0.6)}{t('actions.dodgeDmgSuffix')}</span>
              <span className="t-dim" style={{ marginLeft: '6px' }}>{t('actions.dodgeSuffix')}</span>
            </button>
          )}
          {gs.stamina >= 50 && (
            <button className="px-btn" disabled={isAnimating} onClick={() => act({ type: 'focused' })}>
              {t('actions.focused')}<span className="t-bright">{dmgRange(1.6)}{t('actions.focusedDmgSuffix')}</span>
              <span className="t-dim" style={{ marginLeft: '6px' }}>{t('actions.focusedSuffix')}</span>
            </button>
          )}
          {gs.moralTags.includes('cannibal') && gs.stamina >= 25 && (
            <button className="px-btn" disabled={isAnimating} onClick={() => act({ type: 'bite' })}
              style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
              {t('actions.bite')}
              {(gs.folieLevel ?? 0) >= 50 ? t('actions.biteMadness', { level: gs.folieLevel }) : ''}
            </button>
          )}
          {hasSpecial && gs.stamina >= 35 && (
            <button className="px-btn" style={{ color: 'var(--purple)' }} disabled={isAnimating} onClick={() => act({ type: 'special' })}>
              {t('actions.special', { desc: weapon!.effectDesc, chance: weapon!.effectChance })}
            </button>
          )}

          <hr className="divider" />

          {!cs.classActionUsed && (
            <ClassAction gs={gs} onAct={(a) => {
              if (a.type === 'class' && gs.class.name === 'Hackeur') {
                if (isAnimating) return
                setHackOpen(true)
              } else {
                act(a)
              }
            }} disabled={isAnimating} />
          )}

          {gs.reputation > 0 && (
            <button className="px-btn t-dim" disabled={isAnimating} onClick={() => act({ type: 'intimidate' })}>
              {t('actions.intimidate', { chance: Math.min(75, Math.floor(gs.reputation / 5)) })}
            </button>
          )}
          {enemy.isBoss
            ? (
              <button className="px-btn t-dim" disabled style={{ opacity: 0.35 }}>
                {t('actions.negotiateBoss')}
              </button>
            )
            : (() => {
              const chance = Math.min(70, 20 + Math.max(0, Math.floor(gs.reputation / 8)))
              return (
                <button className="px-btn t-dim" disabled={isAnimating} onClick={() => {
                  if (Math.random() * 100 < chance) {
                    setNegotiateConditions(generateNegotiateConditions())
                  } else {
                    act({ type: 'negotiate' })
                  }
                }}>
                  {t('actions.negotiate', { chance })}
                </button>
              )
            })()
          }
          <button className="px-btn t-dim" disabled={isAnimating} onClick={() => act({ type: 'rest' })}>
            {t('actions.rest')}
          </button>
          {(gs.cargo['Médicaments'] ?? 0) > 0 && (
            <button className="px-btn px-btn--green" disabled={isAnimating || cs.medicUses >= 3} onClick={() => act({ type: 'heal' })}>
              {t('actions.heal', { qty: gs.cargo['Médicaments'], limit: cs.medicUses >= 3 ? t('actions.healLimit') : t('actions.healRemaining', { used: cs.medicUses }) })}
            </button>
          )}
          {(gs.cargo['Eau purifiée'] ?? 0) > 0 && gs.stamina < gs.maxStamina && (
            <button className="px-btn px-btn--green" disabled={isAnimating} onClick={() => act({ type: 'water' })}>
              {t('actions.water', { qty: gs.cargo['Eau purifiée'] })}
            </button>
          )}
          {(gs.cargo['Drogues de synthèse'] ?? 0) > 0 && (
            <button
              className={`px-btn ${(gs.addictionLevel ?? 0) > 0 ? 'px-btn--danger' : 'px-btn--primary'}`}
              disabled={isAnimating}
              onClick={() => act({ type: 'drug' })}
            >
              {t('actions.drug', { qty: gs.cargo['Drogues de synthèse'] })}
              {(gs.addictionLevel ?? 0) > 0 ? t('actions.drugAddicted') : t('actions.drugNormal')}
            </button>
          )}
          {(gs.cargo['Médicaments premium'] ?? 0) > 0 && gs.playerHp < gs.playerMaxHp && (
            <button className="px-btn px-btn--green" disabled={isAnimating || cs.medicUses >= 3} onClick={() => act({ type: 'premium_med' })}>
              {t('actions.premiumMed', { qty: gs.cargo['Médicaments premium'], limit: cs.medicUses >= 3 ? t('actions.premiumMedLimit') : t('actions.premiumMedRemaining', { used: cs.medicUses }) })}
            </button>
          )}
          {(gs.cargo['Plantes médicinales'] ?? 0) > 0 && gs.playerHp < gs.playerMaxHp && (
            <button className="px-btn px-btn--green" disabled={isAnimating || cs.medicUses >= 3} onClick={() => act({ type: 'herb' })}>
              {t('actions.herb', { qty: gs.cargo['Plantes médicinales'], limit: cs.medicUses >= 3 ? t('actions.premiumMedLimit') : t('actions.premiumMedRemaining', { used: cs.medicUses }) })}
            </button>
          )}
          {(() => {
            const FOOD = ['Rations militaires', 'Rations', 'Vivres', 'Nourriture fraîche', 'Nourriture synthétique']
            const found = FOOD.find(k => (gs.cargo[k] ?? 0) > 0)
            if (!found || gs.playerHp >= gs.playerMaxHp) return null
            return (
              <button className="px-btn px-btn--green" disabled={isAnimating || cs.medicUses >= 3} onClick={() => act({ type: 'food' })}>
                {t('actions.food', { item: found ? translateGood(found) : found, qty: gs.cargo[found], limit: cs.medicUses >= 3 ? t('actions.premiumMedLimit') : t('actions.premiumMedRemaining', { used: cs.medicUses }) })}
              </button>
            )
          })()}
          {(gs.cargo['Alcools exotiques'] ?? 0) > 0 && gs.stamina < gs.maxStamina && (
            <button className="px-btn" style={{ borderColor: 'var(--orange)', color: 'var(--orange)' }} disabled={isAnimating} onClick={() => act({ type: 'alcohol' })}>
              {t('actions.alcohol', { qty: gs.cargo['Alcools exotiques'] })}
            </button>
          )}
          {gs.fuel > 0 && cs.fleeAttempts < 2 && (
            <button className="px-btn px-btn--danger" disabled={isAnimating} onClick={flee}>
              {t('actions.flee', {
                chance: gs.class.name === 'Rayane' ? '🪙 50' : 50 + (gs.fuel > 2 ? 15 : 0) + (gs.class.name === 'Contrebandier' ? 20 : 0),
                cost: gs.class.name === 'Rayane' ? t('actions.fleeCostRayane') : t('actions.fleeCostNormal'),
              })}
            </button>
          )}
          {cs.fleeAttempts >= 2 && (
            <div className="t-xs t-red" style={{ padding: '4px 0' }}>{t('actions.fleeBlocked')}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ClassAction({ gs, onAct, disabled }: { gs: ReturnType<typeof useGameStore.getState>['gs'] & object; onAct: (a: CombatAction) => void; disabled: boolean }) {
  const { t } = useTranslation('combatScreen')
  if (!gs) return null
  switch (gs.class.name) {
    case 'Seigneur de guerre':
      return <button className="px-btn" style={{ color: 'var(--cyan)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.warlord')}
      </button>
    case 'Médecin':
      return gs.stamina >= 20 ? <button className="px-btn" style={{ color: 'var(--cyan)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.medic')}
      </button> : null
    case 'Hackeur':
      return gs.stamina >= 30 ? <button className="px-btn" style={{ color: 'var(--cyan)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.hacker')}
      </button> : null
    case 'Contrebandier':
      return gs.fuel > 0 ? <button className="px-btn" style={{ color: 'var(--cyan)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.smuggler')}
      </button> : null
    case 'Vagabond':
      return <button className="px-btn" style={{ color: 'var(--cyan)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.wanderer')}
      </button>
    case 'Marchand':
      return gs.credits >= 200 * Math.max(1, gs.day) ? <button className="px-btn" style={{ color: 'var(--cyan)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.merchant')}
      </button> : null
    case 'Mécanicien':
      return gs.stamina >= 15 ? <button className="px-btn" style={{ color: 'var(--cyan)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.mechanic')}
      </button> : null
    case 'Explorateur':
      return gs.stamina >= 15 ? <button className="px-btn" style={{ color: 'var(--cyan)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.explorer')}
      </button> : null
    case 'Ferrailleur':
      return <button className="px-btn" style={{ color: 'var(--orange)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.scrapper')}
      </button>
    case 'Héritier':
      return gs.credits >= 1500 ? <button className="px-btn" style={{ color: 'var(--gold)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.heir')}
      </button> : null
    case 'Rayane':
      return <button className="px-btn" style={{ color: 'var(--gold)' }} disabled={disabled} onClick={() => onAct({ type: 'class' })}>
        {t('class.rayane')}
      </button>
    default: return null
  }
}
