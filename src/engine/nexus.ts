import type { GameState, NexusWar } from '../types'
import { shiftPillar } from './memoryEvents'
import { arePillarSubBossesCleared, getSubBossProgress } from '../data/subBosses'
import i18n from '../i18n/config'
import { translateStationName } from './goodsI18n'

const nx = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'nexus', ...params })

// ── DÉFINITION DES FRAGMENTS ──────────────────────────────────────────────────

export interface NexusFragment {
  idx: number
  pillar: string
  station: string
  name: string
  lore: string
}

export function getNexusFragments(): NexusFragment[] {
  return [
    { idx: 0, pillar: 'alanossa', station: 'Arc Ouest Apocalypse', name: nx('fragments.alanossa.name'), lore: nx('fragments.alanossa.lore') },
    { idx: 1, pillar: 'cesarion', station: 'Emporium Requiem', name: nx('fragments.cesarion.name'), lore: nx('fragments.cesarion.lore') },
    { idx: 2, pillar: 'raphazarus', station: "L'Arc Perdu", name: nx('fragments.raphazarus.name'), lore: nx('fragments.raphazarus.lore') },
    { idx: 3, pillar: 'scotty', station: 'Scotty Golden North', name: nx('fragments.scotty.name'), lore: nx('fragments.scotty.lore') },
  ]
}

// ── TYPE D'ACTION ─────────────────────────────────────────────────────────────

export type NexusAction =
  | 'force'       // Combat direct
  | 'pay'         // Transaction financière — réservé à Alanossa (200 000 cr, 50/50)
  | 'alliance'    // Relation + standing
  | 'gamble'      // Pari (Scotty)
  | 'steal'       // Vol — déclenché par la visite privée (bonne réputation), pas un bouton direct
  | 'lore'        // (héritage Eliotis — non utilisé)
  | 'war'         // Déclencher une guerre entre deux détenteurs
  | 'manipulate'  // Entourloupe sans combat

export interface NexusResult {
  success: boolean
  message: string
  newGs?: Partial<GameState>
  triggerCombat?: boolean
  pillarBossName?: string
  triggersWar?: { holderA: string; holderB: string }
  spawnsBounty?: boolean
}

export function getActionSuccessChance(idx: number, action: NexusAction): number | null {
  if (action === 'manipulate') return [40, 35, 30, 40][idx] ?? null
  // La guerre ne rend JAMAIS le fragment : elle dresse deux détenteurs l'un
  // contre l'autre et rend celui du perdant accessible plus tard. Afficher un
  // « 60 % » laissait croire à un jet raté alors qu'aucun jet n'a lieu.
  if (action === 'war') return null
  if (action === 'force') return 100
  if (action === 'pay') return idx === 0 ? 50 : 0
  if (action === 'alliance') return 100
  return null
}

export function getChanceLabel(pct: number): { label: string; color: string } {
  if (pct <= 0) return { label: nx('chanceLabels.impossible'), color: 'var(--red)' }
  if (pct <= 25) return { label: nx('chanceLabels.veryRisky'), color: 'var(--red)' }
  if (pct <= 40) return { label: nx('chanceLabels.risky'), color: 'var(--orange)' }
  if (pct <= 60) return { label: nx('chanceLabels.probable'), color: 'var(--cyan)' }
  return { label: nx('chanceLabels.certain'), color: 'var(--green)' }
}

// ── HELPERS INTERNES ──────────────────────────────────────────────────────────

function getStanding(gs: GameState, pillar: string): number {
  return ((gs.pillarStanding ?? {}) as Record<string, number>)[pillar] ?? 0
}

function hasMetHolder(gs: GameState, pillar: string): boolean {
  return (gs.pastDecisions ?? []).some(d => d === `met-${pillar}` || d === `alliance-${pillar}`)
}

// Rivalités d'alliance (relation SYMÉTRIQUE). S'allier à un détenteur devient
// impossible tant qu'une alliance active existe avec l'un de ses rivaux : on ne
// peut pas être l'ami de tout le monde. Trahir le rival rouvre la voie.
const ALLIANCE_RIVALS: Record<string, string[]> = {
  alanossa:   ['cesarion', 'raphazarus'],
  cesarion:   ['alanossa', 'scotty', 'raphazarus'],
  raphazarus: ['alanossa', 'cesarion', 'scotty'],
  scotty:     ['cesarion', 'raphazarus'],
}

const capPillar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

// ── CONDITIONS PAR FRAGMENT ───────────────────────────────────────────────────

