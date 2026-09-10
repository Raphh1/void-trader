import { useEffect, useState } from 'react'
import { getStationFactionName } from '../../engine/factionRep'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { StopTheBar, type StopResult } from '../minigames/StopTheBar'
import { addJournal } from '../../engine/journal'
import { tickWorldEventsMultipleDays } from '../../engine/worldEvents'
import i18n from '../../i18n/config'
import type { GameState, WeaponData, ArmorData } from '../../types'
import { translateStationName } from '../../engine/goodsI18n'

type EscapePhase = 'menu' | 'playing' | 'between' | 'caught' | 'escape-final-roll' | 'success' | 'execution'

const pt = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'prisonScreen', ...params })

const TOTAL_ROUNDS = 3

const PRISON_PILLAR_STATIONS: Record<string, keyof GameState['pillarStanding']> = {
  'Emporium Requiem':     'cesarion',
  "L'Arc Perdu":          'raphazarus',
  'Arc Ouest Apocalypse': 'alanossa',
  'Scotty Golden North':  'scotty',
  'La Tribosphère':       'eliotis',
  'Paradoxa Eterna':      'maxance',
}

// ── ÉVÉNEMENTS QUOTIDIENS (non-combat) ────────────────────────────────────────

interface PrisonEvent {
  text: string
  hpDelta: number
  hpMaxDelta: number
  creditsDelta: number
  repDelta: number
}

function rollPrisonEvent(gs: GameState): PrisonEvent {
  const r = Math.random()
  if (r < 0.15) {
    // Vol nocturne
    const stolen = Math.min(gs.credits, 80 + Math.floor(Math.random() * 150))
    return { text: pt('events.theft', { amount: stolen }), hpDelta: 0, hpMaxDelta: 0, creditsDelta: -stolen, repDelta: 0 }
  }
  if (r < 0.27) {
    // Maladie — HP max permanent
    const loss = 5 + Math.floor(Math.random() * 8)
    return { text: pt('events.illness', { loss }), hpDelta: -loss, hpMaxDelta: -loss, creditsDelta: 0, repDelta: 0 }
  }
  if (r < 0.38) {
    // Interrogatoire surprise
    return { text: pt('events.interrogation'), hpDelta: -8, hpMaxDelta: 0, creditsDelta: 0, repDelta: -5 }
  }
  if (r < 0.48) {
    // Solidarité
    const heal = 8 + Math.floor(Math.random() * 12)
    return { text: pt('events.solidarity', { heal }), hpDelta: heal, hpMaxDelta: 0, creditsDelta: 0, repDelta: 0 }
  }
  if (r < 0.55) {
    // Information
    return { text: pt('events.information'), hpDelta: 0, hpMaxDelta: 0, creditsDelta: 0, repDelta: 3 }
  }
  return { text: pt('events.nothing'), hpDelta: 0, hpMaxDelta: 0, creditsDelta: 0, repDelta: 0 }
}

// ── RESTORATION D'ITEMS ────────────────────────────────────────────────────────

function buildItemRestore(gs: GameState, fraction: number): Partial<GameState> {
  const items = gs.prisonConfiscatedItems
  if (!items) return { prisonConfiscatedItems: null, prisonEscapeFailures: 0, prisonCellmatePending: false }

  if (fraction <= 0) {
    return { prisonConfiscatedItems: null, prisonEscapeFailures: 0, prisonCellmatePending: false }
  }

  const keepWeapon = (w: WeaponData) => fraction >= 1 || Math.random() < fraction
  const keepArmor  = (a: ArmorData)  => fraction >= 1 || Math.random() < fraction

  const weaponsBack = items.weapons.filter(keepWeapon)
  const armorsBack  = items.armors.filter(keepArmor)

  const cargoBack: Record<string, number> = {}
  for (const [item, qty] of Object.entries(items.cargo)) {
    const n = fraction >= 1 ? qty : Math.max(0, Math.floor(qty * fraction))
    if (n > 0) cargoBack[item] = n
  }

  const eqWeapon = items.equippedWeapon && weaponsBack.some(w => w.name === items.equippedWeapon?.name)
    ? items.equippedWeapon : null
  const eqArmor = items.equippedArmor && armorsBack.some(a => a.name === items.equippedArmor?.name)
    ? items.equippedArmor : null

  const mergedCargo = { ...gs.cargo }
  for (const [item, qty] of Object.entries(cargoBack)) {
    mergedCargo[item] = (mergedCargo[item] ?? 0) + qty
  }

  return {
    weapons: [...gs.weapons, ...weaponsBack],
    armors:  [...gs.armors, ...armorsBack],
    equippedWeapon: gs.equippedWeapon ?? eqWeapon,
    equippedArmor:  gs.equippedArmor  ?? eqArmor,
    cargo: mergedCargo,
    prisonConfiscatedItems: null,
    prisonEscapeFailures: 0,
    prisonCellmatePending: false,
  }
}

