import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { buildRunSummary } from '../../engine/meta'
import { useMetaStore } from '../../store/metaStore'
import {
  getNexusFragments, attemptNexusFragment, canAttempt,
  isFragmentAvailable, getPillarStandingLabel, getWarAvailableFragments,
  getHolderBountyHunters, getArcPerduClues,
  getActionSuccessChance, getChanceLabel,
  type NexusAction
} from '../../engine/nexus'
import { BOSS_STATIONS, getStations } from '../../data/stations'
import { getTierBoss } from '../../data/enemies'
import { getSubBossProgress, arePillarSubBossesCleared, getSubBossesForPillar, getLieutenantClueText } from '../../data/subBosses'
import type { SubBossData } from '../../types'
import { translateEnemyName, translateStationName } from '../../engine/goodsI18n'

type ViewState = 'list' | 'detail'

const PILLAR_COLORS: Record<string, string> = {
  alanossa: 'var(--red)',
  cesarion: 'var(--cyan)',
  raphazarus: 'var(--purple)',
  scotty:   'var(--gold)',
}

// "steal" n'est plus un bouton d'action instantané : il se déclenche tout seul
// en visitant la station du détenteur avec une réputation suffisante (visite
// privée — voir bossHomeVisits.ts). Il n'apparaît donc dans aucune liste ici.
const ACTIONS_BY_FRAGMENT: Record<number, NexusAction[]> = {
  0: ['force', 'pay', 'alliance', 'war', 'manipulate'],
  1: ['force', 'alliance', 'war', 'manipulate'],
  2: ['force', 'alliance', 'war', 'manipulate'],
  3: ['force', 'alliance', 'gamble', 'war', 'manipulate'],
}

const ACTION_DANGER: Partial<Record<NexusAction, string>> = {
  force:    'var(--red)',
  war:      'var(--orange)',
  manipulate: 'var(--purple)',
}