export function canAttempt(gs: GameState, idx: number, action: NexusAction): { ok: boolean; reason?: string } {
  const nexusDone = gs.nexusFragments ?? []
  const angered = gs.nexusAngered ?? []
  const decisions = gs.pastDecisions ?? []

  const pillarMap: Record<number, string> = { 0: 'alanossa', 1: 'cesarion', 2: 'raphazarus', 3: 'scotty' }
  const pillar = pillarMap[idx]

  if (pillar) {
    const defeated = gs.subBossesDefeated ?? {}
    if (!arePillarSubBossesCleared(defeated, pillar)) {
      const { done, total } = getSubBossProgress(defeated, pillar)
      return { ok: false, reason: nx('canAttempt.subBossesBlock', { pillar: capPillar(pillar), done, total }) }
    }
  }

  if (pillar && angered.includes(pillar) && action !== 'force')
    return { ok: false, reason: nx('canAttempt.angeredEnemy', { pillar: capPillar(pillar) }) }

  // Exclusivité d'alliance : un détenteur refuse de s'allier si tu es déjà l'allié
  // (non trahi) de l'un de ses rivaux. Impossible de rallier tout le monde.
  if (pillar && action === 'alliance') {
    const alliedRival = (ALLIANCE_RIVALS[pillar] ?? []).find(r =>
      decisions.includes(`alliance-${r}`) && !decisions.includes(`betrayed-${r}`))
    if (alliedRival)
      return { ok: false, reason: nx('canAttempt.allianceRivalBlock', { pillar: capPillar(pillar), rival: capPillar(alliedRival) }) }
  }

  switch (idx) {

    // ── ALANOSSA (guerrière sanguinaire — négociation/manipulation très difficile) ──
    case 0:
      if (action === 'force') return { ok: true }
      if (action === 'pay') {
        if (getStanding(gs, 'alanossa') < -10) return { ok: false, reason: nx('canAttempt.alanossa.payStandingLow') }
        return gs.credits >= 200000 ? { ok: true } : { ok: false, reason: nx('canAttempt.alanossa.payCreditsMissing', { amount: (200000 - gs.credits).toLocaleString() }) }
      }
      if (action === 'alliance') {
        const defeated = gs.subBossesDefeated ?? {}
        const hasProvedCombat = arePillarSubBossesCleared(defeated, 'cesarion') || arePillarSubBossesCleared(defeated, 'scotty')
        const ok = getStanding(gs, 'alanossa') >= 28 && gs.reputation >= 55 && (gs.combatsWon ?? 0) >= 6 && hasProvedCombat
        if (!ok) {
          const m: string[] = []
          if (getStanding(gs, 'alanossa') < 28) m.push(nx('canAttempt.alanossa.allianceStandingLow', { value: getStanding(gs, 'alanossa') }))
          if (gs.reputation < 55) m.push(nx('canAttempt.alanossa.allianceRepLow', { value: gs.reputation }))
          if ((gs.combatsWon ?? 0) < 6) m.push(nx('canAttempt.alanossa.allianceCombatsLow', { value: gs.combatsWon ?? 0 }))
          if (!hasProvedCombat) m.push(nx('canAttempt.alanossa.allianceProofMissing'))
          return { ok: false, reason: m.join(' · ') }
        }
        return { ok: true }
      }
      if (action === 'war') {
        const targets = ['cesarion', 'raphazarus', 'scotty'].filter(p => hasMetHolder(gs, p))
        if (targets.length === 0) return { ok: false, reason: nx('canAttempt.meetAnotherHolder') }
        if (getStanding(gs, 'alanossa') < 5) return { ok: false, reason: nx('canAttempt.alanossa.warStandingLow') }
        return { ok: true }
      }
      if (action === 'manipulate') {
        if (getStanding(gs, 'alanossa') < 20) return { ok: false, reason: nx('canAttempt.alanossa.manipStandingLow', { value: getStanding(gs, 'alanossa') }) }
        if (gs.credits < 7000) return { ok: false, reason: nx('canAttempt.alanossa.manipCreditsLow') }
        if ((gs.combatsWon ?? 0) < 4) return { ok: false, reason: nx('canAttempt.alanossa.manipExperienceLow', { value: gs.combatsWon ?? 0 }) }
        return { ok: true }
      }
      return { ok: false, reason: nx('canAttempt.methodUnavailable') }

    // ── CESARION (guerrier impérial — négociation/manipulation très difficile) ──
    case 1:
      if (action === 'force') {
        if (!gs.equippedWeapon) return { ok: false, reason: nx('canAttempt.cesarion.forceUnarmed') }
        return { ok: true }
      }
      if (action === 'pay') return { ok: false, reason: nx('canAttempt.cesarion.payRefuse') }
      if (action === 'alliance') {
        const defeated = gs.subBossesDefeated ?? {}
        const hasProvedLoyalty = arePillarSubBossesCleared(defeated, 'alanossa') || arePillarSubBossesCleared(defeated, 'raphazarus')
        const ok = getStanding(gs, 'cesarion') >= 45 && gs.factionReputation.emporium >= 35 && gs.completedQuestIds.length >= 3 && hasProvedLoyalty
        if (!ok) {
          const m: string[] = []
          if (getStanding(gs, 'cesarion') < 45) m.push(nx('canAttempt.cesarion.allianceStandingLow', { value: getStanding(gs, 'cesarion') }))
          if (gs.factionReputation.emporium < 35) m.push(nx('canAttempt.cesarion.allianceRepLow', { value: gs.factionReputation.emporium }))
          if (gs.completedQuestIds.length < 3) m.push(nx('canAttempt.cesarion.allianceQuestsLow', { value: gs.completedQuestIds.length }))
          if (!hasProvedLoyalty) m.push(nx('canAttempt.cesarion.allianceProofMissing'))
          return { ok: false, reason: m.join(' · ') }
        }
        return { ok: true }
      }
      if (action === 'war') {
        const targets = ['alanossa', 'raphazarus', 'scotty'].filter(p => hasMetHolder(gs, p))
        if (targets.length === 0) return { ok: false, reason: nx('canAttempt.meetAnotherHolderShort') }
        if (getStanding(gs, 'cesarion') < 5) return { ok: false, reason: nx('canAttempt.cesarion.warStandingLow') }
        return { ok: true }
      }
      if (action === 'manipulate') {
        if (getStanding(gs, 'cesarion') < 25) return { ok: false, reason: nx('canAttempt.cesarion.manipStandingLow', { value: getStanding(gs, 'cesarion') }) }
        if (gs.credits < 10000) return { ok: false, reason: nx('canAttempt.cesarion.manipCreditsLow') }
        if (gs.completedQuestIds.length < 2) return { ok: false, reason: nx('canAttempt.cesarion.manipQuestsLow') }
        return { ok: true }
      }
      return { ok: false, reason: nx('canAttempt.methodUnavailable') }

    // ── RAPHAZARUS ─────────────────────────────────────────────────────────────
    case 2:
      if (!gs.arcPerduUnlocked) return { ok: false, reason: nx('canAttempt.raphazarus.arcLocked') }
      if (action === 'force') {
        if (!gs.equippedWeapon) return { ok: false, reason: nx('canAttempt.raphazarus.forceUnarmed') }
        if (gs.playerHp < gs.playerMaxHp * 0.5) return { ok: false, reason: nx('canAttempt.raphazarus.forceLowHp', { hp: gs.playerHp, maxHp: gs.playerMaxHp }) }
        return { ok: true }
      }
      if (action === 'pay') return { ok: false, reason: nx('canAttempt.raphazarus.payRefuse') }
      if (action === 'alliance') {
        const ok = getStanding(gs, 'raphazarus') >= 40 && (gs.combatsWon ?? 0) >= 8 && nexusDone.length >= 2
        if (!ok) {
          const m: string[] = []
          if (getStanding(gs, 'raphazarus') < 40) m.push(nx('canAttempt.raphazarus.allianceStandingLow', { value: getStanding(gs, 'raphazarus') }))
          if ((gs.combatsWon ?? 0) < 8) m.push(nx('canAttempt.raphazarus.allianceCombatsLow', { value: gs.combatsWon ?? 0 }))
          if (nexusDone.length < 2) m.push(nx('canAttempt.raphazarus.allianceFragmentsLow', { value: nexusDone.length }))
          return { ok: false, reason: m.join(' · ') }
        }
        return { ok: true }
      }
      if (action === 'war') {
        const targets = ['alanossa', 'cesarion', 'scotty'].filter(p => hasMetHolder(gs, p))
        if (targets.length === 0) return { ok: false, reason: nx('canAttempt.meetAnotherHolderShort') }
        if (getStanding(gs, 'raphazarus') < 15) return { ok: false, reason: nx('canAttempt.raphazarus.warStandingLow') }
        return { ok: true }
      }
      if (action === 'manipulate') {
        if (getStanding(gs, 'raphazarus') < 25) return { ok: false, reason: nx('canAttempt.raphazarus.manipStandingLow', { value: getStanding(gs, 'raphazarus') }) }
        if ((gs.combatsWon ?? 0) < 6) return { ok: false, reason: nx('canAttempt.raphazarus.manipExperienceLow', { value: gs.combatsWon ?? 0 }) }
        if (gs.credits < 6000) return { ok: false, reason: nx('canAttempt.raphazarus.manipCreditsLow') }
        return { ok: true }
      }
      return { ok: false, reason: nx('canAttempt.methodUnavailable') }

    // ── SAMY SCOTTY ──────────────────────────────────────────────────────────
    case 3:
      if (action === 'force') return { ok: true }
      if (action === 'pay') return { ok: false, reason: nx('canAttempt.scotty.payRefuse') }
      if (action === 'alliance') {
        const ok = getStanding(gs, 'scotty') >= 25 && gs.day >= 5
        if (!ok) {
          const m: string[] = []
          if (getStanding(gs, 'scotty') < 25) m.push(nx('canAttempt.scotty.allianceStandingLow', { value: getStanding(gs, 'scotty') }))
          if (gs.day < 5) m.push(nx('canAttempt.scotty.allianceDayLow', { day: gs.day }))
          return { ok: false, reason: m.join(' · ') }
        }
        return { ok: true }
      }
      if (action === 'gamble') {
        const wins = gs.scottyGambleWins ?? 0
        const mise = wins === 0 ? 3000 : wins === 1 ? 4000 : 5000
        return gs.credits >= mise ? { ok: true } : { ok: false, reason: nx('canAttempt.scotty.gambleMiseRequired', { amount: mise.toLocaleString(), round: wins + 1 }) }
      }
      if (action === 'war') {
        const targets = ['alanossa', 'cesarion', 'raphazarus'].filter(p => hasMetHolder(gs, p))
        if (targets.length === 0) return { ok: false, reason: nx('canAttempt.meetAnotherHolderShort') }
        if (getStanding(gs, 'scotty') < 5) return { ok: false, reason: nx('canAttempt.scotty.warStandingLow') }
        return { ok: true }
      }
      if (action === 'manipulate') {
        if (getStanding(gs, 'scotty') < 10) return { ok: false, reason: nx('canAttempt.scotty.manipStandingLow', { value: getStanding(gs, 'scotty') }) }
        if (gs.credits < 4000) return { ok: false, reason: nx('canAttempt.scotty.manipCreditsLow') }
        return { ok: true }
      }
      return { ok: false, reason: nx('canAttempt.methodUnavailable') }

    default:
      return { ok: false, reason: 'Fragment inconnu' }
  }
}