// ── COMPOSANT ─────────────────────────────────────────────────────────────────

export function PrisonScreen() {
  const { t } = useTranslation('prisonScreen')
  const gs           = useGameStore(s => s.gs!)
  const patch        = useGameStore(s => s.patch)
  const goTo         = useGameStore(s => s.goTo)
  const startCombat  = useGameStore(s => s.startCombat)

  const [msg, setMsg]       = useState<string | null>(null)
  const [freed, setFreed]   = useState(false)
  const [dailyLog, setDailyLog] = useState<string[]>([])
  const [escapePhase, setEscapePhase] = useState<EscapePhase>('menu')
  const [round, setRound]   = useState(1)

  const days    = gs.prisonDaysLeft ?? 1
  const caution = 800 + gs.day * 40
  const failures = gs.prisonEscapeFailures ?? 0

  // ── CONFISCATION À L'ENTRÉE ─────────────────────────────────────────────
  useEffect(() => {
    if (!gs.isImprisoned || gs.prisonConfiscatedItems !== null) return
    const cellmate = Math.random() < 0.45
    patch({
      prisonConfiscatedItems: {
        weapons: gs.weapons,
        armors:  gs.armors,
        equippedWeapon: gs.equippedWeapon,
        equippedArmor:  gs.equippedArmor,
        cargo: { ...gs.cargo },
      },
      weapons: [],
      armors:  [],
      equippedWeapon: null,
      equippedArmor:  null,
      cargo: {},
      prisonEscapeFailures: 0,
      prisonCellmatePending: cellmate,
    })
  }, [])

  // ── HELPERS ──────────────────────────────────────────────────────────────

  function getItemFractionText(frac: number) {
    if (frac >= 1)   return t('itemFraction.all')
    if (frac >= 0.5) return t('itemFraction.half')
    if (frac > 0)    return t('itemFraction.quarter')
    return t('itemFraction.none')
  }

  function serveTime() {
    const debtLoss = (gs.class.dailyDebt ?? 0) * days
    const events: PrisonEvent[] = Array.from({ length: days }, () => rollPrisonEvent(gs))
    const log = events.map((e, i) => t('dayLog', { day: i + 1, text: e.text }))

    const evtHpDelta    = events.reduce((s, e) => s + e.hpDelta, 0)
    const evtHpMaxDelta = events.reduce((s, e) => s + e.hpMaxDelta, 0)
    const evtCrDelta    = events.reduce((s, e) => s + e.creditsDelta, 0)
    const evtRepDelta   = events.reduce((s, e) => s + e.repDelta, 0)

    const baseHpPct   = Math.max(0.05, 0.45 - days * 0.05)
    const baseStamPct = Math.max(0.10, 0.60 - days * 0.07)
    const baseRepLoss = 8 + days * 4

    const newHpMax = Math.max(10, gs.playerMaxHp + evtHpMaxDelta)
    const finalHp  = Math.max(1, Math.floor(newHpMax * baseHpPct) + evtHpDelta)
    const finalSt  = Math.max(1, Math.floor(gs.maxStamina * baseStamPct))
    const finalRep = gs.reputation - baseRepLoss + evtRepDelta
    const finalCr  = Math.max(0, gs.credits + evtCrDelta - debtLoss)

    const pillarKey = PRISON_PILLAR_STATIONS[gs.currentStation]
    const pillarPenalty = days * 3
    const newStanding = pillarKey
      ? { ...gs.pillarStanding, [pillarKey]: Math.max(-100, (gs.pillarStanding?.[pillarKey] ?? 0) - pillarPenalty) }
      : gs.pillarStanding

    // Quêtes qui expirent pendant la peine
    const expiredQuests = gs.activeQuests.filter(q => q.dayMult && gs.day + days > (q as { deadline?: number }).deadline!)
    const survivingQuests = gs.activeQuests.filter(q => !expiredQuests.includes(q))
    const expiredCount = expiredQuests.length

    // Standing faction dégradé (double pénalité si mission faction en cours)
    const hasFactionMission = gs.activeQuests.some(q => expiredQuests.includes(q) && gs.faction !== 'none')
    const factionStandingLoss = hasFactionMission ? days * 8 : days * 3

    const itemPatch = buildItemRestore(gs, 0.5)
    const journalText = t('journalServeTime', {
      days, plural: days > 1 ? 's' : '', station: translateStationName(gs.currentStation),
      longNote: days >= 5 ? t('journalLongTrue') : t('journalLongFalse'),
      expiredNote: expiredCount > 0 ? t('journalExpired', { count: expiredCount, plural: expiredCount > 1 ? 's' : '' }) : '',
    })

    const afterEvents = tickWorldEventsMultipleDays({ ...gs, day: gs.day + days }, days)

    patch({
      isImprisoned: false, prisonDaysLeft: 0,
      day: gs.day + days,
      activeWorldEvents: afterEvents.activeWorldEvents,
      stationAlerts: afterEvents.stationAlerts,
      playerHp: finalHp, playerMaxHp: newHpMax,
      stamina: finalSt,
      reputation: finalRep - (expiredCount * 5),
      credits: finalCr,
      pillarStanding: newStanding,
      activeQuests: survivingQuests,
      factionReputation: gs.faction !== 'none'
        ? { ...gs.factionReputation, [gs.faction]: Math.max(0, gs.factionReputation[gs.faction] - factionStandingLoss) }
        : gs.factionReputation,
      journal: addJournal(gs, journalText, 'prison'),
      ...itemPatch,
    })
    setDailyLog(log)
    const repDelta = (finalRep - (expiredCount * 5)) - gs.reputation
    const lines = [
      t('serveTimeSummary.daysServed', { days, plural: days > 1 ? 's' : '' }),
      t('serveTimeSummary.exit', { hp: finalHp, maxHp: newHpMax, stamina: finalSt }),
      t('serveTimeSummary.reputation', { sign: repDelta > 0 ? '+' : '', delta: repDelta }),
      finalCr < gs.credits ? t('serveTimeSummary.credits', { amount: (gs.credits - finalCr).toLocaleString() }) : null,
      pillarKey ? t('serveTimeSummary.standing', { penalty: pillarPenalty, pillar: pillarKey }) : null,
      expiredCount > 0 ? t('serveTimeSummary.expiredQuests', { count: expiredCount, plural: expiredCount > 1 ? 's' : '', repLoss: expiredCount * 5 }) : null,
      hasFactionMission ? t('serveTimeSummary.factionAbandoned', { loss: factionStandingLoss }) : null,
      t('serveTimeSummary.itemsRecovered', { fraction: getItemFractionText(0.5) }),
    ].filter(Boolean) as string[]
    setMsg(lines.join(' '))
    setFreed(true)
  }

  function payCaution() {
    if (gs.credits < caution) { setMsg(t('missingCredits', { amount: caution - gs.credits })); return }
    const itemPatch = buildItemRestore(gs, 0.5)
    patch({
      credits: gs.credits - caution,
      isImprisoned: false, prisonDaysLeft: 0,
      playerHp: Math.max(1, Math.floor(gs.playerMaxHp * 0.60)),
      reputation: gs.reputation - 8,
      journal: addJournal(gs, t('cautionJournal', { station: translateStationName(gs.currentStation), amount: caution.toLocaleString() }), 'prison'),
      ...itemPatch,
    })
    setMsg(t('cautionMsg', { amount: caution, fraction: getItemFractionText(0.5) }))
    setFreed(true)
  }

  function bribeGuard() {
    if (gs.credits < 400) { setMsg(t('notEnoughCredits')); return }
    const ok = Math.random() < 0.50 + (gs.reputation > 40 ? 0.10 : 0)
    if (ok) {
      const itemPatch = buildItemRestore(gs, 0.5)
      patch({
        credits: gs.credits - 400,
        isImprisoned: false, prisonDaysLeft: 0,
        playerHp: Math.max(1, Math.floor(gs.playerMaxHp * 0.50)),
        prisonEscapes: gs.prisonEscapes + 1,
        journal: addJournal(gs, t('bribeJournal', { station: translateStationName(gs.currentStation) }), 'prison'),
        ...itemPatch,
      })
      setMsg(t('bribeSuccessMsg', { amount: 400, hp: Math.floor(gs.playerMaxHp * 0.50), fraction: getItemFractionText(0.5) }))
      setFreed(true)
    } else {
      patch({ credits: gs.credits - 400, prisonDaysLeft: days + 1 })
      setMsg(t('bribeFailMsg', { days: days + 1 }))
    }
  }

  function fightCellmate() {
    const power = 30 + Math.floor(gs.day * 1.8)
    startCombat({
      name: t('cellmateName'),
      maxHp: power,
      damageMin: 7, damageMax: 17,
      lootMin: 60, lootMax: 180,
      description: t('cellmateDesc'),
      captureChance: 0,
      killChance: 5,
      isBoss: false,
      role: 'normal',
    })
    patch({ prisonCellmatePending: false })
  }

  function ignoreCellmate() {
    // L'ignorer coûte des PV — il te frappe de dos
    const dmg = 12 + Math.floor(Math.random() * 20)
    patch({ prisonCellmatePending: false, playerHp: Math.max(1, gs.playerHp - dmg) })
    setMsg(t('ignoreCellmateMsg', { dmg }))
  }

  // ── RÉSULTAT D'ÉVASION ────────────────────────────────────────────────────

  function handleRoundResult(result: StopResult) {
    if (result === 'miss') {
      const dmg = 20 + round * 15
      const addDays = TOTAL_ROUNDS - round + 1
      const newFailures = failures + 1
      if (newFailures >= 4) {
        patch({ playerHp: Math.max(1, gs.playerHp - dmg), prisonDaysLeft: days + addDays, prisonEscapeFailures: newFailures })
        setEscapePhase('execution')
      } else {
        const itemFrac = newFailures >= 2 ? 0 : 0.25
        const itemPatch = buildItemRestore(gs, itemFrac)
        patch({
          playerHp: Math.max(1, gs.playerHp - dmg),
          prisonDaysLeft: days + addDays,
          prisonEscapeFailures: newFailures,
          ...itemPatch,
          prisonConfiscatedItems: itemFrac === 0 ? null : {
            weapons: [], armors: [], equippedWeapon: null, equippedArmor: null, cargo: {}
          },
        })
        setEscapePhase('caught')
      }
    } else {
      if (round >= TOTAL_ROUNDS) {
        setEscapePhase('escape-final-roll')
      } else {
        setEscapePhase('between')
      }
    }
  }

  function resolveEscapeFinalRoll() {
    const escaped = Math.random() < 0.70
    if (escaped) {
      // Vraiment libre — récupère 75% des items (tu as pris ce que tu pouvais)
      const itemPatch = buildItemRestore(gs, 0.75)
      patch({
        isImprisoned: false, prisonDaysLeft: 0,
        playerHp: Math.max(1, gs.playerHp - 10),
        prisonEscapes: gs.prisonEscapes + 1,
        reputation: gs.reputation + 25,
        journal: addJournal(gs, t('escapeJournal', { station: translateStationName(gs.currentStation) }), 'prison'),
        ...itemPatch,
      })
      setEscapePhase('success')
    } else {
      // Rattrapé au dernier moment
      const newFailures = failures + 1
      const dmg = 25 + Math.floor(Math.random() * 20)
      if (newFailures >= 4) {
        patch({ playerHp: Math.max(1, gs.playerHp - dmg), prisonDaysLeft: days + 2, prisonEscapeFailures: newFailures })
        setEscapePhase('execution')
      } else {
        const itemFrac = newFailures >= 2 ? 0 : 0.25
        const itemPatch = buildItemRestore(gs, itemFrac)
        patch({
          playerHp: Math.max(1, gs.playerHp - dmg),
          prisonDaysLeft: days + 2,
          prisonEscapeFailures: newFailures,
          ...itemPatch,
          prisonConfiscatedItems: itemFrac === 0 ? null : {
            weapons: [], armors: [], equippedWeapon: null, equippedArmor: null, cargo: {}
          },
        })
        setEscapePhase('caught')
      }
    }
  }

  // ── COULOIR DE LA MORT ────────────────────────────────────────────────────
  if (escapePhase === 'execution') {
    return (
      <div className="layout scanlines" style={{ justifyContent: 'center', minHeight: '100vh', background: '#0a0000' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', width: '100%' }}>
          <div className="t-center" style={{ color: 'var(--red)', fontSize: '8px', letterSpacing: '6px', marginBottom: '24px' }}>
            █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █
          </div>
          <div className="px-box" style={{ borderColor: 'var(--red)', borderWidth: '2px', textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ fontSize: '11px', color: 'var(--red)', letterSpacing: '5px', marginBottom: '8px' }}>
              {t('execution.corridorTitle')}
            </div>
            <div style={{ fontSize: '22px', color: 'var(--red)', letterSpacing: '3px', marginBottom: '24px', fontWeight: 'bold' }}>
              {t('execution.finalSentence')}
            </div>
            <div className="t-xs" style={{ color: 'var(--dim)', lineHeight: '2.4', marginBottom: '20px', fontStyle: 'italic' }}>
              {t('execution.body1a')}<br />
              {t('execution.body1b')}<br />
              {t('execution.body1c')}
            </div>
            <div className="t-xs" style={{ color: 'var(--text)', lineHeight: '2.4', marginBottom: '20px' }}>
              {t('execution.body2a')}<br />
              {t('execution.body2b')}<br />
              {t('execution.body2c')}<br />
              {t('execution.body2d')}
            </div>
            <div className="t-xs" style={{ color: 'var(--red)', lineHeight: '2', marginBottom: '24px', letterSpacing: '1px' }}>
              {t('execution.body3a')}<br />
              {t('execution.body3b')}
            </div>
            <div style={{ color: 'var(--dim)', fontSize: '8px', letterSpacing: '3px', marginBottom: '20px' }}>
              {t('execution.endOfSentence')}
            </div>
          </div>
          <div className="t-center" style={{ color: 'var(--red)', fontSize: '8px', letterSpacing: '6px', margin: '16px 0' }}>
            █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █
          </div>
          <button className="px-btn px-btn--danger" style={{ letterSpacing: '2px' }} onClick={() => {
            patch({
              isDead: true,
              deathCause: t('execution.deathCause'),
              prisonConfiscatedItems: null,
            })
          }}>
            {t('execution.acceptButton')}
          </button>
        </div>
      </div>
    )
  }

  // ── ROLL FINAL ÉVASION ────────────────────────────────────────────────────
  if (escapePhase === 'escape-final-roll') {
    return (
      <div className="layout" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <div className="t-xs t-dim t-center mb8">{t('finalRoll.title')}</div>
          <div className="px-box" style={{ borderColor: 'var(--orange)', textAlign: 'center', padding: '24px' }}>
            <div className="t-xs t-orange mb8">{t('finalRoll.outside')}</div>
            <div className="t-xs t-dim" style={{ lineHeight: '2.2' }}>
              {t('finalRoll.body')}
            </div>
            <div className="t-xs t-dim mt8" style={{ fontStyle: 'italic' }}>
              {failures >= 3
                ? t('finalRoll.attempt4')
                : failures >= 2
                  ? t('finalRoll.attempt3')
                  : failures >= 1
                    ? t('finalRoll.attempt2')
                    : t('finalRoll.attempt1')
              }
            </div>
          </div>
          <button className="px-btn px-btn--primary mt8" onClick={resolveEscapeFinalRoll}>
            {t('finalRoll.runButton')}
          </button>
        </div>
      </div>
    )
  }

  // ── MINI JEU EN COURS ────────────────────────────────────────────────────
  if (escapePhase === 'playing') {
    return (
      <div className="layout">
        <div className="t-xs t-dim t-center">{t('playing.header', { round, total: TOTAL_ROUNDS })}</div>
        <div className="px-box" style={{ borderColor: 'var(--orange)' }}>
          <div className="t-xs t-orange mb4">{t(`roundLabels.${round - 1}`)}</div>
          <div className="t-xs t-dim" style={{ lineHeight: '2' }}>{t(`roundDescs.${round - 1}`)}</div>
        </div>
        <StopTheBar
          difficulty={round as 1 | 2 | 3}
          label={t(`roundLabels.${round - 1}`).toUpperCase()}
          onResult={handleRoundResult}
        />
      </div>
    )
  }

  // ── ENTRE DEUX ROUNDS ────────────────────────────────────────────────────
  if (escapePhase === 'between') {
    return (
      <div className="layout" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <div className="t-xs t-dim t-center mb8">{t('between.header', { round, total: TOTAL_ROUNDS })}</div>
          <div className="px-box" style={{ borderColor: 'var(--green)', textAlign: 'center', padding: '20px' }}>
            <div className="t-xs t-green mb8">{t('between.passed')}</div>
            <div className="t-xs t-dim" style={{ lineHeight: '2' }}>{t(`betweenMsgs.${round - 1}`)}</div>
          </div>
          <button className="px-btn px-btn--primary mt8" onClick={() => { setRound(r => r + 1); setEscapePhase('playing') }}>
            {t('between.continueButton', { next: round + 1, total: TOTAL_ROUNDS })}
          </button>
        </div>
      </div>
    )
  }

  // ── RATTRAPÉ ──────────────────────────────────────────────────────────────
  if (escapePhase === 'caught') {
    const addDays = Math.max(1, TOTAL_ROUNDS - round + 1)
    const itemLabel = failures >= 2 ? t('caught.itemNone') : failures >= 1 ? t('caught.item25partial') : t('caught.item25')
    return (
      <div className="layout" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <div className="t-xs t-dim t-center mb8">{t('caught.header')}</div>
          <div className="px-box" style={{ borderColor: 'var(--red)', textAlign: 'center', padding: '20px' }}>
            <div className="t-red" style={{ fontSize: '14px', letterSpacing: '2px', marginBottom: '12px' }}>{t('caught.title')}</div>
            <div className="t-xs t-dim" style={{ lineHeight: '2.2', marginBottom: '8px' }}>
              {round === 1 && t('caught.round1')}
              {round === 2 && t('caught.round2')}
              {round === 3 && t('caught.round3')}
            </div>
            <div className="t-xs t-red">{t('caught.penalty', { days: addDays, plural: addDays > 1 ? 's' : '', itemLabel })}</div>
            {failures >= 3 && (
              <div className="t-xs mt4" style={{ color: 'var(--red)', letterSpacing: '1px', fontWeight: 'bold' }}>
                {t('caught.attemptFatal', { n: failures })}
              </div>
            )}
            {failures === 2 && (
              <div className="t-xs t-red mt4">
                {t('caught.attempt2Warn')}
              </div>
            )}
            {failures === 1 && (
              <div className="t-xs" style={{ color: 'var(--orange)' }}>
                {t('caught.attempt1Warn')}
              </div>
            )}
          </div>
          <button className="px-btn mt8" onClick={() => { setEscapePhase('menu'); setRound(1) }}>
            {t('caught.backButton')}
          </button>
        </div>
      </div>
    )
  }

  // ── ÉVASION RÉUSSIE ───────────────────────────────────────────────────────
  if (escapePhase === 'success') {
    return (
      <div className="layout" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <div className="t-xs t-dim t-center mb8">{t('success.header')}</div>
          <div className="px-box" style={{ borderColor: 'var(--green)', textAlign: 'center', padding: '24px' }}>
            <div className="t-green" style={{ fontSize: '14px', letterSpacing: '2px', marginBottom: '12px' }}>{t('success.title')}</div>
            <div className="t-xs t-dim" style={{ lineHeight: '2.2', marginBottom: '12px' }}>
              {t('success.body')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('success.hp')}</span>
                <span className="t-xs" style={{ color: gs.playerHp < gs.playerMaxHp * 0.3 ? 'var(--red)' : 'var(--green)' }}>{gs.playerHp}/{gs.playerMaxHp}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('success.reputation')}</span>
                <span className="t-xs t-green">+25</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('success.itemsRecovered')}</span>
                <span className="t-xs t-orange">~75%</span>
              </div>
            </div>
          </div>
          <button className="px-btn px-btn--primary mt8" onClick={() => goTo('station-hub')}>
            {t('success.disappearButton')}
          </button>
        </div>
      </div>
    )
  }

  // ── MENU PRINCIPAL ────────────────────────────────────────────────────────
  const pillarKey = PRISON_PILLAR_STATIONS[gs.currentStation]
  const baseRepLoss = 8 + days * 4
  const baseHpPct   = Math.max(0.05, 0.45 - days * 0.05)
  const itemsCount  = (gs.prisonConfiscatedItems?.weapons.length ?? 0)
    + (gs.prisonConfiscatedItems?.armors.length ?? 0)
    + Object.keys(gs.prisonConfiscatedItems?.cargo ?? {}).length

  return (
    <div className="layout">
      <div className="t-center mb8" style={{ letterSpacing: '4px', color: 'var(--red)', fontSize: '9px' }}>
        {t('menu.cellHeader')}
      </div>

      <div className="px-box" style={{ borderColor: 'var(--red)' }}>
        <div className="t-lg t-red t-center mb8">{t('menu.title')}</div>
        <div className="t-xs t-dim mb8" style={{ lineHeight: '2' }}>
          {t('menu.intro')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('menu.daysLeft')}</span>
            <span className="t-xs t-red">{t('menu.daysLeftValue', { days, plural: days > 1 ? 's' : '' })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('menu.hpCurrent')}</span>
            <span className="t-xs" style={{ color: gs.playerHp < gs.playerMaxHp * 0.3 ? 'var(--red)' : 'var(--green)' }}>{gs.playerHp}/{gs.playerMaxHp}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('menu.credits')}</span>
            <span className="t-xs t-gold">{gs.credits.toLocaleString()} cr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('menu.itemsConfiscated')}</span>
            <span className="t-xs t-orange">{t('menu.itemsConfiscatedValue', { count: itemsCount, plural: itemsCount !== 1 ? 's' : '' })}</span>
          </div>
          {failures > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('menu.escapeFailures')}</span>
              <span className="t-xs t-red">{failures}/3 {failures >= 3 ? t('menu.escapeFailuresNextDeath') : failures >= 2 ? t('menu.escapeFailures1chance') : failures >= 1 ? t('menu.escapeFailures2chances') : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Codétenu hostile */}
      {gs.prisonCellmatePending && (
        <div className="px-box" style={{ borderColor: 'var(--orange)' }}>
          <div className="t-xs t-orange mb4">{t('menu.cellmateTitle')}</div>
          <div className="t-xs t-dim mb8" style={{ lineHeight: '2' }}>
            {t('menu.cellmateDesc2')}
          </div>
          <div className="row gap4">
            <button className="px-btn px-btn--danger" style={{ flex: 1 }} onClick={fightCellmate}>
              {t('menu.fightButton')}
            </button>
            <button className="px-btn" style={{ flex: 1, color: 'var(--dim)' }} onClick={ignoreCellmate}>
              {t('menu.ignoreButton')}
            </button>
          </div>
        </div>
      )}

      {/* Message non-libéré */}
      {!freed && msg && (
        <div className="px-box" style={{ borderColor: 'var(--orange)' }}>
          <div className="t-xs t-orange" style={{ lineHeight: '2' }}>{msg}</div>
        </div>
      )}

      {/* Résultat libération */}
      {freed && msg && (
        <div className="col gap4">
          <div className="px-box" style={{ borderColor: 'var(--green)' }}>
            <div className="t-xs t-green mb4">{t('menu.freedTitle')}</div>
            <div className="t-xs" style={{ color: 'var(--green)', lineHeight: '2' }}>{msg}</div>
          </div>
          {dailyLog.length > 0 && (
            <div className="px-box" style={{ borderColor: 'var(--border)', padding: '8px 12px' }}>
              <div className="t-xs t-dim mb4" style={{ letterSpacing: '1px' }}>{t('menu.journalTitle')}</div>
              {dailyLog.map((line, i) => (
                <div key={i} className="t-xs t-dim" style={{ lineHeight: '1.8', borderLeft: '2px solid var(--border)', paddingLeft: '8px', marginBottom: '3px' }}>
                  {line}
                </div>
              ))}
            </div>
          )}
          <button className="px-btn px-btn--primary" onClick={() => goTo('station-hub')}>{t('menu.backToStation')}</button>
        </div>
      )}

      {/* Actions */}
      {!freed && !gs.prisonCellmatePending && (
        <div className="col gap4">
          <div className="px-box" style={{ padding: '8px 12px', borderColor: 'var(--border)' }}>
            <div className="t-xs t-dim mb4" style={{ letterSpacing: '1px' }}>{t('menu.costTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('menu.exitAt')}</span>
                <span className="t-xs t-red">{t('menu.exitAtValue', { pct: Math.round(baseHpPct * 100) })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('menu.reputation')}</span>
                <span className="t-xs t-red">−{baseRepLoss}</span>
              </div>
              {pillarKey && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="t-xs t-dim">{t('menu.standing', { pillar: pillarKey })}</span>
                  <span className="t-xs t-red">−{days * 3}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('menu.itemsReturned')}</span>
                <span className="t-xs t-orange">50%</span>
              </div>
            </div>
          </div>

          <button className="px-btn px-btn--danger" onClick={serveTime}>
            {t('menu.serveButton', { days, plural: days > 1 ? 's' : '' })}
          </button>
          <button className="px-btn" onClick={payCaution} disabled={gs.credits < caution}>
            {t('menu.payCautionButton', { amount: caution.toLocaleString() })}
            {gs.credits < caution ? t('menu.payCautionMissing', { amount: (caution - gs.credits).toLocaleString() }) : ''}
          </button>
          <button className="px-btn" style={{ color: 'var(--cyan)', borderColor: 'var(--cyan)' }}
            onClick={() => {
              patch({ pendingInterrogation: { faction: getStationFactionName(gs.currentStation) ?? t('menu.pleadFaction'), captureStation: gs.currentStation, fromPrison: true } })
              goTo('interrogation')
            }}>
            {t('menu.pleadButton')}
          </button>
          <button className="px-btn" onClick={bribeGuard} disabled={gs.credits < 400}>
            {t('menu.bribeButton', { amount: 400, chance: 50 + (gs.reputation > 40 ? 10 : 0) })}
          </button>
          <button
            className="px-btn"
            style={{ color: failures >= 3 ? 'var(--red)' : 'var(--orange)', borderColor: failures >= 3 ? 'var(--red)' : 'var(--orange)' }}
            onClick={() => { setRound(1); setEscapePhase('playing') }}
          >
            {t('menu.escapeButton', { n: failures + 1 })}
            {failures >= 3 ? t('menu.escapeLastChance') : failures >= 2 ? t('menu.escape1chanceAfter') : failures >= 1 ? t('menu.escape0item') : t('menu.escapeDefault')}
          </button>
        </div>
      )}
    </div>
  )
}