export function NexusScreen() {
  const { t } = useTranslation('nexusScreen')
  const ACTION_LABELS = t('actionLabels', { returnObjects: true }) as unknown as Record<NexusAction, string>
  const PATH_LABELS = t('pathLabels', { returnObjects: true }) as unknown as Record<NexusAction, string>
  const gs              = useGameStore(s => s.gs!)
  const goTo            = useGameStore(s => s.goTo)
  const patch           = useGameStore(s => s.patch)
  const startCombat     = useGameStore(s => s.startCombat)
  const collectFragment = useGameStore(s => s.collectNexusFragment)

  const [view, setView]       = useState<ViewState>('list')
  const [selected, setSelected] = useState<number>(0)
  const [msg, setMsg]         = useState<string | null>(null)
  const [msgOk, setMsgOk]     = useState(false)
  const [goldFlash, setGoldFlash] = useState(false)
  const [guessInput, setGuessInput] = useState<Record<string, string>>({})
  const [wrongGuessId, setWrongGuessId] = useState<string | null>(null)

  const collected = gs.nexusFragments ?? []
  const nexusPath = gs.nexusPath ?? {}

  function submitLieutenantGuess(sb: SubBossData) {
    const guess = guessInput[sb.id]
    if (!guess) return
    setGuessInput(prev => ({ ...prev, [sb.id]: '' }))
    if (guess === sb.station) {
      patch({ lieutenantLocationsKnown: [...(gs.lieutenantLocationsKnown ?? []), sb.id] })
      setWrongGuessId(null)
    } else {
      setWrongGuessId(sb.id)
    }
  }

  function attempt(idx: number, action: NexusAction) {
    const result = attemptNexusFragment(gs, idx, action)

    // Guerre déclenchée — succès = false mais on enregistre la guerre
    if (result.triggersWar) {
      const war = {
        holderA: result.triggersWar.holderA,
        holderB: result.triggersWar.holderB,
        startDay: gs.day,
        resolved: false,
      }
      patch({ ...(result.newGs ?? {}), nexusWars: [...(gs.nexusWars ?? []), war] })
      setMsg(t('warTriggered', { holderA: war.holderA, holderB: war.holderB, message: result.message }))
      setMsgOk(true)
      return
    }

    if (!result.success) {
      if (result.newGs) patch(result.newGs)
      // Combat forcé après échec de manipulation
      if (result.triggerCombat) {
        const bossName = result.pillarBossName ?? t('guardianFallback')
        const tierBoss = getTierBoss()
        const boss = tierBoss.find(b => b.name === bossName) ?? { ...tierBoss[0], name: bossName }
        startCombat({ ...boss, isBoss: true, captureChance: 0, killChance: 30 })
        patch({ nexusPath: { ...nexusPath, [idx]: 'force' } })
      }
      setMsg(result.message)
      setMsgOk(false)
      return
    }

    if (result.triggerCombat) {
      if (result.newGs) patch(result.newGs)
      const bossName = result.pillarBossName ?? t('guardianFallback')
      const tierBoss = getTierBoss()
      const boss = tierBoss.find(b => b.name === bossName) ?? { ...tierBoss[0], name: bossName }
      startCombat({ ...boss, isBoss: true, captureChance: 0, killChance: 30 })
      patch({ nexusPath: { ...nexusPath, [idx]: action } })
      return
    }

    if (result.newGs) patch(result.newGs)

    // Trahison — spawn bounty hunter immédiat
    if (result.spawnsBounty && !gs.stalker) {
      const pillarMap: Record<number, string> = { 0: 'alanossa', 1: 'cesarion', 2: 'raphazarus', 3: 'scotty' }
      const pillar = pillarMap[idx]
      const bounty = getHolderBountyHunters()[pillar]
      if (bounty) {
        patch({
          stalker: {
            name: bounty.name,
            station: gs.currentStation,
            closingIn: true,
            daysSinceLastSeen: gs.day,
            threatLevel: bounty.threatLevel,
            daysActive: 0,
          },
        })
      }
    }

    collectFragment(idx)
    patch({ nexusPath: { ...nexusPath, [idx]: action } })
    setMsg(result.message)
    setMsgOk(true)
    setGoldFlash(true)
    setTimeout(() => setGoldFlash(false), 800)
  }

  // ── VUE DÉTAIL ───────────────────────────────────────────────────────────
  if (view === 'detail') {
    const f = getNexusFragments()[selected]
    const isOwned = collected.includes(selected)
    const isHere = isFragmentAvailable(gs, selected)
    const isWarAvailable = getWarAvailableFragments(gs).includes(selected)
    const color = PILLAR_COLORS[f.pillar] ?? 'var(--text)'
    const standing = ((gs.pillarStanding ?? {}) as Record<string, number>)[f.pillar] ?? 0
    const isAngered = (gs.nexusAngered ?? []).includes(f.pillar)
    const activeWar = (gs.nexusWars ?? []).find(w => !w.resolved && (w.holderA === f.pillar || w.holderB === f.pillar))
    const actions = ACTIONS_BY_FRAGMENT[selected] ?? []

    return (
      <div className={`layout ${goldFlash ? 'gold-flash' : ''}`}>
        <div className="row" style={{ gap: '12px', alignItems: 'center' }}>
          <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => { setView('list'); setMsg(null) }}>
            {t('back')}
          </button>
          <div className="t-sm" style={{ color, flex: 1 }}>{f.name}</div>
          {isOwned && <div className="tag" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>{t('collected')} · {PATH_LABELS[nexusPath[selected]!] ?? t('unknownPath')}</div>}
        </div>

        <div className="px-box" style={{ borderColor: color }}>
          <div className="t-xs t-dim" style={{ fontStyle: 'italic', lineHeight: '2.2' }}>{f.lore}</div>
        </div>

        <div className="px-box" style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('guardian')}</span>
              <span className="t-xs" style={{ color }}>{f.pillar.charAt(0).toUpperCase() + f.pillar.slice(1)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('station')}</span>
              <span className="t-xs">{translateStationName(f.station)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('yourStanding')}</span>
              <span className="t-xs" style={{ color: standing >= 20 ? 'var(--green)' : standing <= -20 ? 'var(--red)' : 'var(--text)' }}>
                {standing > 0 ? '+' : ''}{standing} — {getPillarStandingLabel(gs, f.pillar as any)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('currentPosition')}</span>
              <span className="t-xs" style={{ color: isHere ? 'var(--green)' : 'var(--dim)' }}>
                {isHere ? t('onSite') : translateStationName(gs.currentStation)}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-boss progress */}
        {(() => {
          const sbProg = getSubBossProgress(gs.subBossesDefeated ?? {}, f.pillar)
          const sbCleared = arePillarSubBossesCleared(gs.subBossesDefeated ?? {}, f.pillar)
          const subs = getSubBossesForPillar(f.pillar, gs)
          const pillarDefeated = gs.subBossesDefeated?.[f.pillar] ?? []
          const locationsKnown = gs.lieutenantLocationsKnown ?? []
          const clueLevels = gs.lieutenantClueLevels ?? {}
          const nextSb = subs.find(sb => !pillarDefeated.includes(sb.id))
          return (
            <div className="px-box" style={{ borderColor: sbCleared ? 'var(--green)' : 'var(--orange)' }}>
              <div className="t-xs mb4" style={{ color: sbCleared ? 'var(--green)' : 'var(--orange)', letterSpacing: '1px' }}>
                {t('lieutenants', { done: sbProg.done, total: sbProg.total })}
              </div>
              {subs.map(sb => {
                const done = pillarDefeated.includes(sb.id)
                const known = done || locationsKnown.includes(sb.id)
                return (
                  <div key={sb.id} className="col gap4" style={{ marginBottom: '4px' }}>
                    <div className="t-xs" style={{ color: done ? 'var(--green)' : 'var(--dim)', lineHeight: 2 }}>
                      {done ? '✓' : '○'} {sb.order}. {known ? translateEnemyName(sb.name) : t('unknownName')} — {known ? translateStationName(sb.station) : t('unknownLocation')}
                    </div>
                    {!done && sb.id === nextSb?.id && !known && (clueLevels[sb.id] ?? 0) > 0 && (
                      <div className="t-xs" style={{ color: 'var(--cyan)', lineHeight: 1.6, marginLeft: '14px' }}>
                        {t('clue', { text: getLieutenantClueText(gs, sb, clueLevels[sb.id] ?? 0) })}
                      </div>
                    )}
                    {!done && sb.id === nextSb?.id && !known && (
                      <div className="row gap4" style={{ marginLeft: '14px', alignItems: 'center' }}>
                        <select
                          className="t-xs"
                          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', padding: '2px 4px' }}
                          value={guessInput[sb.id] ?? ''}
                          onChange={e => setGuessInput(prev => ({ ...prev, [sb.id]: e.target.value }))}
                        >
                          <option value="">{t('guessStation')}</option>
                          {getStations().map(st => <option key={st.name} value={st.name}>{translateStationName(st.name)}</option>)}
                        </select>
                        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => submitLieutenantGuess(sb)}>
                          {t('guess')}
                        </button>
                        {wrongGuessId === sb.id && <span className="t-xs t-red">{t('notThere')}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
              {!sbCleared && (
                <div className="t-xs t-red mt4">{t('mandatoryOrder')}</div>
              )}
            </div>
          )
        })()}

        {/* Statuts spéciaux */}
        {isAngered && (
          <div className="px-box" style={{ borderColor: 'var(--red)' }}>
            <div className="t-xs t-red">{t('permanentEnemy', { pillar: f.pillar.charAt(0).toUpperCase() + f.pillar.slice(1) })}</div>
          </div>
        )}
        {activeWar && (
          <div className="px-box" style={{ borderColor: 'var(--orange)' }}>
            <div className="t-xs" style={{ color: 'var(--orange)' }}>
              {t('warInProgress', { holderA: activeWar.holderA, holderB: activeWar.holderB, day: activeWar.startDay, trips: Math.max(0, 4 - (gs.day - activeWar.startDay)) })}
            </div>
          </div>
        )}
        {isWarAvailable && !isOwned && (
          <div className="px-box" style={{ borderColor: 'var(--orange)' }}>
            <div className="t-xs" style={{ color: 'var(--orange)' }}>{t('warRecoverable')}</div>
          </div>
        )}

        {msg && (
          <div className="px-box" style={{ borderColor: msgOk ? 'var(--gold)' : 'var(--red)' }}>
            <div className="t-xs" style={{ color: msgOk ? 'var(--gold)' : 'var(--red)', lineHeight: '2' }}>{msg}</div>
            <button className="px-btn px-btn--sm mt8" style={{ width: 'auto' }} onClick={() => setMsg(null)}>{t('ok')}</button>
          </div>
        )}

        {isOwned && (
          <div className="px-box" style={{ borderColor: 'var(--gold)', textAlign: 'center' }}>
            <div className="t-gold">{t('inPossession')}</div>
            <div className="t-xs t-dim mt4">{t('obtained', { path: PATH_LABELS[nexusPath[selected]!] ?? '' })}</div>
          </div>
        )}

        {/* Raphazarus — progression Arc Perdu */}
        {f.pillar === 'raphazarus' && !isOwned && (
          <div className="px-box" style={{ borderColor: gs.arcPerduUnlocked ? 'var(--green)' : 'var(--purple)' }}>
            <div className="t-xs mb4" style={{ color: gs.arcPerduUnlocked ? 'var(--green)' : 'var(--purple)', letterSpacing: '1px' }}>
              {gs.arcPerduUnlocked ? t('arcLocated') : t('arcSearch')}
            </div>
            {!gs.arcPerduUnlocked && (
              <>
                <div className="t-xs t-dim" style={{ lineHeight: 2 }}>
                  {t('arcNotFound')}
                </div>
                <div className="t-xs mt4" style={{ color: 'var(--purple)' }}>
                  {t('clueCount', { count: (gs.arcPerduClues ?? []).length })}
                </div>
                {getArcPerduClues().filter(c => (gs.arcPerduClues ?? []).includes(c.id)).map(c => (
                  <div key={c.id} className="t-xs" style={{ color: 'var(--dim)', lineHeight: 2 }}>
                    ✓ {c.clueText}
                  </div>
                ))}
              </>
            )}
            {gs.arcPerduUnlocked && !gs.raphazarusActivated && (
              <div className="t-xs t-dim" style={{ lineHeight: 2 }}>
                {t('arcOnMap')}
              </div>
            )}
            {gs.raphazarusActivated && (
              <div className="t-xs t-red" style={{ lineHeight: 2 }}>
                {t('raphazarusAlert')}
              </div>
            )}
          </div>
        )}

        {/* Scotty — progression gambling */}
        {f.pillar === 'scotty' && !isOwned && (gs.scottyGambleWins ?? 0) > 0 && (
          <div className="px-box" style={{ borderColor: 'var(--gold)' }}>
            <div className="t-xs" style={{ color: 'var(--gold)' }}>
              {t('gamblingProgress', { wins: gs.scottyGambleWins })}
            </div>
          </div>
        )}

        {!isOwned && !isHere && !isWarAvailable && (
          <div className="px-box" style={{ borderColor: 'var(--dim)' }}>
            <div className="t-xs t-dim">{t('mustBeAtBefore')} <span className="t-bright">{translateStationName(f.station)}</span> {t('mustBeAtAfter')}</div>
          </div>
        )}

        {!isOwned && isHere && (
          <div className="col gap4">
            <div className="t-xs t-dim" style={{ padding: '0 4px' }}>{t('availableMethods')}</div>
            {actions.map(action => {
              const check = canAttempt(gs, selected, action)
              const dangerColor = ACTION_DANGER[action]
              const isDanger = action === 'force' || !!dangerColor
              const chance = getActionSuccessChance(selected, action)
              const chanceInfo = chance !== null ? getChanceLabel(chance) : null
              return (
                <div key={action}>
                  <button
                    className={`px-btn ${action === 'force' ? 'px-btn--danger' : ''}`}
                    disabled={!check.ok}
                    style={{
                      opacity: check.ok ? 1 : 0.5,
                      ...(dangerColor && action !== 'force' ? { borderColor: dangerColor, color: dangerColor } : {}),
                    }}
                    onClick={() => attempt(selected, action)}
                  >
                    <span>{ACTION_LABELS[action]}</span>
                    {chanceInfo && chance !== null && chance < 100 && (
                      <span className="t-xs" style={{ marginLeft: '8px', color: chanceInfo.color }}>{chance}% — {chanceInfo.label}</span>
                    )}
                    {action === 'war' && (
                      <span className="t-xs" style={{ marginLeft: '8px', color: 'var(--orange)' }}>{t('warNoFragment')}</span>
                    )}
                    {isDanger && action !== 'force' && <span className="t-xs t-dim" style={{ marginLeft: '8px' }}>{t('permanentConsequences')}</span>}
                  </button>
                  {!check.ok && check.reason && (
                    <div className="t-xs t-dim" style={{ padding: '2px 8px' }}>↳ {check.reason}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── VUE LISTE ────────────────────────────────────────────────────────────
  const isComplete = collected.length >= 4

  return (
    <div className="layout">
      <div className="row" style={{ alignItems: 'center', gap: '12px' }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>{t('back')}</button>
        <div className="t-sm t-bright" style={{ flex: 1 }}>{t('title')}</div>
        <div className="t-xs t-dim">{collected.length}/4</div>
      </div>

      <div className="px-box" style={{ borderColor: 'var(--purple)' }}>
        <div className="t-xs t-purple mb4">{t('mainArc')}</div>
        <div className="t-xs t-dim" style={{ lineHeight: '2' }}>
          {t('mainArcDesc')}
        </div>
      </div>

      {isComplete && (
        <div className="px-box" style={{ borderColor: 'var(--gold)', textAlign: 'center' }}>
          <div className="t-lg t-gold mb8">{t('allGathered')}</div>
          <div className="t-xs t-dim mb8">
            {Object.values(nexusPath).map((p, i) => (
              <span key={i} style={{ marginRight: '12px', color: 'var(--gold)' }}>{PATH_LABELS[p as NexusAction]}</span>
            ))}
          </div>
          <button className="px-btn px-btn--primary" onClick={() => {
            const summary = buildRunSummary(gs, true)
            useMetaStore.getState().addRunSummary(summary)
            goTo('victory')
          }}>
            {t('activateStation')}
          </button>
        </div>
      )}

      {/* Guerres actives */}
      {(gs.nexusWars ?? []).filter(w => !w.resolved).length > 0 && (
        <div className="px-box" style={{ borderColor: 'var(--orange)' }}>
          <div className="t-xs" style={{ color: 'var(--orange)', marginBottom: '4px' }}>{t('warsInProgress')}</div>
          {(gs.nexusWars ?? []).filter(w => !w.resolved).map((w, i) => (
            <div key={i} className="t-xs t-dim">
              {t('warTripsLeft', { holderA: w.holderA.charAt(0).toUpperCase() + w.holderA.slice(1), holderB: w.holderB.charAt(0).toUpperCase() + w.holderB.slice(1), trips: Math.max(0, 4 - (gs.day - w.startDay)) })}
            </div>
          ))}
        </div>
      )}

      {/* Fragments récupérables après guerre */}
      {getWarAvailableFragments(gs).length > 0 && (
        <div className="px-box" style={{ borderColor: 'var(--orange)', background: 'rgba(255,140,0,0.06)' }}>
          <div className="t-xs" style={{ color: 'var(--orange)' }}>{t('fragmentsRecoverable')}</div>
        </div>
      )}

      <div className="col gap4">
        {getNexusFragments().map((f) => {
          const owned = collected.includes(f.idx)
          const here  = isFragmentAvailable(gs, f.idx)
          const warAvail = getWarAvailableFragments(gs).includes(f.idx)
          const angered = (gs.nexusAngered ?? []).includes(f.pillar)
          const color = PILLAR_COLORS[f.pillar] ?? 'var(--text)'
          const standing = ((gs.pillarStanding ?? {}) as Record<string, number>)[f.pillar] ?? 0
          const borderCol = owned ? 'var(--gold)' : angered ? 'var(--red)' : warAvail ? 'var(--orange)' : here ? color : 'var(--border)'

          return (
            <button
              key={f.idx}
              className="px-box"
              style={{
                borderColor: borderCol,
                textAlign: 'left', cursor: 'pointer',
                background: owned ? 'rgba(180,140,0,0.06)' : angered ? 'rgba(255,60,60,0.04)' : 'transparent',
                width: '100%',
              }}
              onClick={() => { setSelected(f.idx); setView('detail'); setMsg(null) }}
            >
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: '6px' }}>
                <div className="t-sm" style={{ color: owned ? 'var(--gold)' : angered ? 'var(--red)' : here ? color : 'var(--text-dim)' }}>
                  {owned ? '★ ' : angered ? '⚠ ' : `${f.idx + 1}. `}{f.name}
                </div>
                <div className="tag" style={{
                  borderColor: owned ? 'var(--gold)' : angered ? 'var(--red)' : warAvail ? 'var(--orange)' : here ? color : 'var(--dim)',
                  color:       owned ? 'var(--gold)' : angered ? 'var(--red)' : warAvail ? 'var(--orange)' : here ? color : 'var(--dim)',
                  fontSize: '9px'
                }}>
                  {owned ? PATH_LABELS[nexusPath[f.idx]!] ?? t('collected') : angered ? t('enemy') : warAvail ? t('recoverable') : here ? t('available') : translateStationName(f.station)}
                </div>
              </div>
              <div className="t-xs t-dim" style={{ lineHeight: '1.8' }}>{f.lore.slice(0, 90)}…</div>
              {!owned && (() => {
                const sbProg = getSubBossProgress(gs.subBossesDefeated ?? {}, f.pillar)
                const sbCleared = arePillarSubBossesCleared(gs.subBossesDefeated ?? {}, f.pillar)
                return (
                  <>
                    <div className="t-xs" style={{ marginTop: '4px', color: angered ? 'var(--red)' : standing >= 20 ? 'var(--green)' : 'var(--dim)' }}>
                      {angered
                        ? t('huntingYou')
                        : t('standingLine', { pillar: f.pillar, value: `${standing > 0 ? '+' : ''}${standing}`, label: getPillarStandingLabel(gs, f.pillar as any) })
                      }
                    </div>
                    <div className="t-xs" style={{ marginTop: '2px', color: sbCleared ? 'var(--green)' : 'var(--orange)' }}>
                      {sbCleared
                        ? t('lieutenantsCleared', { done: sbProg.done, total: sbProg.total })
                        : t('lieutenantsRemaining', { done: sbProg.done, total: sbProg.total })
                      }
                    </div>
                    {f.pillar === 'raphazarus' && !gs.arcPerduUnlocked && (
                      <div className="t-xs" style={{ marginTop: '2px', color: 'var(--purple)' }}>
                        {t('arcPerduClues', { count: (gs.arcPerduClues ?? []).length })}
                      </div>
                    )}
                    {f.pillar === 'scotty' && (gs.scottyGambleWins ?? 0) > 0 && (
                      <div className="t-xs" style={{ marginTop: '2px', color: 'var(--gold)' }}>
                        {t('gambling', { wins: gs.scottyGambleWins })}
                      </div>
                    )}
                  </>
                )
              })()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