// ── TENTATIVE D'OBTENTION ─────────────────────────────────────────────────────

export function attemptNexusFragment(gs: GameState, idx: number, action: NexusAction): NexusResult {
  const check = canAttempt(gs, idx, action)
  if (!check.ok) return { success: false, message: check.reason ?? 'Conditions non remplies.' }

  const decisions = gs.pastDecisions ?? []

  function angeredAdd(pillar: string): string[] {
    return [...(gs.nexusAngered ?? []).filter(p => p !== pillar), pillar]
  }

  switch (idx) {

    // ── ALANOSSA ──────────────────────────────────────────────────────────────
    case 0:
      if (action === 'force')
        return { success: true, message: nx('attempt.alanossa.force'), triggerCombat: true, pillarBossName: 'Alanossa' }
      if (action === 'pay')
        {
          const ok = Math.random() < 0.5
          if (ok) return { success: true, message: nx('attempt.alanossa.paySuccess'), newGs: { credits: gs.credits - 200000, pillarStanding: shiftPillar(gs, 'alanossa', +5) } }
          return { success: false, message: nx('attempt.alanossa.payFail'), newGs: { credits: gs.credits - 200000, pillarStanding: shiftPillar(gs, 'alanossa', -5) } }
        }
      if (action === 'alliance')
        return { success: true, message: nx('attempt.alanossa.alliance'), newGs: { pillarStanding: shiftPillar(gs, 'alanossa', +15), pastDecisions: [...decisions.filter(d => d !== 'alliance-alanossa'), 'alliance-alanossa'] } }
      if (action === 'war') {
        const targets = ['cesarion', 'raphazarus', 'scotty'].filter(p => hasMetHolder(gs, p))
        const target = targets[Math.floor(Math.random() * targets.length)]
        return { success: false, message: nx('attempt.alanossa.war', { target: capPillar(target) }), triggersWar: { holderA: 'alanossa', holderB: target }, newGs: { pillarStanding: shiftPillar(gs, 'alanossa', -5) } }
      }
      if (action === 'manipulate') {
        const ok = Math.random() < 0.40
        if (ok) return { success: true, message: nx('attempt.alanossa.manipSuccess'), newGs: { credits: gs.credits - 7000, pillarStanding: shiftPillar(gs, 'alanossa', -10) } }
        return { success: false, message: nx('attempt.alanossa.manipFail'), triggerCombat: true, pillarBossName: 'Alanossa', newGs: { credits: gs.credits - 7000, pillarStanding: shiftPillar(gs, 'alanossa', -25), nexusAngered: angeredAdd('alanossa') } }
      }
      break

    // ── CESARION ──────────────────────────────────────────────────────────────
    case 1:
      if (action === 'force')
        return { success: true, message: nx('attempt.cesarion.force'), triggerCombat: true, pillarBossName: 'Cesarion' }
      if (action === 'alliance')
        return { success: true, message: nx('attempt.cesarion.alliance'), newGs: { pillarStanding: shiftPillar(gs, 'cesarion', +20), factionReputation: { ...gs.factionReputation, emporium: gs.factionReputation.emporium + 15 }, pastDecisions: [...decisions.filter(d => d !== 'alliance-cesarion'), 'alliance-cesarion'] } }
      if (action === 'war') {
        const targets = ['alanossa', 'raphazarus', 'scotty'].filter(p => hasMetHolder(gs, p))
        const target = targets[Math.floor(Math.random() * targets.length)]
        return { success: false, message: nx('attempt.cesarion.war', { target: capPillar(target) }), triggersWar: { holderA: 'cesarion', holderB: target }, newGs: { pillarStanding: shiftPillar(gs, 'cesarion', -5) } }
      }
      if (action === 'manipulate') {
        const ok = Math.random() < 0.35
        if (ok) return { success: true, message: nx('attempt.cesarion.manipSuccess'), newGs: { credits: gs.credits - 10000, pillarStanding: shiftPillar(gs, 'cesarion', -5) } }
        return { success: false, message: nx('attempt.cesarion.manipFail'), triggerCombat: true, pillarBossName: 'Cesarion', newGs: { credits: gs.credits - 10000, pillarStanding: shiftPillar(gs, 'cesarion', -30), nexusAngered: angeredAdd('cesarion') } }
      }
      break

    // ── RAPHAZARUS ─────────────────────────────────────────────────────────────
    case 2:
      if (action === 'force')
        return { success: true, message: nx('attempt.raphazarus.force'), triggerCombat: true, pillarBossName: 'Raphazarus' }
      if (action === 'alliance')
        return { success: true, message: gs.nexusFragments.length >= 3 ? nx('attempt.raphazarus.allianceLateGame') : nx('attempt.raphazarus.allianceEarlyGame'), newGs: { pillarStanding: shiftPillar(gs, 'raphazarus', +25), reputation: gs.reputation + 20, pastDecisions: [...decisions.filter(d => d !== 'alliance-raphazarus'), 'alliance-raphazarus'] } }
      if (action === 'war') {
        const targets = ['alanossa', 'cesarion', 'scotty'].filter(p => hasMetHolder(gs, p))
        const target = targets[Math.floor(Math.random() * targets.length)]
        return { success: false, message: nx('attempt.raphazarus.war', { target: capPillar(target) }), triggersWar: { holderA: 'raphazarus', holderB: target }, newGs: { pillarStanding: shiftPillar(gs, 'raphazarus', -8) } }
      }
      if (action === 'manipulate') {
        const ok = Math.random() < 0.30
        if (ok) return { success: true, message: nx('attempt.raphazarus.manipSuccess'), newGs: { credits: gs.credits - 6000, pillarStanding: shiftPillar(gs, 'raphazarus', -20) } }
        return { success: false, message: nx('attempt.raphazarus.manipFail'), triggerCombat: true, pillarBossName: 'Raphazarus', newGs: { credits: gs.credits - 6000, pillarStanding: shiftPillar(gs, 'raphazarus', -35), nexusAngered: angeredAdd('raphazarus') } }
      }
      break

    // ── SAMY SCOTTY ───────────────────────────────────────────────────────────
    case 3:
      if (action === 'force')
        return { success: true, message: nx('attempt.scotty.force'), triggerCombat: true, pillarBossName: 'Samy Scotty' }
      if (action === 'alliance')
        return { success: true, message: nx('attempt.scotty.alliance'), newGs: { pillarStanding: shiftPillar(gs, 'scotty', +15), pastDecisions: [...decisions.filter(d => d !== 'alliance-scotty'), 'alliance-scotty'] } }
      if (action === 'gamble') {
        const wins = gs.scottyGambleWins ?? 0
        const round = wins + 1
        const mise = wins === 0 ? 3000 : wins === 1 ? 4000 : 5000
        const winChance = wins === 0 ? 0.40 : wins === 1 ? 0.35 : 0.30
        const win = Math.random() < winChance

        const ROUND_GAMES = nx('attempt.scotty.gambleGames', { returnObjects: true }) as unknown as { name: string; winMsg: string; loseMsg: string }[]
        const game = ROUND_GAMES[Math.min(wins, ROUND_GAMES.length - 1)]

        if (win) {
          if (round >= 3) {
            return { success: true, message: nx('attempt.scotty.gambleWin3', { round, game: game.name, winMsg: game.winMsg }), newGs: { scottyGambleWins: 3, pillarStanding: shiftPillar(gs, 'scotty', +10) } }
          }
          return { success: false, message: nx('attempt.scotty.gambleWinNext', { round, game: game.name, winMsg: game.winMsg }), newGs: { scottyGambleWins: wins + 1 } }
        }
        return { success: false, message: nx('attempt.scotty.gambleLose', { round, game: game.name, loseMsg: game.loseMsg, amount: mise.toLocaleString() }), newGs: { credits: gs.credits - mise, scottyGambleWins: 0 } }
      }
      if (action === 'war') {
        const targets = ['alanossa', 'cesarion', 'raphazarus'].filter(p => hasMetHolder(gs, p))
        const target = targets[Math.floor(Math.random() * targets.length)]
        return { success: false, message: nx('attempt.scotty.war', { target: capPillar(target) }), triggersWar: { holderA: 'scotty', holderB: target }, newGs: { pillarStanding: shiftPillar(gs, 'scotty', -5) } }
      }
      if (action === 'manipulate') {
        const ok = Math.random() < 0.60
        if (ok) return { success: true, message: nx('attempt.scotty.manipSuccess'), newGs: { credits: gs.credits - 4000, pillarStanding: shiftPillar(gs, 'scotty', -5) } }
        return { success: false, message: nx('attempt.scotty.manipFail'), newGs: { credits: gs.credits - 4000, pillarStanding: shiftPillar(gs, 'scotty', -15) } }
      }
      break
  }

  return { success: false, message: nx('attempt.unknownFragment') }
}

// ── RÉSOLUTION DES GUERRES ────────────────────────────────────────────────────

const PILLAR_TO_FRAGMENT_IDX: Record<string, number> = { alanossa: 0, cesarion: 1, raphazarus: 2, scotty: 3 }

export function resolveNexusWars(gs: GameState): { gs: Partial<GameState>; messages: string[] } {
  const wars = gs.nexusWars ?? []
  if (wars.length === 0) return { gs: {}, messages: [] }

  const messages: string[] = []
  const resolvedWars: NexusWar[] = []
  let patchGs: Partial<GameState> = {}

  for (const war of wars) {
    if (war.resolved) { resolvedWars.push(war); continue }
    if (gs.day - war.startDay < 4) { resolvedWars.push(war); continue }

    const winnerPillar = Math.random() < 0.5 ? war.holderA : war.holderB
    const loserPillar  = winnerPillar === war.holderA ? war.holderB : war.holderA
    const loserFragIdx = PILLAR_TO_FRAGMENT_IDX[loserPillar]

    resolvedWars.push({ ...war, resolved: true, winner: winnerPillar, loser: loserPillar, fragIdxLoser: loserFragIdx })

    const wName = capPillar(winnerPillar)
    const lName = capPillar(loserPillar)
    messages.push(nx('wars.resolved', { winner: wName, loser: lName }))

    const standing = { ...(gs.pillarStanding ?? {}) } as Record<string, number>
    standing[winnerPillar] = (standing[winnerPillar] ?? 0) - 20
    standing[loserPillar]  = (standing[loserPillar]  ?? 0) - 40

    patchGs = { ...patchGs, pillarStanding: standing as GameState['pillarStanding'], nexusAngered: [...(gs.nexusAngered ?? []), loserPillar] }
  }

  return { gs: { ...patchGs, nexusWars: resolvedWars }, messages }
}

export function getWarAvailableFragments(gs: GameState): number[] {
  const wars = gs.nexusWars ?? []
  const collected = gs.nexusFragments ?? []
  return wars
    .filter(w => w.resolved && w.fragIdxLoser !== undefined && !collected.includes(w.fragIdxLoser!))
    .map(w => w.fragIdxLoser!)
}

// ── HELPERS UI ────────────────────────────────────────────────────────────────

export function isFragmentAvailable(gs: GameState, idx: number): boolean {
  const f = getNexusFragments()[idx]
  if ((gs.nexusFragments ?? []).includes(idx)) return false
  return gs.currentStation === f.station || getWarAvailableFragments(gs).includes(idx)
}

export function getFragmentStatusLabel(gs: GameState, idx: number): string {
  if ((gs.nexusFragments ?? []).includes(idx)) return nx('fragmentStatus.collected')
  if (getWarAvailableFragments(gs).includes(idx)) return nx('fragmentStatus.recoverableWar')
  if (gs.currentStation === getNexusFragments()[idx].station) return nx('fragmentStatus.available')
  return translateStationName(getNexusFragments()[idx].station)
}

export function getPillarStandingLabel(gs: GameState, pillar: keyof NonNullable<GameState['pillarStanding']>): string {
  const v = ((gs.pillarStanding ?? {}) as Record<string, number>)[pillar] ?? 0
  if (v >= 60) return nx('standingLabels.allie')
  if (v >= 30) return nx('standingLabels.respecte')
  if (v >= 10) return nx('standingLabels.connu')
  if (v >= -10) return nx('standingLabels.neutre')
  if (v >= -30) return nx('standingLabels.mefiant')
  return nx('standingLabels.ennemi')
}

// ── CONSÉQUENCES DE LA MORT D'UN SOUS-BOSS ────────────────────────────────────
// Tuer un sous-boss n'est jamais anodin : on attire l'attention du boss du pilier,
// ce qui peut déclencher des ralliements (le boss appelle un rival en renfort) ou
// des discussions (un rival en froid avec lui te voit comme un allié potentiel).

const PILLAR_BOSS_NAME: Record<string, string> = {
  alanossa: 'Alanossa', cesarion: 'Cesarion', raphazarus: 'Raphazarus', scotty: 'Samy Scotty',
}
const PILLAR_RIVALS: Record<string, string[]> = {
  alanossa: ['cesarion', 'raphazarus'],
  cesarion: ['alanossa', 'scotty'],
  raphazarus: ['alanossa', 'cesarion'],
  scotty:   ['raphazarus', 'cesarion'],
}

export function getSubBossKillConsequence(
  gs: GameState,
  pillar: string,
  fullyCleared: boolean,
): { patch: Partial<GameState>; message: string } {
  const standing = { ...((gs.pillarStanding ?? {}) as Record<string, number>) }
  const bossName = PILLAR_BOSS_NAME[pillar] ?? pillar
  const lines: string[] = []

  // 1) Attention du boss principal — il sait désormais qui tu es.
  const baseHit = fullyCleared ? -18 : -8
  standing[pillar] = (standing[pillar] ?? 0) + baseHit
  lines.push(fullyCleared
    ? nx('subBossKill.allDefeated', { boss: bossName })
    : nx('subBossKill.oneDefeated', { boss: bossName }))

  // 2) Ralliement ou discussion avec un rival "en froid".
  const rivals = PILLAR_RIVALS[pillar] ?? []
  const rival = rivals[Math.floor(Math.random() * rivals.length)]
  const decisions = [...(gs.pastDecisions ?? [])]
  const patch: Partial<GameState> = {}

  if (rival) {
    const rivalName = PILLAR_BOSS_NAME[rival] ?? rival
    const r = Math.random()
    if (r < 0.45) {
      // Le boss rallie un rival contre toi.
      standing[rival] = (standing[rival] ?? 0) - 6
      lines.push(nx('subBossKill.rivalRallied', { boss: bossName, rival: rivalName }))
    } else if (r < 0.80) {
      // Un rival en froid te voit comme un allié potentiel — ouverture de discussion.
      standing[rival] = (standing[rival] ?? 0) + 8
      decisions.push(`met-${rival}`)
      lines.push(nx('subBossKill.rivalOpening', { boss: bossName, rival: rivalName }))
    } else {
      // Le boss redouble simplement de vigilance.
      lines.push(nx('subBossKill.vigilance', { boss: bossName }))
    }
  }

  patch.pillarStanding = standing as GameState['pillarStanding']
  if (decisions.length !== (gs.pastDecisions ?? []).length) patch.pastDecisions = decisions

  return { patch, message: lines.join('\n') }
}

// ── BOUNTY HUNTERS DES DÉTENTEURS ─────────────────────────────────────────────

export function getHolderBountyHunters(): Record<string, { name: string; threatLevel: 1 | 2 | 3 | 4 | 5; description: string }> {
  return {
    alanossa: { name: nx('bountyHunters.alanossa.name'), threatLevel: 4, description: nx('bountyHunters.alanossa.description') },
    cesarion: { name: nx('bountyHunters.cesarion.name'), threatLevel: 5, description: nx('bountyHunters.cesarion.description') },
    raphazarus: { name: nx('bountyHunters.raphazarus.name'), threatLevel: 5, description: nx('bountyHunters.raphazarus.description') },
    scotty: { name: nx('bountyHunters.scotty.name'), threatLevel: 3, description: nx('bountyHunters.scotty.description') },
  }
}

// ── SYSTÈME DE DÉCOUVERTE DE L'ARC PERDU ─────────────────────────────────────

export interface ArcPerduClue {
  id: string
  station: string
  npcName: string
  dialogue: string
  clueText: string
  requirement?: { credits?: number; reputation?: number; standing?: number }
}

const CLUES_NEEDED = 4

export function getArcPerduClues(): ArcPerduClue[] {
  return [
    { id: 'clue-cendres', station: 'Les Cendres', npcName: 'Le Vieux Caporal', dialogue: nx('clues.clueCendres.dialogue'), clueText: nx('clues.clueCendres.clueText') },
    { id: 'clue-fantome', station: 'Station Fantôme', npcName: 'La Mécanicienne Muette', dialogue: nx('clues.clueFantome.dialogue'), clueText: nx('clues.clueFantome.clueText'), requirement: { reputation: 25 } },
    { id: 'clue-forge', station: 'La Forge des Damnés', npcName: "L'Armurier du Général", dialogue: nx('clues.clueForge.dialogue'), clueText: nx('clues.clueForge.clueText'), requirement: { credits: 2000 } },
    { id: 'clue-exilee', station: 'La Forteresse Exilée', npcName: 'Le Déserteur Repenti', dialogue: nx('clues.clueExilee.dialogue'), clueText: nx('clues.clueExilee.clueText'), requirement: { reputation: 35 } },
    { id: 'clue-quarantaine', station: 'Station Quarantaine', npcName: 'Le Médecin de Guerre', dialogue: nx('clues.clueQuarantaine.dialogue'), clueText: nx('clues.clueQuarantaine.clueText') },
    { id: 'clue-velkor', station: 'Les Abysses de Velkor', npcName: "L'Exploratrice des Abysses", dialogue: nx('clues.clueVelkor.dialogue'), clueText: nx('clues.clueVelkor.clueText'), requirement: { credits: 1500 } },
  ]
}

export function getAvailableClues(gs: GameState): ArcPerduClue[] {
  if (gs.arcPerduUnlocked) return []
  const collected = gs.arcPerduClues ?? []
  return getArcPerduClues().filter(c =>
    c.station === gs.currentStation && !collected.includes(c.id)
  )
}

export function canCollectClue(gs: GameState, clue: ArcPerduClue): { ok: boolean; reason?: string } {
  if (!clue.requirement) return { ok: true }
  const m: string[] = []
  if (clue.requirement.credits && gs.credits < clue.requirement.credits)
    m.push(nx('clueRequirements.credits', { amount: clue.requirement.credits }))
  if (clue.requirement.reputation && gs.reputation < clue.requirement.reputation)
    m.push(nx('clueRequirements.reputation', { value: gs.reputation, needed: clue.requirement.reputation }))
  if (clue.requirement.standing) {
    const s = ((gs.pillarStanding ?? {}) as Record<string, number>)['raphazarus'] ?? 0
    if (s < clue.requirement.standing) m.push(nx('clueRequirements.standing', { value: s, needed: clue.requirement.standing }))
  }
  return m.length > 0 ? { ok: false, reason: m.join(' · ') } : { ok: true }
}

export function collectClue(gs: GameState, clueId: string): { gs: Partial<GameState>; unlocked: boolean; message: string } {
  const clue = getArcPerduClues().find(c => c.id === clueId)
  if (!clue) return { gs: {}, unlocked: false, message: '' }

  const newClues = [...(gs.arcPerduClues ?? []), clueId]
  const creditCost = clue.requirement?.credits ?? 0
  const unlocked = newClues.length >= CLUES_NEEDED

  return {
    gs: {
      arcPerduClues: newClues,
      credits: gs.credits - creditCost,
      ...(unlocked ? { arcPerduUnlocked: true } : {}),
    },
    unlocked,
    message: unlocked
      ? nx('clueMessages.unlocked')
      : nx('clueMessages.collected', { count: newClues.length, needed: CLUES_NEEDED, clueText: clue.clueText }),
  }
}

// ── GUERRIERS DE RAPHAZARUS (intercepteurs) ──────────────────────────────────

export function shouldSpawnRaphazarusWarrior(gs: GameState): boolean {
  if (!gs.raphazarusActivated) return false
  if ((gs.nexusFragments ?? []).includes(2)) return false
  if (gs.raphazarusWarriorDay === gs.day) return false
  return Math.random() < 0.25
}

export function getRaphazarusWarriors() {
  return [
    { name: nx('warriors.eclaireur.name'), maxHp: 120, damageMin: 18, damageMax: 35, lootMin: 800, lootMax: 1800, description: nx('warriors.eclaireur.description'), captureChance: 0, killChance: 20, isBoss: false, role: 'normal' as const },
    { name: nx('warriors.veteran.name'), maxHp: 180, damageMin: 25, damageMax: 48, lootMin: 1500, lootMax: 3500, description: nx('warriors.veteran.description'), captureChance: 5, killChance: 25, isBoss: false, role: 'tank' as const },
    { name: nx('warriors.assassin.name'), maxHp: 140, damageMin: 30, damageMax: 55, lootMin: 2000, lootMax: 4500, description: nx('warriors.assassin.description'), captureChance: 0, killChance: 35, isBoss: false, role: 'ranged' as const },
  ]
}

export function rollRaphazarusWarrior(gs: GameState): ReturnType<typeof getRaphazarusWarriors>[number] {
  const warriors = getRaphazarusWarriors()
  const fragmentCount = (gs.nexusFragments ?? []).length
  const idx = Math.min(fragmentCount, warriors.length - 1)
  return warriors[idx]
}
