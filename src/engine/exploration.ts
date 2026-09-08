import type { GameState, Quest, QuestType } from '../types'
import { getRandomUndiscoveredFragment } from '../data/loreFragments'
import { getStation, getAccessibleStations } from '../data/stations'
import { rollWeaponForTier } from '../data/weapons'
import {
  getJsonWanderLow, getJsonWanderMid, getJsonWanderHigh, getJsonWanderExtreme,
  getJsonExploreDangerous, getJsonExplorePeaceful, getJsonExploreIndustrial,
  getJsonExploreScientific, getJsonExploreRuins, getJsonExploreMilitary,
  getJsonExploreLuxury, getJsonExploreGeneric,
} from './jsonEventLoader'
import { rollMemoryEvent, addDecision, shiftPillar } from './memoryEvents'
import { addJournal } from './journal'
import i18n from '../i18n/config'
import { translateStationName } from './goodsI18n'

const st = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'explorationScenes', ...params })

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

export type ExploreResult =
  | { type: 'combat'; depth: number }
  | { type: 'boss' }
  | { type: 'loot'; credits: number; description: string; loreFragmentId?: string }
  | { type: 'item'; item: string; qty: number; description: string; loreFragmentId?: string }
  | { type: 'fuel'; amount: number; description: string; loreFragmentId?: string }
  | { type: 'event'; description: string; choices: ExploreChoice[]; loreFragmentId?: string; rare?: boolean }
  | { type: 'nothing'; description: string; loreFragmentId?: string }

export interface ExploreChoice {
  label: string
  hint?: string
  result: (gs: GameState) => { gs: Partial<GameState>; message: string; minigame?: 'lockpick'; minigameReward?: Partial<GameState> }
  available?: (gs: GameState) => boolean
}

// Scènes par type de zone
const SCENES_DANGEROUS: Array<() => ExploreResult> = [
  () => ({
    type: 'event',
    description: st('dangerous.0.desc'),
    choices: [
      {
        label: st('dangerous.0.c0'),
        result: () => {
          const cr = rng(80, 300)
          return { gs: { credits: cr }, message: st('dangerous.0.c0msg', { cr }) }
        }
      },
      {
        label: st('dangerous.0.c1'),
        result: (gs) => ({ gs: { reputation: gs.reputation + 5 }, message: st('dangerous.0.c1msg') })
      },
      {
        label: st('dangerous.0.c2'),
        result: () => ({ gs: {}, message: st('dangerous.0.c2msg') })
      }
    ]
  }),
  () => ({
    type: 'event',
    description: st('dangerous.1.desc'),
    choices: [
      {
        label: st('dangerous.1.c0'),
        result: () => ({ gs: {}, message: st('dangerous.1.c0msg') })
      },
      {
        label: st('dangerous.1.c1'),
        result: (gs) => {
          const ok = Math.random() < 0.3 + gs.reputation / 200
          return ok
            ? { gs: { reputation: gs.reputation + 15, credits: gs.credits + rng(200, 500) }, message: st('dangerous.1.c1msgWin') }
            : { gs: { playerHp: Math.max(1, gs.playerHp - rng(10, 25)) }, message: st('dangerous.1.c1msgLose') }
        }
      },
      {
        label: st('dangerous.1.c2'),
        result: () => {
          const cr = rng(150, 500)
          return { gs: { credits: cr }, message: st('dangerous.1.c2msg', { cr }) }
        }
      }
    ]
  }),
  () => ({ type: 'loot', credits: rng(100, 400), description: st('dangerous.2.desc') }),
  () => ({ type: 'combat', depth: 0 }),
  () => ({
    type: 'event',
    description: st('dangerous.4.desc'),
    choices: [
      { label: st('dangerous.4.c0'), result: () => ({ gs: { cargo: {} }, message: st('dangerous.4.c0msg') }) },
      { label: st('dangerous.4.c1'), result: () => ({ gs: {}, message: st('dangerous.4.c1msg') }) }
    ]
  }),
  () => ({ type: 'nothing', description: st('dangerous.5.desc') }),
  () => ({ type: 'loot', credits: rng(50, 200), description: st('dangerous.6.desc') }),
  () => ({
    type: 'event',
    description: st('dangerous.7.desc'),
    choices: [
      { label: st('dangerous.7.c0'), result: (gs) => ({ gs: { playerHp: Math.max(1, gs.playerHp - 15), credits: gs.credits + rng(200, 600) }, message: st('dangerous.7.c0msg') }) },
      { label: st('dangerous.7.c1'), result: (gs) => ({ gs: {}, message: '', minigame: 'lockpick' as const, minigameReward: { credits: gs.credits + rng(300, 800) } }) },
      { label: st('dangerous.7.c2'), result: () => ({ gs: {}, message: st('dangerous.7.c2msg') }) }
    ]
  }),
  // ── PIÈGES ZONES DANGEREUSES ──
  () => ({
    type: 'event',
    description: st('dangerous.8.desc'),
    choices: [
      {
        label: st('dangerous.8.c0'),
        result: (gs) => Math.random() < 0.30
          ? { gs: { playerHp: Math.max(1, gs.playerHp - rng(10, 22)) }, message: st('dangerous.8.c0msgWin') }
          : { gs: { pendingInterrogation: { faction: 'Milice locale', captureStation: gs.currentStation }, screen: 'interrogation' as const }, message: st('dangerous.8.c0msgLose') }
      },
      {
        label: st('dangerous.8.c1'),
        result: (gs) => ({ gs: { pendingInterrogation: { faction: 'Milice locale', captureStation: gs.currentStation }, screen: 'interrogation' as const }, message: st('dangerous.8.c1msg') })
      },
      {
        label: st('dangerous.8.c2'),
        result: (gs) => ({ gs: { isImprisoned: true as const, prisonDaysLeft: rng(2, 5), screen: 'prison' as const, playerHp: Math.max(1, gs.playerHp - rng(25, 45)), reputation: gs.reputation - 20 }, message: st('dangerous.8.c2msg') })
      }
    ]
  }),
  () => ({
    type: 'event',
    description: st('dangerous.9.desc'),
    choices: [
      {
        label: st('dangerous.9.c0'),
        result: (gs) => Math.random() < 0.40
          ? { gs: { playerHp: Math.max(1, gs.playerHp - rng(8, 18)) }, message: st('dangerous.9.c0msgWin') }
          : { gs: { isImprisoned: true as const, prisonDaysLeft: rng(1, 3), screen: 'prison' as const, credits: Math.max(0, gs.credits - rng(100, 400)) }, message: st('dangerous.9.c0msgLose') }
      },
      {
        label: st('dangerous.9.c1'),
        result: (gs) => ({ gs: { isImprisoned: true as const, prisonDaysLeft: rng(1, 2), screen: 'prison' as const }, message: st('dangerous.9.c1msg') })
      }
    ]
  }),
]

const SCENES_PEACEFUL: Array<() => ExploreResult> = [
  () => ({ type: 'loot', credits: rng(60, 200), description: st('peaceful.0.desc') }),
  () => ({
    type: 'event',
    description: st('peaceful.1.desc'),
    choices: [
      { label: st('peaceful.1.c0'), result: (gs) => gs.credits >= 120 ? { gs: { credits: gs.credits - 120, cargo: { ...gs.cargo, 'Médicaments': (gs.cargo['Médicaments'] ?? 0) + 2 } }, message: st('peaceful.1.c0msg') } : { gs: {}, message: st('peaceful.1.c0fail') } },
      { label: st('peaceful.1.c1'), result: (gs) => gs.credits >= 60 ? { gs: { credits: gs.credits - 60, cargo: { ...gs.cargo, 'Nourriture fraîche': (gs.cargo['Nourriture fraîche'] ?? 0) + 3 } }, message: st('peaceful.1.c1msg') } : { gs: {}, message: st('peaceful.1.c1fail') } },
      { label: st('peaceful.1.c2'), result: () => ({ gs: {}, message: st('peaceful.1.c2msg') }) }
    ]
  }),
  () => ({ type: 'nothing', description: st('peaceful.2.desc') }),
  () => ({ type: 'item', item: 'Médicaments', qty: 1, description: st('peaceful.3.desc') }),
  () => ({
    type: 'event',
    description: st('peaceful.4.desc'),
    choices: [
      { label: st('peaceful.4.c0'), result: (gs) => ({ gs: { reputation: gs.reputation + 8, credits: gs.credits + rng(100, 300) }, message: st('peaceful.4.c0msg') }) },
      { label: st('peaceful.4.c1'), result: () => ({ gs: {}, message: st('peaceful.4.c1msg') }) }
    ]
  }),
  () => ({ type: 'nothing', description: st('peaceful.5.desc') }),
  () => ({ type: 'fuel', amount: 1, description: st('peaceful.6.desc') }),
]

const SCENES_INDUSTRIAL: Array<() => ExploreResult> = [
  () => ({ type: 'loot', credits: rng(100, 350), description: st('industrial.0.desc') }),
  () => ({ type: 'item', item: 'Métaux bruts', qty: 2, description: st('industrial.1.desc') }),
  () => ({
    type: 'event',
    description: st('industrial.2.desc'),
    choices: [
      { label: st('industrial.2.c0'), result: (gs) => gs.credits >= 50 ? { gs: { credits: gs.credits - 50 }, message: st('industrial.2.c0msg') } : { gs: {}, message: st('industrial.2.c0fail') } },
      { label: st('industrial.2.c1'), result: () => ({ gs: {}, message: st('industrial.2.c1msg') }) },
      { label: st('industrial.2.c2'), result: (gs) => ({ gs: { playerHp: Math.max(1, gs.playerHp - rng(8, 20)), reputation: gs.reputation - 5 }, message: st('industrial.2.c2msg') }) }
    ]
  }),
  () => ({ type: 'combat', depth: 0 }),
  () => ({ type: 'nothing', description: st('industrial.4.desc') }),
  () => ({ type: 'item', item: 'Composants électroniques', qty: 1, description: st('industrial.5.desc') }),
  () => ({ type: 'fuel', amount: 2, description: st('industrial.6.desc') }),
]

const SCENES_RUINS: Array<() => ExploreResult> = [
  () => ({ type: 'loot', credits: rng(150, 500), description: st('ruins.0.desc') }),
  () => ({
    type: 'event',
    description: st('ruins.1.desc'),
    choices: [
      { label: st('ruins.1.c0'), result: () => { const r = Math.random(); return r < 0.4 ? { gs: { credits: rng(200, 700) as number }, message: st('ruins.1.c0msgFound', { cr: rng(200, 700) }) } : r < 0.7 ? { gs: {}, message: st('ruins.1.c0msgNothing') } : { gs: { playerHp: 0 }, message: st('ruins.1.c0msgTrap') } } },
      { label: st('ruins.1.c1'), result: (gs) => ({ gs: { reputation: gs.reputation + 3 }, message: st('ruins.1.c1msg') }) }
    ]
  }),
  () => ({ type: 'nothing', description: st('ruins.2.desc') }),
  () => ({ type: 'combat', depth: 0 }),
  () => ({ type: 'item', item: 'Artefacts', qty: 1, description: st('ruins.4.desc') }),
  () => ({
    type: 'event',
    description: st('ruins.5.desc'),
    choices: [
      { label: st('ruins.5.c0'), result: (gs) => ({ gs: { credits: gs.credits + rng(200, 600), reputation: gs.reputation + 10 }, message: st('ruins.5.c0msg') }) },
      { label: st('ruins.5.c1'), result: () => ({ gs: {}, message: st('ruins.5.c1msg') }) }
    ]
  }),
  // ── PIÈGES RUINES ──
  () => ({
    type: 'event',
    description: st('ruins.6.desc'),
    choices: [
      {
        label: st('ruins.6.c0'),
        result: (gs) => Math.random() < 0.20
          ? { gs: { playerHp: Math.max(1, gs.playerHp - rng(35, 55)) }, message: st('ruins.6.c0msgWin') }
          : { gs: { isDead: true as const, deathCause: st('ruins.6.deathCause') }, message: st('ruins.6.c0msgLose') }
      },
      {
        label: st('ruins.6.c1'),
        result: () => ({ gs: { isDead: true as const, deathCause: st('ruins.6.deathCause') }, message: st('ruins.6.c1msg') })
      }
    ]
  }),
  () => ({
    type: 'event',
    description: st('ruins.7.desc'),
    choices: [
      {
        label: st('ruins.7.c0'),
        result: (gs) => Math.random() < 0.25
          ? { gs: { playerHp: Math.max(1, gs.playerHp - rng(20, 40)) }, message: st('ruins.7.c0msgWin') }
          : { gs: { isImprisoned: true as const, prisonDaysLeft: rng(2, 4), screen: 'prison' as const, credits: Math.max(0, gs.credits - rng(200, 500)), reputation: gs.reputation - 10 }, message: st('ruins.7.c0msgLose') }
      },
      {
        label: st('ruins.7.c1'),
        result: (gs) => ({ gs: { isImprisoned: true as const, prisonDaysLeft: rng(1, 3), screen: 'prison' as const }, message: st('ruins.7.c1msg') })
      }
    ]
  }),
]

const SCENES_MILITARY: Array<() => ExploreResult> = [
  () => ({ type: 'combat', depth: 0 }),
  () => ({
    type: 'event',
    description: st('military.1.desc'),
    choices: [
      { label: st('military.1.c0'), result: (gs) => Math.random() < 0.5 + gs.reputation / 200 ? { gs: { reputation: gs.reputation + 5 }, message: st('military.1.c0msgWin') } : { gs: { playerHp: Math.max(1, gs.playerHp - rng(10, 20)) }, message: st('military.1.c0msgLose') } },
      { label: st('military.1.c1'), result: () => ({ gs: {}, message: st('military.1.c1msg') }) },
      { label: st('military.1.c2'), result: (gs) => gs.credits >= 200 ? { gs: { credits: gs.credits - 200 }, message: st('military.1.c2msg') } : { gs: {}, message: st('military.1.c2fail') } }
    ]
  }),
  () => ({ type: 'loot', credits: rng(200, 600), description: st('military.2.desc') }),
  () => ({ type: 'item', item: 'Munitions', qty: 2, description: st('military.3.desc') }),
  () => ({ type: 'nothing', description: st('military.4.desc') }),
  () => ({ type: 'combat', depth: 0 }),
]

const SCENES_LUXURY: Array<() => ExploreResult> = [
  () => ({ type: 'loot', credits: rng(200, 700), description: st('luxury.0.desc') }),
  () => ({
    type: 'event',
    description: st('luxury.1.desc'),
    choices: [
      { label: st('luxury.1.c0'), result: (gs) => ({ gs: { credits: gs.credits + 500, reputation: gs.reputation - 5 }, message: st('luxury.1.c0msg') }) },
      { label: st('luxury.1.c1'), result: () => ({ gs: {}, message: st('luxury.1.c1msg') }) }
    ]
  }),
  () => ({ type: 'nothing', description: st('luxury.2.desc') }),
  () => ({ type: 'item', item: 'Médicaments premium', qty: 1, description: st('luxury.3.desc') }),
  () => ({
    type: 'event',
    description: st('luxury.4.desc'),
    choices: [
      { label: st('luxury.4.c0'), result: (gs) => gs.credits >= 200 ? Math.random() < 0.55 ? { gs: { credits: gs.credits - 200 + 500, reputation: gs.reputation + 10 }, message: st('luxury.4.c0msgWin') } : { gs: { credits: gs.credits - 200, playerHp: Math.max(1, gs.playerHp - rng(20, 40)) }, message: st('luxury.4.c0msgLose') } : { gs: {}, message: st('luxury.4.c0fail') } },
      { label: st('luxury.4.c1'), result: () => ({ gs: {}, message: st('luxury.4.c1msg') }) }
    ]
  }),
]

const SCENES_SCIENTIFIC: Array<() => ExploreResult> = [
  () => ({ type: 'item', item: 'Implants', qty: 1, description: st('scientific.0.desc') }),
  () => ({
    type: 'event',
    description: st('scientific.1.desc'),
    choices: [
      { label: st('scientific.1.c0'), result: (gs) => ({ gs: { reputation: gs.reputation + 20, credits: gs.credits + rng(400, 900), pastDecisions: addDecision(gs, 'aided-scientist'), journal: addJournal(gs, st('scientific.1.c0journal'), 'decision') }, message: st('scientific.1.c0msg') }) },
      { label: st('scientific.1.c1'), result: (gs) => ({ gs: { credits: gs.credits + rng(500, 1200), reputation: gs.reputation - 15 }, message: st('scientific.1.c1msg') }) },
      { label: st('scientific.1.c2'), result: () => ({ gs: {}, message: st('scientific.1.c2msg') }) }
    ]
  }),
  () => ({ type: 'loot', credits: rng(100, 400), description: st('scientific.2.desc') }),
  () => ({ type: 'nothing', description: st('scientific.3.desc') }),
  () => ({ type: 'item', item: 'Données classifiées', qty: 1, description: st('scientific.4.desc') }),
  () => ({ type: 'combat', depth: 0 }),
]

function pillarShift(gs: GameState, shifts: [string, number][]): Partial<GameState> {
  const cur = gs.pillarStanding ?? { cesarion: 0, raphazarus: 0, eliotis: 0, maxance: 0, alanossa: 0, scotty: 0 }
  const updated = { ...cur }
  for (const [key, delta] of shifts) {
    const k = key as keyof typeof cur
    updated[k] = Math.max(-100, Math.min(100, (updated[k] ?? 0) + delta))
  }
  return { pillarStanding: updated }
}

const SCENES_PILLAR_DILEMMAS: Array<() => ExploreResult> = [
  () => ({
    type: 'event',
    rare: true,
    description: st('pillar.0.desc'),
    choices: [
      {
        label: st('pillar.0.c0'),
        hint: st('pillar.0.c0hint'),
        result: (gs) => ({ gs: pillarShift(gs, [['cesarion', 10], ['raphazarus', -5]]), message: st('pillar.0.c0msg') }),
      },
      {
        label: st('pillar.0.c1'),
        hint: st('pillar.0.c1hint'),
        result: (gs) => ({ gs: pillarShift(gs, [['raphazarus', 10], ['cesarion', -10]]), message: st('pillar.0.c1msg') }),
      },
      { label: st('pillar.0.c2'), result: () => ({ gs: {}, message: st('pillar.0.c2msg') }) },
    ],
  }),
  () => ({
    type: 'event',
    rare: true,
    description: st('pillar.1.desc'),
    choices: [
      {
        label: st('pillar.1.c0'),
        hint: st('pillar.1.c0hint'),
        result: (gs) => ({ gs: pillarShift(gs, [['eliotis', 8], ['maxance', -8]]), message: st('pillar.1.c0msg') }),
      },
      {
        label: st('pillar.1.c1'),
        hint: st('pillar.1.c1hint'),
        result: (gs) => ({ gs: pillarShift(gs, [['maxance', 8], ['eliotis', -8]]), message: st('pillar.1.c1msg') }),
      },
      { label: st('pillar.1.c2'), hint: st('pillar.1.c2hint'), result: (gs) => ({ gs: pillarShift(gs, [['eliotis', -3], ['maxance', -3]]), message: st('pillar.1.c2msg') }) },
    ],
  }),
  () => ({
    type: 'event',
    rare: true,
    description: st('pillar.2.desc'),
    choices: [
      {
        label: st('pillar.2.c0'),
        hint: st('pillar.2.c0hint'),
        result: (gs) => ({ gs: { ...pillarShift(gs, [['alanossa', 12], ['scotty', -6]]), reputation: gs.reputation + 5 }, message: st('pillar.2.c0msg') }),
      },
      {
        label: st('pillar.2.c1'),
        hint: st('pillar.2.c1hint'),
        result: (gs) => ({ gs: { ...pillarShift(gs, [['scotty', 12], ['alanossa', -6]]), reputation: gs.reputation + 5 }, message: st('pillar.2.c1msg') }),
      },
      { label: st('pillar.2.c2'), hint: st('pillar.2.c2hint'), result: (gs) => ({ gs: { reputation: gs.reputation - 3 }, message: st('pillar.2.c2msg') }) },
    ],
  }),
  () => ({
    type: 'event',
    rare: true,
    description: st('pillar.3.desc'),
    choices: [
      {
        label: st('pillar.3.c0'),
        hint: st('pillar.3.c0hint'),
        result: (gs) => ({ gs: { ...pillarShift(gs, [['raphazarus', 8], ['alanossa', -10]]), credits: gs.credits + 400 }, message: st('pillar.3.c0msg') }),
      },
      {
        label: st('pillar.3.c1'),
        hint: st('pillar.3.c1hint'),
        result: (gs) => ({ gs: pillarShift(gs, [['alanossa', 10], ['raphazarus', -8]]), message: st('pillar.3.c1msg') }),
      },
      { label: st('pillar.3.c2'), result: () => ({ gs: {}, message: st('pillar.3.c2msg') }) },
    ],
  }),
  () => ({
    type: 'event',
    rare: true,
    description: st('pillar.4.desc'),
    choices: [
      {
        label: st('pillar.4.c0'),
        hint: st('pillar.4.c0hint'),
        result: (gs) => ({ gs: { ...pillarShift(gs, [['eliotis', 10], ['maxance', -5], ['cesarion', -5]]), credits: gs.credits + 200 }, message: st('pillar.4.c0msg') }),
      },
      {
        label: st('pillar.4.c1'),
        hint: st('pillar.4.c1hint'),
        result: (gs) => ({ gs: { ...pillarShift(gs, [['maxance', -5], ['cesarion', -5]]), credits: gs.credits + 500 }, message: st('pillar.4.c1msg') }),
      },
      { label: st('pillar.4.c2'), result: () => ({ gs: {}, message: st('pillar.4.c2msg') }) },
    ],
  }),
]

function getScenesForZone(type: string): Array<() => ExploreResult> {
  switch (type) {
    case 'dangerous': return [...SCENES_DANGEROUS, ...getJsonExploreDangerous(), ...getJsonExploreGeneric(), ...SCENES_PILLAR_DILEMMAS]
    case 'peaceful':  return [...SCENES_PEACEFUL,  ...getJsonExplorePeaceful(),  ...getJsonExploreGeneric(), ...SCENES_PILLAR_DILEMMAS]
    case 'industrial':return [...SCENES_INDUSTRIAL,...getJsonExploreIndustrial(),...getJsonExploreGeneric(), ...SCENES_PILLAR_DILEMMAS]
    case 'ruins':     return [...SCENES_RUINS,     ...getJsonExploreRuins(),     ...getJsonExploreGeneric(), ...SCENES_PILLAR_DILEMMAS]
    case 'military':  return [...SCENES_MILITARY,  ...getJsonExploreMilitary(),  ...getJsonExploreGeneric(), ...SCENES_PILLAR_DILEMMAS]
    case 'luxury':    return [...SCENES_LUXURY,    ...getJsonExploreLuxury(),    ...getJsonExploreGeneric(), ...SCENES_PILLAR_DILEMMAS]
    case 'scientific':return [...SCENES_SCIENTIFIC,...getJsonExploreScientific(),...getJsonExploreGeneric(), ...SCENES_PILLAR_DILEMMAS]
    default:          return [...SCENES_DANGEROUS, ...getJsonExploreDangerous(), ...getJsonExploreGeneric(), ...SCENES_PILLAR_DILEMMAS]
  }
}

export function rollExplorationEvent(gs: GameState): ExploreResult {
  const station = getStation(gs.currentStation)
  const depth = gs.zoneDepth
  const danger = station.danger
  const fightsDone = gs.explorationFightsDone ?? 0

  // Garantie minimum 3 combats : forcer un combat tous les 2 niveaux
  // si le quota de combats n'est pas atteint
  if (depth >= 2 && depth % 2 === 0 && fightsDone < depth / 2) {
    return { type: 'combat', depth }
  }

  // Boss uniquement après 3 combats ET profondeur 7+, dans les zones dangereuses
  if (fightsDone >= 3 && depth >= 7 && danger >= 2 && Math.random() < 0.30) {
    return { type: 'boss' }
  }

  // Grand loot à profondeur élevée (après les combats)
  if (fightsDone >= 2 && depth >= 5 && Math.random() < 0.15) {
    return { type: 'loot', credits: rng(600, 2000), description: st('deepLoot') }
  }

  // Alternance forcée : pas de combat deux fois de suite
  if (!gs.lastExploreWasCombat) {
    const scannerLevel = gs.shipModules?.scanner ?? 0
    const scannerReduction = scannerLevel >= 3 ? 0.20 : scannerLevel >= 2 ? 0.10 : 0
    const gardiensRep = gs.factionReputation?.gardiens ?? 0
    const gardiensReduction = gardiensRep >= 80 ? 0.15 : gardiensRep >= 50 ? 0.10 : gardiensRep >= 20 ? 0.05 : 0
    const traqueMod = (gs.runModifiers ?? []).includes('traque') ? 0.15 : 0
    // Explorateur : « événements neutres plus fréquents ». Son bonus était
    // déclaré sur la classe (neutralEventsBoost) mais lu nulle part. Moins de
    // combats déclenchés = plus de scènes neutres, ce qui est exactement la
    // promesse faite au joueur.
    const explorateurReduction = gs.class.neutralEventsBoost ? 0.12 : 0
    const combatChance = Math.max(0, 0.15 + depth * 0.07 + danger * 0.08 - scannerReduction - gardiensReduction - explorateurReduction + traqueMod)
    if (Math.random() < combatChance) {
      return { type: 'combat', depth }
    }
  }

  const scenes = getScenesForZone(station.type)
  const base = pick(scenes)()

  // 12% de chance de trouver un fragment de lore pendant l'exploration
  if (base.type !== 'combat' && base.type !== 'boss' && Math.random() < 0.12) {
    const fragment = getRandomUndiscoveredFragment(gs.discoveredLore ?? [])
    if (fragment) return { ...base, loreFragmentId: fragment.id } as typeof base
  }

  return base
}

// ── HELPER GÉNÉRATION DE QUÊTE INLINE ────────────────────────────────────────
function quickQuest(gs: GameState, type: QuestType, giver: string, title: string, desc: string, targetStation: string, item?: string, credits = 1200, rep = 12): Quest {
  return { id: Math.random().toString(36).slice(2, 8), title, giver, giverStation: gs.currentStation, type, description: desc, targetStation, targetItem: item, creditReward: credits, repReward: rep }
}
function pickTarget(gs: GameState) {
  const list = getAccessibleStations(gs.currentStation).filter(s => s.name !== gs.currentStation)
  return list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null
}

// ── WANDER : STATIONS SÉCURISÉES / PAISIBLES ─────────────────────────────────
export const WANDER_EVENTS_LOW: Array<(gs: GameState) => WanderEvent> = [

  (gs) => ({
    title: st('wanderLow.0.title'),
    description: st('wanderLow.0.desc'),
    choices: [
      { label: st('wanderLow.0.c0'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: {}, message: st('wanderLow.0.c0empty') }
        const q = quickQuest(gs!, 'extraction', 'Expéditeur inconnu', st('wanderLow.0.c0qTitle', { target: translateStationName(t.name) }), st('wanderLow.0.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Pièces techniques', 1800, 15)
        return { gs: {}, message: st('wanderLow.0.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderLow.0.c1'), result: () => ({ gs: {}, message: st('wanderLow.0.c1msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderLow.1.title'),
    description: st('wanderLow.1.desc'),
    choices: [
      { label: st('wanderLow.1.c0'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: { reputation: gs!.reputation + 5 }, message: st('wanderLow.1.c0noTargetMsg') }
        const q = quickQuest(gs!, 'patrol', 'Vieux Drela', st('wanderLow.1.c0qTitle', { target: translateStationName(t.name) }), st('wanderLow.1.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 800, 10)
        return { gs: { reputation: gs!.reputation + 5 }, message: st('wanderLow.1.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderLow.1.c1'), result: () => ({ gs: {}, message: st('wanderLow.1.c1msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderLow.2.title'),
    description: st('wanderLow.2.desc'),
    choices: [
      { label: st('wanderLow.2.c0'), result: (gs) => gs && gs.credits >= 120
        ? { gs: { credits: gs.credits - 120, cargo: { ...gs.cargo, 'Médicaments': (gs.cargo['Médicaments'] ?? 0) + 2 } }, message: st('wanderLow.2.c0msg') }
        : { gs: {}, message: st('wanderLow.2.c0fail') }
      },
      { label: st('wanderLow.2.c1'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: { reputation: gs!.reputation + 8 }, message: st('wanderLow.2.c1noTargetMsg') }
        const q = quickQuest(gs!, 'delivery', 'Marchande', st('wanderLow.2.c1qTitle'), st('wanderLow.2.c1qDesc', { target: translateStationName(t.name) }), t.name, 'Médicaments', 1400, 18)
        return { gs: { reputation: gs!.reputation + 8 }, message: st('wanderLow.2.c1msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderLow.2.c2'), result: () => ({ gs: {}, message: st('wanderLow.2.c2msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderLow.3.title'),
    description: st('wanderLow.3.desc'),
    choices: [
      { label: st('wanderLow.3.c0'), result: (gs) => {
        const ok = Math.random() < 0.45 + (gs ? gs.reputation / 300 : 0)
        if (ok) {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'delivery', 'Marchand reconnaissant', st('wanderLow.3.c0qTitle'), st('wanderLow.3.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Pièces techniques', 1600, 15) : undefined
          return { gs: { reputation: (gs?.reputation ?? 0) + 12 }, message: st('wanderLow.3.c0msgWin') + (q ? st('wanderLow.3.c0msgWinQuestSuffix') : ''), quest: q ?? undefined }
        }
        return { gs: { reputation: (gs?.reputation ?? 0) - 5 }, message: st('wanderLow.3.c0msgLose') }
      }},
      { label: st('wanderLow.3.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) - 8, credits: (gs?.credits ?? 0) + rng(80, 200) }, message: st('wanderLow.3.c1msg') }) },
      { label: st('wanderLow.3.c2'), result: () => ({ gs: {}, message: st('wanderLow.3.c2msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderLow.4.title'),
    description: st('wanderLow.4.desc'),
    choices: [
      { label: st('wanderLow.4.c0'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: {}, message: st('wanderLow.4.c0noTargetMsg') }
        const q = quickQuest(gs!, 'delivery', 'Mécanicien local', st('wanderLow.4.c0qTitle'), st('wanderLow.4.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Composants électroniques', 1300, 10)
        return { gs: {}, message: st('wanderLow.4.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderLow.4.c1'), result: () => ({ gs: {}, message: st('wanderLow.4.c1msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderLow.5.title'),
    description: st('wanderLow.5.desc'),
    choices: [
      { label: st('wanderLow.5.c0'), result: (gs) => {
        if (!gs || gs.credits < 40) return { gs: {}, message: st('wanderLow.5.c0failMsg') }
        const t = pickTarget(gs)
        if (!t) return { gs: { credits: gs.credits - 40 }, message: st('wanderLow.5.c0noTargetMsg') }
        const q = quickQuest(gs, 'patrol', 'Source anonyme', st('wanderLow.5.c0qTitle', { target: translateStationName(t.name) }), st('wanderLow.5.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 900, 8)
        return { gs: { credits: gs.credits - 40 }, message: st('wanderLow.5.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderLow.5.c1'), result: () => ({ gs: {}, message: st('wanderLow.5.c1msg') }) },
      { label: st('wanderLow.5.c2'), result: (gs) => ({ gs: { credits: (gs?.credits ?? 0) + rng(40, 120), reputation: (gs?.reputation ?? 0) - 10 }, message: st('wanderLow.5.c2msg') }) }
    ]
  }),

  (_gs) => ({
    title: st('wanderLow.6.title'),
    description: st('wanderLow.6.desc'),
    choices: [
      { label: st('wanderLow.6.c0'), result: () => ({ type: 'negotiation' as const, message: '' }) },
      { label: st('wanderLow.6.c1'), result: () => ({ gs: {}, message: st('wanderLow.6.c1msg') }) },
    ],
  }),

  (_gs) => ({
    title: st('wanderLow.7.title'),
    description: st('wanderLow.7.desc'),
    choices: [
      { label: st('wanderLow.7.c0'), result: () => ({ type: 'negotiation' as const, message: '' }) },
      { label: st('wanderLow.7.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 2 }, message: st('wanderLow.7.c1msg') }) },
    ],
  }),

]

// ── WANDER : STATIONS RISQUÉES / DANGEREUSES ──────────────────────────────────
export const WANDER_EVENTS_MID: Array<(gs: GameState) => WanderEvent> = [

  (gs) => ({
    title: st('wanderMid.0.title'),
    description: st('wanderMid.0.desc'),
    choices: [
      { label: st('wanderMid.0.c0'), result: () => Math.random() < 0.55
        ? { gs: {}, message: st('wanderMid.0.c0msgWin') }
        : { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(12, 28)) }, message: st('wanderMid.0.c0msgLose') }
      },
      { label: st('wanderMid.0.c1'), result: () => ({ type: 'combat' as const, message: st('wanderMid.0.c1msg') }) },
      { label: st('wanderMid.0.c2'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: { credits: (gs?.credits ?? 0) - 300 }, message: st('wanderMid.0.c2noTargetMsg') }
        const chance = Math.random() < 0.5 + (gs ? gs.reputation / 300 : 0)
        if (chance) {
          const q = quickQuest(gs!, 'bounty', 'Chasseur Besh', st('wanderMid.0.c2qTitle', { target: translateStationName(t.name) }), st('wanderMid.0.c2qDesc', { target: translateStationName(t.name) }), t.name, undefined, 3500, 25)
          return { gs: { reputation: gs!.reputation + 5 }, message: st('wanderMid.0.c2msgWin', { target: translateStationName(t.name) }), quest: q }
        }
        return { gs: { credits: gs!.credits - 300 }, message: st('wanderMid.0.c2msgLose') }
      }},
      { label: st('wanderMid.0.c3'), result: (gs) => gs && gs.credits >= 300
        ? { gs: { credits: gs.credits - 300 }, message: st('wanderMid.0.c3msg') }
        : { gs: {}, message: st('wanderMid.0.c3fail') }
      }
    ]
  }),

  (gs) => ({
    title: st('wanderMid.1.title'),
    description: st('wanderMid.1.desc'),
    choices: [
      { label: st('wanderMid.1.c0'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: {}, message: st('wanderMid.1.c0noTargetMsg') }
        const q = quickQuest(gs!, 'delivery', 'Contact anonyme', st('wanderMid.1.c0qTitle'), st('wanderMid.1.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Pièces de contrebande', 2800, 5)
        return { gs: { cargo: { ...(gs?.cargo ?? {}), 'Pièces de contrebande': ((gs?.cargo ?? {})['Pièces de contrebande'] ?? 0) + 1 } }, message: st('wanderMid.1.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderMid.1.c1'), result: () => ({ gs: {}, message: st('wanderMid.1.c1msg') }) },
      { label: st('wanderMid.1.c2'), result: () => ({ gs: {}, message: st('wanderMid.1.c2msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderMid.2.title'),
    description: st('wanderMid.2.desc'),
    choices: [
      { label: st('wanderMid.2.c0'), result: (gs) => {
        if (!gs || gs.credits < 200) return { gs: {}, message: st('wanderMid.2.c0fail') }
        const t = pickTarget(gs)
        const q = t ? quickQuest(gs, 'sabotage', 'Caïd Orva', st('wanderMid.2.c0qTitle'), st('wanderMid.2.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 2200, -5) : undefined
        return { gs: { credits: gs.credits - 200 }, message: st('wanderMid.2.c0msg') + (q ? st('wanderMid.2.c0msgQuestSuffix') : ''), quest: q ?? undefined }
      }},
      { label: st('wanderMid.2.c1'), result: (gs) => Math.random() < 0.35 + (gs ? gs.reputation / 250 : 0)
        ? { gs: { reputation: (gs?.reputation ?? 0) + 15 }, message: st('wanderMid.2.c1msgWin') }
        : { type: 'combat' as const, message: st('wanderMid.2.c1msgLose') }
      },
      { label: st('wanderMid.2.c2'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t || Math.random() < 0.4) return { gs: {}, message: st('wanderMid.2.c2msgNo') }
        const q = quickQuest(gs!, 'revenge', 'Caïd Orva', st('wanderMid.2.c2qTitle'), st('wanderMid.2.c2qDesc', { target: translateStationName(t.name) }), t.name, undefined, 1800, 12)
        return { gs: {}, message: st('wanderMid.2.c2msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderMid.2.c3'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 25 }, message: st('wanderMid.2.c3msg') }), available: (gs) => gs.class.name === 'Seigneur de guerre' }
    ]
  }),

  (gs) => ({
    title: st('wanderMid.3.title'),
    description: st('wanderMid.3.desc'),
    choices: [
      { label: st('wanderMid.3.c0'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: { reputation: gs!.reputation + 10 }, message: st('wanderMid.3.c0noTargetMsg') }
        const q = quickQuest(gs!, 'bounty', 'Transfuge', st('wanderMid.3.c0qTitle'), st('wanderMid.3.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 4500, 30)
        return { gs: { reputation: gs!.reputation + 10 }, message: st('wanderMid.3.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderMid.3.c1'), result: (gs) => ({ gs: { credits: (gs?.credits ?? 0) + rng(400, 900), reputation: (gs?.reputation ?? 0) - 20, moralTags: [...(gs?.moralTags ?? []), 'délateur'], pastDecisions: addDecision(gs!, 'betrayed-transfuge'), journal: addJournal(gs!, st('wanderMid.3.c1journal'), 'decision') }, message: st('wanderMid.3.c1msg') }) },
      { label: st('wanderMid.3.c2'), result: () => ({ gs: {}, message: st('wanderMid.3.c2msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderMid.4.title'),
    description: st('wanderMid.4.desc'),
    choices: [
      { label: st('wanderMid.4.c0'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: {}, message: st('wanderMid.4.c0noTargetMsg') }
        const q = quickQuest(gs!, 'bounty', 'Informateur Fen', st('wanderMid.4.c0qTitle', { target: translateStationName(t.name) }), st('wanderMid.4.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 3800, 22)
        return { gs: {}, message: st('wanderMid.4.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderMid.4.c1'), result: (gs) => {
        if (Math.random() < 0.5) {
          const t = gs && pickTarget(gs)
          if (t) {
            const q = quickQuest(gs!, 'patrol', 'Informateur Fen', st('wanderMid.4.c1qTitle', { target: translateStationName(t.name) }), st('wanderMid.4.c1qDesc', { target: translateStationName(t.name) }), t.name, undefined, 1200, 8)
            return { gs: {}, message: st('wanderMid.4.c1msgQuest', { target: translateStationName(t.name) }), quest: q }
          }
        }
        return { gs: {}, message: st('wanderMid.4.c1msgNo') }
      }},
      { label: st('wanderMid.4.c2'), result: () => ({ gs: {}, message: st('wanderMid.4.c2msg') }) }
    ]
  }),

  (_gs) => ({
    title: st('wanderMid.5.title'),
    description: st('wanderMid.5.desc'),
    choices: [
      { label: st('wanderMid.5.c0'), result: () => ({ type: 'navigation' as const, message: '' }) },
      { label: st('wanderMid.5.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 3 }, message: st('wanderMid.5.c1msg') }) },
    ],
  }),

  (_gs) => ({
    title: st('wanderMid.6.title'),
    description: st('wanderMid.6.desc'),
    choices: [
      { label: st('wanderMid.6.c0'), result: () => ({ type: 'navigation' as const, message: '' }) },
      { label: st('wanderMid.6.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) - 5 }, message: st('wanderMid.6.c1msg') }) },
    ],
  }),

]

// ── WANDER : ZONES DE GUERRE / TRÈS DANGEREUSES ───────────────────────────────
export const WANDER_EVENTS_HIGH: Array<(gs: GameState) => WanderEvent> = [

  (gs) => ({
    title: st('wanderHigh.0.title'),
    description: st('wanderHigh.0.desc'),
    choices: [
      { label: st('wanderHigh.0.c0'), result: () => Math.random() < 0.5
        ? { gs: {}, message: st('wanderHigh.0.c0msgWin') }
        : { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(18, 40)) }, message: st('wanderHigh.0.c0msgLose') }
      },
      { label: st('wanderHigh.0.c1'), result: () => ({ type: 'combat' as const, message: st('wanderHigh.0.c1msg') }) },
      { label: st('wanderHigh.0.c2'), result: (gs) => {
        if (Math.random() < 0.6) {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'bounty', 'Source : assassin capturé', st('wanderHigh.0.c2qTitle', { target: translateStationName(t.name) }), st('wanderHigh.0.c2qDesc', { target: translateStationName(t.name) }), t.name, undefined, 5000, 35) : undefined
          return { gs: { playerHp: Math.max(1, gs!.playerHp - rng(8, 18)), reputation: gs!.reputation + 15 }, message: st('wanderHigh.0.c2msgWin', { target: translateStationName(t?.name ?? st('wanderHigh.0.c2fallbackTarget')) }), quest: q ?? undefined }
        }
        return { gs: { playerHp: Math.max(1, gs!.playerHp - rng(15, 30)) }, message: st('wanderHigh.0.c2msgLose') }
      }}
    ]
  }),

  (gs) => ({
    title: st('wanderHigh.1.title'),
    description: st('wanderHigh.1.desc'),
    choices: [
      { label: st('wanderHigh.1.c0'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t) return { gs: { credits: (gs?.credits ?? 0) + 400 }, message: st('wanderHigh.1.c0noTargetMsg') }
        const q = quickQuest(gs!, 'sabotage', 'Faction locale', st('wanderHigh.1.c0qTitle', { target: translateStationName(t.name) }), st('wanderHigh.1.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 3000, -8)
        return { gs: { credits: gs!.credits + 400 }, message: st('wanderHigh.1.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderHigh.1.c1'), result: (gs) => {
        const t = gs && pickTarget(gs)
        if (!t || Math.random() < 0.4) return { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(15, 35)) }, message: st('wanderHigh.1.c1msgFail') }
        const q = quickQuest(gs!, 'extraction', 'Faction locale', st('wanderHigh.1.c1qTitle'), st('wanderHigh.1.c1qDesc', { target: translateStationName(t.name) }), t.name, 'Données classifiées', 4200, 10)
        return { gs: {}, message: st('wanderHigh.1.c1msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderHigh.1.c2'), result: () => Math.random() < 0.45
        ? { gs: {}, message: st('wanderHigh.1.c2msgWin') }
        : { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(22, 45)) }, message: st('wanderHigh.1.c2msgLose') }
      }
    ]
  }),

  (gs) => ({
    title: st('wanderHigh.2.title'),
    description: st('wanderHigh.2.desc'),
    choices: [
      { label: st('wanderHigh.2.c0'), result: (gs) => {
        if (!gs || gs.credits < 600) return { gs: {}, message: st('wanderHigh.2.c0fail') }
        const t = pickTarget(gs)
        if (!t) return { gs: { credits: gs.credits - 600, reputation: gs.reputation + 20 }, message: st('wanderHigh.2.c0noTargetMsg') }
        const q = quickQuest(gs, 'bounty', 'Double agent', st('wanderHigh.2.c0qTitle', { target: translateStationName(t.name) }), st('wanderHigh.2.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 6000, 40)
        return { gs: { credits: gs.credits - 600, reputation: gs.reputation + 20 }, message: st('wanderHigh.2.c0msg', { target: translateStationName(t.name) }), quest: q }
      }},
      { label: st('wanderHigh.2.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 8 }, message: st('wanderHigh.2.c1msg') }) },
      { label: st('wanderHigh.2.c2'), result: (gs) => Math.random() < 0.5
        ? { gs: { reputation: (gs?.reputation ?? 0) - 15 }, message: st('wanderHigh.2.c2msgCaught') }
        : { gs: { credits: (gs?.credits ?? 0) + rng(200, 500), reputation: (gs?.reputation ?? 0) - 20 }, message: st('wanderHigh.2.c2msgSuccess') }
      }
    ]
  }),

  (gs) => ({
    title: st('wanderHigh.3.title'),
    description: st('wanderHigh.3.desc'),
    choices: [
      { label: st('wanderHigh.3.c0'), result: (gs) => {
        if (!gs || (gs.cargo['Médicaments'] ?? 0) <= 0) return { gs: {}, message: st('wanderHigh.3.c0noMedsMsg') }
        const t = pickTarget(gs)
        const newCargo: typeof gs.cargo = { ...gs.cargo, 'Médicaments': (gs.cargo['Médicaments'] ?? 1) - 1 }
        if ((newCargo['Médicaments'] ?? 0) <= 0) delete (newCargo as Record<string, number>)['Médicaments']
        const q = t ? quickQuest(gs, 'revenge', 'Mercenaire Cador', st('wanderHigh.3.c0qTitle', { target: translateStationName(t.name) }), st('wanderHigh.3.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 2500, 20) : undefined
        return { gs: { reputation: gs.reputation + 18, cargo: newCargo, pastDecisions: addDecision(gs, 'saved-mercenary'), journal: addJournal(gs, st('wanderHigh.3.c0journal'), 'decision') }, message: st('wanderHigh.3.c0msg', { target: translateStationName(t?.name ?? st('wanderHigh.3.c0fallbackTarget')) }), quest: q ?? undefined }
      }},
      { label: st('wanderHigh.3.c1'), result: () => ({ gs: {}, message: st('wanderHigh.3.c1msg') }) },
      { label: st('wanderHigh.3.c2'), result: (gs) => ({ gs: { credits: (gs?.credits ?? 0) + rng(150, 400), reputation: (gs?.reputation ?? 0) - 18, moralTags: [...(gs?.moralTags ?? []), 'opportuniste'], pastDecisions: addDecision(gs!, 'pillaged-wounded'), journal: addJournal(gs!, st('wanderHigh.3.c2journal'), 'decision') }, message: st('wanderHigh.3.c2msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderHigh.4.title'),
    description: st('wanderHigh.4.desc'),
    choices: [
      { label: st('wanderHigh.4.c0'), result: (gs) => {
        if (!gs || gs.credits < 700) return { gs: {}, message: st('wanderHigh.4.c0fail') }
        const q = quickQuest(gs, 'bounty', 'Source proche d\'Alanossa', st('wanderHigh.4.c0qTitle'), st('wanderHigh.4.c0qDesc'), 'Arc Ouest Apocalypse', undefined, 8000, 50)
        return { gs: { credits: gs.credits - 700, reputation: gs.reputation + 30 }, message: st('wanderHigh.4.c0msg'), quest: q }
      }},
      { label: st('wanderHigh.4.c1'), result: (gs) => Math.random() < 0.4
        ? { gs: {}, message: st('wanderHigh.4.c1msgFail') }
        : { gs: { credits: (gs?.credits ?? 0) - 400, reputation: (gs?.reputation ?? 0) + 15 }, message: st('wanderHigh.4.c1msgWin') }
      },
      { label: st('wanderHigh.4.c2'), result: () => ({ gs: {}, message: st('wanderHigh.4.c2msg') }) }
    ]
  }),

  // ── PIÈGES ZONES EXTRÊMES ──
  (gs) => ({
    title: st('wanderHigh.5.title'),
    description: st('wanderHigh.5.desc'),
    choices: [
      {
        label: st('wanderHigh.5.c0'),
        result: (gs) => Math.random() < 0.15
          ? { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(30, 50)) }, message: st('wanderHigh.5.c0msgWin') }
          : { gs: { isImprisoned: true, prisonDaysLeft: rng(3, 5), screen: 'prison' as const, credits: Math.max(0, (gs?.credits ?? 0) - rng(400, 900)) }, message: st('wanderHigh.5.c0msgLose') }
      },
      {
        label: st('wanderHigh.5.c1'),
        result: (gs) => ({ gs: { isImprisoned: true, prisonDaysLeft: rng(2, 4), screen: 'prison' as const, credits: Math.max(0, (gs?.credits ?? 0) - rng(200, 600)) }, message: st('wanderHigh.5.c1msg') })
      }
    ]
  }),

  (gs) => ({
    title: st('wanderHigh.6.title'),
    description: st('wanderHigh.6.desc'),
    choices: [
      {
        label: st('wanderHigh.6.c0'),
        result: (gs) => {
          const roll = Math.random()
          if (roll < 0.30) return { gs: { isDead: true, deathCause: st('wanderHigh.6.c0deathCause') }, message: st('wanderHigh.6.c0msgDeath') }
          if (roll < 0.65) return { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(30, 60)), isImprisoned: true, prisonDaysLeft: 2, screen: 'prison' as const }, message: st('wanderHigh.6.c0msgGas') }
          return { gs: { credits: (gs?.credits ?? 0) + rng(400, 1200) }, message: st('wanderHigh.6.c0msgCredits') }
        }
      },
      {
        label: st('wanderHigh.6.c1'),
        result: () => ({ gs: {}, message: st('wanderHigh.6.c1msg') })
      }
    ]
  }),

  (gs) => ({
    title: st('wanderHigh.7.title'),
    description: st('wanderHigh.7.desc'),
    choices: [
      {
        label: st('wanderHigh.7.c0'),
        result: (gs) => {
          const roll = Math.random()
          if (roll < 0.35) return { gs: { pendingInterrogation: { faction: 'Agents de faction inconnue', captureStation: gs?.currentStation ?? '' }, screen: 'interrogation' as const }, message: st('wanderHigh.7.c0msgInterrogation') }
          return { gs: { reputation: (gs?.reputation ?? 0) - 5 }, message: st('wanderHigh.7.c0msgPass') }
        }
      },
      {
        label: st('wanderHigh.7.c1'),
        result: (gs) => Math.random() < 0.4
          ? { gs: {}, message: st('wanderHigh.7.c1msgWin') }
          : { gs: { isImprisoned: true, prisonDaysLeft: rng(1, 3), screen: 'prison' as const, playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(15, 30)) }, message: st('wanderHigh.7.c1msgLose') }
      },
      {
        label: st('wanderHigh.7.c2'),
        result: (gs) => Math.random() < 0.50
          ? { gs: {}, message: st('wanderHigh.7.c2msgWin') }
          : { gs: { isImprisoned: true, prisonDaysLeft: rng(2, 4), screen: 'prison' as const }, message: st('wanderHigh.7.c2msgLose') }
      }
    ]
  }),

]

export interface WanderEvent {
  title: string
  description: string
  choices: WanderChoice[]
}

// ── EVENTS MAUVAISE RÉPUTATION (rep < -20) ───────────────────────────────────
export const WANDER_EVENTS_BAD_REP: Array<(gs: GameState) => WanderEvent> = [

  (gs) => ({
    title: st('wanderBadRep.0.title'),
    description: st('wanderBadRep.0.desc', { repAbs: Math.abs(gs.reputation) }),
    choices: [
      { label: st('wanderBadRep.0.c0'), result: (gs) => gs && gs.credits >= 300
        ? { gs: { credits: gs.credits - 300 }, message: st('wanderBadRep.0.c0msg') }
        : { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(15, 30)) }, message: st('wanderBadRep.0.c0fail') }
      },
      { label: st('wanderBadRep.0.c1'), result: (gs) => {
        const success = Math.random() < 0.40
        return success
          ? { gs: {}, message: st('wanderBadRep.0.c1msgWin') }
          : { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(20, 40)), reputation: (gs?.reputation ?? 0) - 10 }, message: st('wanderBadRep.0.c1msgLose') }
      }},
      { label: st('wanderBadRep.0.c2'), result: () => {
        const success = Math.random() < 0.65
        return success
          ? { gs: {}, message: st('wanderBadRep.0.c2msgWin') }
          : { gs: { reputation: -5, playerHp: Math.max(1, 50 - rng(10, 20)) }, message: st('wanderBadRep.0.c2msgLose') }
      }}
    ]
  }),

  (gs) => ({
    title: st('wanderBadRep.1.title'),
    description: st('wanderBadRep.1.desc'),
    choices: [
      { label: st('wanderBadRep.1.c0'), result: (gs) => ({
        gs: { reputation: (gs?.reputation ?? 0) - 5, credits: (gs?.credits ?? 0) + rng(0, 50) },
        message: st('wanderBadRep.1.c0msg')
      })},
      { label: st('wanderBadRep.1.c1'), result: (gs) => {
        const ok = (gs?.reputation ?? 0) > -35
        return ok
          ? { gs: { reputation: (gs?.reputation ?? 0) + 3 }, message: st('wanderBadRep.1.c1msgWin') }
          : { gs: { reputation: (gs?.reputation ?? 0) - 8 }, message: st('wanderBadRep.1.c1msgLose') }
      }},
      { label: st('wanderBadRep.1.c2'), result: () => ({ gs: {}, message: st('wanderBadRep.1.c2msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderBadRep.2.title'),
    description: st('wanderBadRep.2.desc'),
    choices: [
      { label: st('wanderBadRep.2.c0'), result: (gs) => {
        if (!gs || gs.credits < 200) return { gs: {}, message: st('wanderBadRep.2.c0fail') }
        const ok = Math.random() < 0.55
        return ok
          ? { gs: { credits: gs.credits - 200, playerMaxHp: gs.playerMaxHp + 12, playerHp: Math.min(gs.playerMaxHp + 12, gs.playerHp + 8) }, message: st('wanderBadRep.2.c0msgWin') }
          : { gs: { credits: gs.credits - 200, playerHp: Math.max(1, gs.playerHp - rng(15, 30)) }, message: st('wanderBadRep.2.c0msgLose') }
      }},
      { label: st('wanderBadRep.2.c1'), result: (gs) => ({
        gs: { reputation: (gs?.reputation ?? 0) + 5 },
        message: st('wanderBadRep.2.c1msg')
      })},
      { label: st('wanderBadRep.2.c2'), result: () => ({ gs: {}, message: st('wanderBadRep.2.c2msg') }) }
    ]
  }),

  (gs) => ({
    title: st('wanderBadRep.3.title'),
    description: st('wanderBadRep.3.desc'),
    choices: [
      { label: st('wanderBadRep.3.c0'), result: (gs) => {
        const ok = Math.random() < 0.35 + ((gs?.reputation ?? 0) < -40 ? -0.15 : 0)
        return ok
          ? { gs: { reputation: (gs?.reputation ?? 0) + 8 }, message: st('wanderBadRep.3.c0msgWin') }
          : { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(20, 35)), reputation: (gs?.reputation ?? 0) - 10 }, message: st('wanderBadRep.3.c0msgLose') }
      }},
      { label: st('wanderBadRep.3.c1'), result: (gs) => {
        const ok = Math.random() < 0.50
        return ok
          ? { gs: { reputation: (gs?.reputation ?? 0) + 15 }, message: st('wanderBadRep.3.c1msgWin') }
          : { gs: { reputation: (gs?.reputation ?? 0) - 5 }, message: st('wanderBadRep.3.c1msgLose') }
      }},
      { label: st('wanderBadRep.3.c2'), result: (gs) => ({
        gs: { reputation: (gs?.reputation ?? 0) - 3 },
        message: st('wanderBadRep.3.c2msg')
      })}
    ]
  }),

  (_gs) => ({
    title: st('wanderBadRep.4.title'),
    description: st('wanderBadRep.4.desc'),
    choices: [
      { label: st('wanderBadRep.4.c0'), result: (gs) => {
        const ok = Math.random() < 0.45
        return ok
          ? { gs: { reputation: (gs?.reputation ?? 0) + 12 }, message: st('wanderBadRep.4.c0msgWin') }
          : { gs: { reputation: (gs?.reputation ?? 0) - 8 }, message: st('wanderBadRep.4.c0msgLose') }
      }},
      { label: st('wanderBadRep.4.c1'), result: (gs) => ({
        gs: { reputation: (gs?.reputation ?? 0) - 5, credits: (gs?.credits ?? 0) + rng(200, 500) },
        message: st('wanderBadRep.4.c1msg')
      })},
      { label: st('wanderBadRep.4.c2'), result: () => ({ gs: {}, message: st('wanderBadRep.4.c2msg') }) }
    ]
  }),
]

// ── EVENTS CONTEXTUELS (selon l'état du joueur) ──────────────────────────────
function rollContextAwareEvent(gs: GameState): WanderEvent | null {
  const candidates: Array<[number, () => WanderEvent]> = []

  // HP très bas → quelqu'un propose de l'aide
  if (gs.playerHp < gs.playerMaxHp * 0.3) {
    candidates.push([0.5, () => ({
      title: st('contextAware.lowHp.title'),
      description: st('contextAware.lowHp.desc'),
      choices: [
        { label: st('contextAware.lowHp.c0'), result: (gs) => gs && gs.credits >= 150
          ? { gs: { credits: gs.credits - 150, playerHp: Math.min(gs.playerMaxHp, gs.playerHp + 40) }, message: st('contextAware.lowHp.c0msg') }
          : { gs: {}, message: st('contextAware.lowHp.c0fail') }
        },
        { label: st('contextAware.lowHp.c1'), result: (gs) => {
          const ok = (gs?.reputation ?? 0) >= 10
          return ok
            ? { gs: { playerHp: Math.min((gs?.playerMaxHp ?? 100), (gs?.playerHp ?? 1) + 20) }, message: st('contextAware.lowHp.c1msgWin') }
            : { gs: {}, message: st('contextAware.lowHp.c1msgLose') }
        }},
        { label: st('contextAware.lowHp.c2'), result: () => ({ gs: {}, message: st('contextAware.lowHp.c2msg') }) }
      ]
    })])
  }

  // Beaucoup de cargo → tentative de vol
  const cargoCount = Object.values(gs.cargo).reduce((s, v) => s + v, 0)
  if (cargoCount >= 5) {
    candidates.push([0.4, () => ({
      title: st('contextAware.cargoTheft.title'),
      description: st('contextAware.cargoTheft.desc'),
      choices: [
        { label: st('contextAware.cargoTheft.c0'), result: (gs) => {
          const ok = (gs?.reputation ?? 0) >= 0
          return ok
            ? { gs: { reputation: (gs?.reputation ?? 0) + 5 }, message: st('contextAware.cargoTheft.c0msgWin') }
            : { gs: { reputation: (gs?.reputation ?? 0) - 3, cargo: {} }, message: st('contextAware.cargoTheft.c0msgLose') }
        }},
        { label: st('contextAware.cargoTheft.c1'), result: (gs) => {
          const ok = Math.random() < 0.60
          return ok
            ? { gs: { reputation: (gs?.reputation ?? 0) + 10, credits: (gs?.credits ?? 0) + rng(100, 300) }, message: st('contextAware.cargoTheft.c1msgWin') }
            : { gs: { cargo: {} }, message: st('contextAware.cargoTheft.c1msgLose') }
        }},
        { label: st('contextAware.cargoTheft.c2'), result: (gs) => ({
          gs: { credits: (gs?.credits ?? 0) - 80 },
          message: st('contextAware.cargoTheft.c2msg')
        })}
      ]
    })])
  }

  // Beaucoup de crédits → pickpocket
  if (gs.credits >= 1500) {
    candidates.push([0.3, () => ({
      title: st('contextAware.pickpocket.title'),
      description: st('contextAware.pickpocket.desc'),
      choices: [
        { label: st('contextAware.pickpocket.c0'), result: (gs) => {
          const ok = Math.random() < 0.50
          const stolen = rng(200, 600)
          return ok
            ? { gs: {}, message: st('contextAware.pickpocket.c0msgCatch', { stolen }) }
            : { gs: { credits: (gs?.credits ?? 0) - stolen }, message: st('contextAware.pickpocket.c0msgMiss', { stolen }) }
        }},
        { label: st('contextAware.pickpocket.c1'), result: (gs) => {
          const lost = rng(100, 400)
          const detected = (gs?.credits ?? 0) > 0
          return detected
            ? { gs: { credits: Math.max(0, (gs?.credits ?? 0) - lost) }, message: st('contextAware.pickpocket.c1msgLost', { lost }) }
            : { gs: {}, message: st('contextAware.pickpocket.c1msgNothing') }
        }}
      ]
    })])
  }

  // Long voyage (many days) → reconnaissance par un inconnu
  if (gs.day >= 10 && gs.visitedStations.length >= 4) {
    candidates.push([0.35, () => ({
      title: st('contextAware.reputationPreceded.title'),
      description: st('contextAware.reputationPreceded.desc', { station: translateStationName(gs.visitedStations[gs.visitedStations.length - 2] ?? st('contextAware.reputationPreceded.fallbackStation')) }),
      choices: [
        { label: st('contextAware.reputationPreceded.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          if (!t) return { gs: { reputation: (gs?.reputation ?? 0) + 8 }, message: st('contextAware.reputationPreceded.c0noTargetMsg') }
          const q = quickQuest(gs!, 'delivery', 'Pilote rencontré', st('contextAware.reputationPreceded.c0qTitle'), st('contextAware.reputationPreceded.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Données', 1600, 12)
          return { gs: { reputation: gs!.reputation + 8 }, message: st('contextAware.reputationPreceded.c0msg'), quest: q }
        }},
        { label: st('contextAware.reputationPreceded.c1'), result: (gs) => ({
          gs: { reputation: (gs?.reputation ?? 0) + 3 },
          message: st('contextAware.reputationPreceded.c1msg')
        })},
        { label: st('contextAware.reputationPreceded.c2'), result: () => ({ gs: {}, message: st('contextAware.reputationPreceded.c2msg') }) }
      ]
    })])
  }

  if (candidates.length === 0) return null
  for (const [chance, factory] of candidates) {
    if (Math.random() < chance) return factory()
  }
  return null
}

export interface WanderChoice {
  label: string
  hint?: string
  result: (gs: GameState) => { gs?: Partial<GameState>; message: string; type?: 'combat' | 'negotiation' | 'navigation'; quest?: import('../types').Quest }
  available?: (gs: GameState) => boolean
}

// ── ÉVÉNEMENTS UNIQUES PAR STATION ───────────────────────────────────────────

export const STATION_WANDER_EVENTS: Partial<Record<string, Array<(gs: GameState) => WanderEvent>>> = {

  'La Carcasse': [
    (gs) => ({
      title: st('stationWander.laCarcasse.0.title'),
      description: st('stationWander.laCarcasse.0.desc'),
      choices: [
        { label: st('stationWander.laCarcasse.0.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          if (!t) return { gs: { reputation: (gs?.reputation ?? 0) + 5 }, message: st('stationWander.laCarcasse.0.c0noTargetMsg') }
          const q = quickQuest(gs!, 'delivery', 'Marek', st('stationWander.laCarcasse.0.c0qTitle'), st('stationWander.laCarcasse.0.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Pièces techniques', 1400, 12)
          return { gs: { reputation: gs!.reputation + 5 }, message: st('stationWander.laCarcasse.0.c0msg', { target: translateStationName(t.name) }), quest: q }
        }},
        { label: st('stationWander.laCarcasse.0.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 8, credits: (gs?.credits ?? 0) + rng(80, 200) }, message: st('stationWander.laCarcasse.0.c1msg') }) },
        { label: st('stationWander.laCarcasse.0.c2'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 12, shipHp: Math.min((gs?.shipMaxHp ?? 100), (gs?.shipHp ?? 100) + rng(8, 20)) }, message: st('stationWander.laCarcasse.0.c2msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.laCarcasse.1.title'),
      description: st('stationWander.laCarcasse.1.desc'),
      choices: [
        { label: st('stationWander.laCarcasse.1.c0'), result: (gs) => ({ gs: { playerHp: Math.min((gs?.playerMaxHp ?? 100), (gs?.playerHp ?? 50) + rng(10, 20)), credits: Math.max(0, (gs?.credits ?? 0) - 30) }, message: st('stationWander.laCarcasse.1.c0msg') }) },
        { label: st('stationWander.laCarcasse.1.c1'), result: () => ({ gs: {}, message: st('stationWander.laCarcasse.1.c1msg') }) },
        { label: st('stationWander.laCarcasse.1.c2'), result: () => ({ gs: {}, message: st('stationWander.laCarcasse.1.c2msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.laCarcasse.2.title'),
      description: st('stationWander.laCarcasse.2.desc'),
      choices: [
        { label: st('stationWander.laCarcasse.2.c0'), result: (gs) => ({ gs: { credits: Math.max(0, (gs?.credits ?? 0) - rng(20, 60)) }, message: st('stationWander.laCarcasse.2.c0msg') }) },
        { label: st('stationWander.laCarcasse.2.c1'), result: (gs) => {
          const found = Math.random() < 0.5
          return found
            ? { gs: { credits: (gs?.credits ?? 0) + rng(60, 180), cargo: { ...(gs?.cargo ?? {}), 'Médicaments': ((gs?.cargo ?? {})['Médicaments'] ?? 0) + 1 } }, message: st('stationWander.laCarcasse.2.c1msgFound') }
            : { gs: {}, message: st('stationWander.laCarcasse.2.c1msgNothing') }
        }},
        { label: st('stationWander.laCarcasse.2.c2'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 10 }, message: st('stationWander.laCarcasse.2.c2msg') }) }
      ]
    }),
  ],

  'Les Bas-Fonds de Vega': [
    (gs) => ({
      title: st('stationWander.lesBasFondsDeVega.0.title'),
      description: st('stationWander.lesBasFondsDeVega.0.desc'),
      choices: [
        { label: st('stationWander.lesBasFondsDeVega.0.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          if (!t) return { gs: { credits: (gs?.credits ?? 0) - 200, cargo: { ...(gs?.cargo ?? {}), 'Drogues de synthèse': ((gs?.cargo ?? {})['Drogues de synthèse'] ?? 0) + 1 } }, message: st('stationWander.lesBasFondsDeVega.0.c0noTargetMsg') }
          const q = quickQuest(gs!, 'delivery', 'Boro', st('stationWander.lesBasFondsDeVega.0.c0qTitle'), st('stationWander.lesBasFondsDeVega.0.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Pièces de contrebande', 2200, 5)
          return { gs: { credits: (gs?.credits ?? 0) - 100 }, message: st('stationWander.lesBasFondsDeVega.0.c0msg', { target: translateStationName(t.name) }), quest: q }
        }},
        { label: st('stationWander.lesBasFondsDeVega.0.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 6, credits: (gs?.credits ?? 0) + rng(100, 300) }, message: st('stationWander.lesBasFondsDeVega.0.c1msg') }) },
        { label: st('stationWander.lesBasFondsDeVega.0.c2'), result: () => ({ gs: {}, message: st('stationWander.lesBasFondsDeVega.0.c2msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.lesBasFondsDeVega.1.title'),
      description: st('stationWander.lesBasFondsDeVega.1.desc'),
      choices: [
        { label: st('stationWander.lesBasFondsDeVega.1.c0'), result: (gs) => ({ gs: { credits: Math.max(0, (gs?.credits ?? 0) - rng(100, 300)), reputation: (gs?.reputation ?? 0) + 5 }, message: st('stationWander.lesBasFondsDeVega.1.c0msg') }) },
        { label: st('stationWander.lesBasFondsDeVega.1.c1'), result: (gs) => Math.random() < 0.4
          ? { gs: { reputation: (gs?.reputation ?? 0) - 10 }, message: st('stationWander.lesBasFondsDeVega.1.c1msgLose') }
          : { gs: {}, message: st('stationWander.lesBasFondsDeVega.1.c1msgWin') }
        },
        { label: st('stationWander.lesBasFondsDeVega.1.c2'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 8 }, message: st('stationWander.lesBasFondsDeVega.1.c2msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.lesBasFondsDeVega.2.title'),
      description: st('stationWander.lesBasFondsDeVega.2.desc'),
      choices: [
        { label: st('stationWander.lesBasFondsDeVega.2.c0'), result: (gs) => {
          const ok = Math.random() < 0.55
          return ok
            ? { gs: { credits: (gs?.credits ?? 0) + rng(300, 800), cargo: { ...(gs?.cargo ?? {}), 'Données volées': ((gs?.cargo ?? {})['Données volées'] ?? 0) + 1 } }, message: st('stationWander.lesBasFondsDeVega.2.c0msgWin') }
            : { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(15, 35)) }, message: st('stationWander.lesBasFondsDeVega.2.c0msgLose') }
        }},
        { label: st('stationWander.lesBasFondsDeVega.2.c1'), result: () => ({ gs: {}, message: st('stationWander.lesBasFondsDeVega.2.c1msg') }) }
      ]
    }),
  ],

  'Arc Ouest Apocalypse': [
    (gs) => ({
      title: st('stationWander.arcOuestApocalypse.0.title'),
      description: st('stationWander.arcOuestApocalypse.0.desc'),
      choices: [
        { label: st('stationWander.arcOuestApocalypse.0.c0'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 10 }, message: st('stationWander.arcOuestApocalypse.0.c0msg') }) },
        { label: st('stationWander.arcOuestApocalypse.0.c1'), result: (gs) => {
          const t = gs && pickTarget(gs)
          if (!t || Math.random() < 0.35) return { gs: { reputation: (gs?.reputation ?? 0) + 5 }, message: st('stationWander.arcOuestApocalypse.0.c1noTargetMsg') }
          const q = quickQuest(gs!, 'sabotage', 'Cael', st('stationWander.arcOuestApocalypse.0.c1qTitle'), st('stationWander.arcOuestApocalypse.0.c1qDesc', { target: translateStationName(t.name) }), t.name, undefined, 3500, -5)
          return { gs: { reputation: gs!.reputation + 8 }, message: st('stationWander.arcOuestApocalypse.0.c1msg', { target: translateStationName(t.name) }), quest: q }
        }},
        { label: st('stationWander.arcOuestApocalypse.0.c2'), result: () => ({ gs: {}, message: st('stationWander.arcOuestApocalypse.0.c2msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.arcOuestApocalypse.1.title'),
      description: st('stationWander.arcOuestApocalypse.1.desc'),
      choices: [
        { label: st('stationWander.arcOuestApocalypse.1.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          if (!t) return { gs: { credits: (gs?.credits ?? 0) + 500 }, message: st('stationWander.arcOuestApocalypse.1.c0noTargetMsg') }
          const q = quickQuest(gs!, 'bounty', 'Source anonyme (Faucons)', st('stationWander.arcOuestApocalypse.1.c0qTitle'), st('stationWander.arcOuestApocalypse.1.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 5500, 15)
          return { gs: {}, message: st('stationWander.arcOuestApocalypse.1.c0msg', { target: translateStationName(t.name) }), quest: q }
        }},
        { label: st('stationWander.arcOuestApocalypse.1.c1'), result: () => ({ gs: {}, message: st('stationWander.arcOuestApocalypse.1.c1msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.arcOuestApocalypse.2.title'),
      description: st('stationWander.arcOuestApocalypse.2.desc'),
      choices: [
        { label: st('stationWander.arcOuestApocalypse.2.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'sabotage', 'Cael', st('stationWander.arcOuestApocalypse.2.c0qTitle', { target: translateStationName(t.name) }), st('stationWander.arcOuestApocalypse.2.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 4000, -8) : undefined
          return { gs: { reputation: gs!.reputation + 5, pastDecisions: addDecision(gs!, 'cael-contact') }, message: st('stationWander.arcOuestApocalypse.2.c0msg', { target: translateStationName(t?.name ?? st('stationWander.arcOuestApocalypse.2.c0fallbackTarget')) }), quest: q ?? undefined }
        }},
        { label: st('stationWander.arcOuestApocalypse.2.c1'), result: () => ({ gs: {}, message: st('stationWander.arcOuestApocalypse.2.c1msg') }) }
      ]
    }),
  ],

  'Le Purgatoire': [
    (gs) => ({
      title: st('stationWander.lePurgatoire.0.title'),
      description: st('stationWander.lePurgatoire.0.desc'),
      choices: [
        { label: st('stationWander.lePurgatoire.0.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'patrol', 'Neva', st('stationWander.lePurgatoire.0.c0qTitle'), st('stationWander.lePurgatoire.0.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 1100, 15) : undefined
          return { gs: { reputation: gs!.reputation + 6 }, message: st('stationWander.lePurgatoire.0.c0msg', { target: translateStationName(t?.name ?? st('stationWander.lePurgatoire.0.c0fallbackTarget')) }), quest: q ?? undefined }
        }},
        { label: st('stationWander.lePurgatoire.0.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 4 }, message: st('stationWander.lePurgatoire.0.c1msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.lePurgatoire.1.title'),
      description: st('stationWander.lePurgatoire.1.desc'),
      choices: [
        { label: st('stationWander.lePurgatoire.1.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'extraction', 'Ancien prisonnier', st('stationWander.lePurgatoire.1.c0qTitle', { target: translateStationName(t.name) }), st('stationWander.lePurgatoire.1.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Artefacts', 1600, 18) : undefined
          return { gs: { reputation: gs!.reputation + 8 }, message: st('stationWander.lePurgatoire.1.c0msg', { target: translateStationName(t?.name ?? st('stationWander.lePurgatoire.1.c0fallbackTarget')) }), quest: q ?? undefined }
        }},
        { label: st('stationWander.lePurgatoire.1.c1'), result: () => ({ gs: {}, message: st('stationWander.lePurgatoire.1.c1msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.lePurgatoire.2.title'),
      description: st('stationWander.lePurgatoire.2.desc'),
      choices: [
        { label: st('stationWander.lePurgatoire.2.c0'), result: (gs) => {
          const ok = Math.random() < 0.6
          return ok
            ? { gs: { credits: (gs?.credits ?? 0) + rng(400, 1000), cargo: { ...(gs?.cargo ?? {}), 'Artefacts': ((gs?.cargo ?? {})['Artefacts'] ?? 0) + 1 } }, message: st('stationWander.lePurgatoire.2.c0msgWin') }
            : { gs: { playerHp: Math.max(1, (gs?.playerHp ?? 50) - rng(20, 40)) }, message: st('stationWander.lePurgatoire.2.c0msgLose') }
        }},
        { label: st('stationWander.lePurgatoire.2.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 12 }, message: st('stationWander.lePurgatoire.2.c1msg') }) },
        { label: st('stationWander.lePurgatoire.2.c2'), result: () => ({ gs: {}, message: st('stationWander.lePurgatoire.2.c2msg') }) }
      ]
    }),
  ],

  'Fort Kharos': [
    (gs) => ({
      title: st('stationWander.fortKharos.0.title'),
      description: st('stationWander.fortKharos.0.desc'),
      choices: [
        { label: st('stationWander.fortKharos.0.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'revenge', 'Torvak', st('stationWander.fortKharos.0.c0qTitle'), st('stationWander.fortKharos.0.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 2800, 25) : undefined
          return { gs: { reputation: gs!.reputation + 10 }, message: st('stationWander.fortKharos.0.c0msg', { target: translateStationName(t?.name ?? st('stationWander.fortKharos.0.c0fallbackTarget')) }), quest: q ?? undefined }
        }},
        { label: st('stationWander.fortKharos.0.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 5 }, message: st('stationWander.fortKharos.0.c1msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.fortKharos.1.title'),
      description: st('stationWander.fortKharos.1.desc'),
      choices: [
        { label: st('stationWander.fortKharos.1.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'escort', 'Recrue désertrice', st('stationWander.fortKharos.1.c0qTitle'), st('stationWander.fortKharos.1.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 2000, -10) : undefined
          return { gs: { cargo: { ...(gs?.cargo ?? {}), 'Passager': ((gs?.cargo ?? {})['Passager'] ?? 0) + 1 }, pastDecisions: addDecision(gs!, 'helped-defector'), journal: addJournal(gs!, st('stationWander.fortKharos.1.c0journal'), 'decision') }, message: st('stationWander.fortKharos.1.c0msg', { target: translateStationName(t?.name ?? st('stationWander.fortKharos.1.c0fallbackTarget')) }), quest: q ?? undefined }
        }},
        { label: st('stationWander.fortKharos.1.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 6 }, message: st('stationWander.fortKharos.1.c1msg') }) },
        { label: st('stationWander.fortKharos.1.c2'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) - 15, credits: (gs?.credits ?? 0) + 300 }, message: st('stationWander.fortKharos.1.c2msg') }) }
      ]
    }),
  ],

  'Nexus Aldara': [
    (gs) => ({
      title: st('stationWander.nexusAldara.0.title'),
      description: st('stationWander.nexusAldara.0.desc'),
      choices: [
        { label: st('stationWander.nexusAldara.0.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'heist', 'Lira', st('stationWander.nexusAldara.0.c0qTitle', { target: translateStationName(t.name) }), st('stationWander.nexusAldara.0.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Données classifiées', 3200, 12) : undefined
          return { gs: { reputation: gs!.reputation + 8 }, message: st('stationWander.nexusAldara.0.c0msg', { target: translateStationName(t?.name ?? st('stationWander.nexusAldara.0.c0fallbackTarget')) }), quest: q ?? undefined }
        }},
        { label: st('stationWander.nexusAldara.0.c1'), result: (gs) => ({ gs: { credits: (gs?.credits ?? 0) + rng(500, 1200), reputation: (gs?.reputation ?? 0) - 25 }, message: st('stationWander.nexusAldara.0.c1msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.nexusAldara.1.title'),
      description: st('stationWander.nexusAldara.1.desc'),
      choices: [
        { label: st('stationWander.nexusAldara.1.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'escort', 'Hacker en fuite', st('stationWander.nexusAldara.1.c0qTitle', { target: translateStationName(t.name) }), st('stationWander.nexusAldara.1.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 2800, 10) : undefined
          return { gs: {}, message: st('stationWander.nexusAldara.1.c0msg', { target: translateStationName(t?.name ?? st('stationWander.nexusAldara.1.c0fallbackTarget')) }), quest: q ?? undefined }
        }},
        { label: st('stationWander.nexusAldara.1.c1'), result: () => ({ gs: {}, message: st('stationWander.nexusAldara.1.c1msg') }) }
      ]
    }),
  ],

  'Emporium Requiem': [
    (gs) => ({
      title: st('stationWander.emporiumRequiem.0.title'),
      description: st('stationWander.emporiumRequiem.0.desc'),
      choices: [
        { label: st('stationWander.emporiumRequiem.0.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          if (!t) return { gs: { credits: (gs?.credits ?? 0) + 400, reputation: (gs?.reputation ?? 0) + 8, pastDecisions: addDecision(gs!, 'pistis-ally'), pillarStanding: shiftPillar(gs!, 'cesarion', +8), journal: addJournal(gs!, st('stationWander.emporiumRequiem.0.c0noTargetJournal'), 'event') }, message: st('stationWander.emporiumRequiem.0.c0noTargetMsg') }
          const q = quickQuest(gs!, 'delivery', 'Pistis', st('stationWander.emporiumRequiem.0.c0qTitle'), st('stationWander.emporiumRequiem.0.c0qDesc', { target: translateStationName(t.name) }), t.name, 'Renseignements', 3000, 8)
          return { gs: { reputation: gs!.reputation + 8, pastDecisions: addDecision(gs!, 'pistis-ally'), pillarStanding: shiftPillar(gs!, 'cesarion', +8), journal: addJournal(gs!, st('stationWander.emporiumRequiem.0.c0journal'), 'event') }, message: st('stationWander.emporiumRequiem.0.c0msg', { target: translateStationName(t.name) }), quest: q }
        }},
        { label: st('stationWander.emporiumRequiem.0.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 3 }, message: st('stationWander.emporiumRequiem.0.c1msg') }) }
      ]
    }),
    (gs) => ({
      title: st('stationWander.emporiumRequiem.1.title'),
      description: st('stationWander.emporiumRequiem.1.desc'),
      choices: [
        { label: st('stationWander.emporiumRequiem.1.c0'), result: (gs) => {
          const ok = Math.random() < 0.6
          return ok
            ? { gs: { credits: (gs?.credits ?? 0) + rng(500, 1500), cargo: { ...(gs?.cargo ?? {}), 'Artefacts': ((gs?.cargo ?? {})['Artefacts'] ?? 0) + 1 } }, message: st('stationWander.emporiumRequiem.1.c0msgWin') }
            : { type: 'combat' as const, message: st('stationWander.emporiumRequiem.1.c0msgLose') }
        }},
        { label: st('stationWander.emporiumRequiem.1.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 5, credits: (gs?.credits ?? 0) + rng(100, 300) }, message: st('stationWander.emporiumRequiem.1.c1msg') }) }
      ]
    }),
  ],

  'La Forge Noire': [
    (gs) => ({
      title: st('stationWander.laForgeNoire.0.title'),
      description: st('stationWander.laForgeNoire.0.desc'),
      choices: [
        { label: st('stationWander.laForgeNoire.0.c0'), result: (gs) => {
          if (!gs || gs.credits < 800) return { gs: {}, message: st('stationWander.laForgeNoire.0.c0fail') }
          const arme = rollWeaponForTier(rng(2, 3))
          return { gs: { credits: gs.credits - 800, weapons: [...gs.weapons, arme] }, message: st('stationWander.laForgeNoire.0.c0msg', { weapon: arme.name }) }
        }},
        { label: st('stationWander.laForgeNoire.0.c1'), result: (gs) => {
          const t = gs && pickTarget(gs)
          const q = t ? quickQuest(gs!, 'extraction', 'Rook', st('stationWander.laForgeNoire.0.c1qTitle'), st('stationWander.laForgeNoire.0.c1qDesc', { target: translateStationName(t.name) }), t.name, 'Métaux rares', 800, 10) : undefined
          return { gs: {}, message: st('stationWander.laForgeNoire.0.c1msg', { target: translateStationName(t?.name ?? st('stationWander.laForgeNoire.0.c1fallbackTarget')) }), quest: q ?? undefined }
        }},
        { label: st('stationWander.laForgeNoire.0.c2'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 8 }, message: st('stationWander.laForgeNoire.0.c2msg') }) }
      ]
    }),
  ],

  'L\'Arc Perdu': [
    (gs) => ({
      title: st('stationWander.arcPerdu.0.title'),
      description: st('stationWander.arcPerdu.0.desc'),
      choices: [
        {
          label: st('stationWander.arcPerdu.0.c0'),
          result: (gs) => Math.random() < 0.30
            ? { gs: { playerHp: Math.max(1, gs!.playerHp - rng(40, 65)) }, message: st('stationWander.arcPerdu.0.c0msgWin') }
            : { gs: { isDead: true, deathCause: st('stationWander.arcPerdu.0.c0deathCause') }, message: st('stationWander.arcPerdu.0.c0msgLose') }
        },
        {
          label: st('stationWander.arcPerdu.0.c1'),
          result: (gs) => Math.random() < 0.20
            ? { gs: { isImprisoned: true, prisonDaysLeft: rng(2, 5), screen: 'prison' as const }, message: st('stationWander.arcPerdu.0.c1msgPrison') }
            : { gs: { isDead: true, deathCause: st('stationWander.arcPerdu.0.c1deathCause') }, message: st('stationWander.arcPerdu.0.c1msgDeath') }
        }
      ]
    }),

    (gs) => ({
      title: st('stationWander.arcPerdu.1.title'),
      description: st('stationWander.arcPerdu.1.desc'),
      choices: [
        {
          label: st('stationWander.arcPerdu.1.c0'),
          result: (gs) => {
            const roll = Math.random()
            if (roll < 0.25) return { gs: { reputation: gs!.reputation + 5, pillarStanding: shiftPillar(gs!, 'raphazarus', +8), pastDecisions: addDecision(gs!, 'passed-raphazarus-patrol'), journal: addJournal(gs!, st('stationWander.arcPerdu.1.c0journal'), 'event') }, message: st('stationWander.arcPerdu.1.c0msgPass') }
            if (roll < 0.60) return { gs: { pendingInterrogation: { faction: "Soldats de Raphazarus", captureStation: gs!.currentStation }, screen: 'interrogation' as const }, message: st('stationWander.arcPerdu.1.c0msgInterrogation') }
            return { gs: { isImprisoned: true, prisonDaysLeft: rng(3, 6), screen: 'prison' as const, playerHp: Math.max(1, gs!.playerHp - rng(20, 40)) }, message: st('stationWander.arcPerdu.1.c0msgPrison') }
          }
        },
        {
          label: st('stationWander.arcPerdu.1.c1'),
          result: (gs) => Math.random() < 0.35
            ? { gs: { playerHp: Math.max(1, gs!.playerHp - rng(15, 30)) }, message: st('stationWander.arcPerdu.1.c1msgWin') }
            : { gs: { isImprisoned: true, prisonDaysLeft: rng(4, 7), screen: 'prison' as const, playerHp: Math.max(1, gs!.playerHp - rng(30, 55)) }, message: st('stationWander.arcPerdu.1.c1msgLose') }
        },
        {
          label: st('stationWander.arcPerdu.1.c2'),
          result: (gs) => Math.random() < 0.50
            ? { gs: { pendingInterrogation: { faction: "Soldats de Raphazarus", captureStation: gs!.currentStation }, screen: 'interrogation' as const }, message: st('stationWander.arcPerdu.1.c2msgInterrogation') }
            : { gs: {}, message: st('stationWander.arcPerdu.1.c2msgPass') }
        }
      ]
    }),

    (gs) => ({
      title: st('stationWander.arcPerdu.2.title'),
      description: st('stationWander.arcPerdu.2.desc'),
      choices: [
        {
          label: st('stationWander.arcPerdu.2.c0'),
          result: (gs) => {
            const roll = Math.random()
            if (roll < 0.20) return { gs: { isDead: true, deathCause: st('stationWander.arcPerdu.2.c0deathCause') }, message: st('stationWander.arcPerdu.2.c0msgDeath') }
            if (roll < 0.55) return { gs: { playerHp: Math.max(1, gs!.playerHp - rng(35, 70)), cargo: { ...gs!.cargo, 'Artefacts': (gs!.cargo['Artefacts'] ?? 0) + 2 } }, message: st('stationWander.arcPerdu.2.c0msgHurt') }
            return { gs: { cargo: { ...gs!.cargo, 'Données pré-Fracture': (gs!.cargo['Données pré-Fracture'] ?? 0) + 1 }, credits: gs!.credits + rng(1000, 2500) }, message: st('stationWander.arcPerdu.2.c0msgJackpot') }
          }
        },
        {
          label: st('stationWander.arcPerdu.2.c1'),
          result: () => ({ gs: {}, message: st('stationWander.arcPerdu.2.c1msg') })
        }
      ]
    }),
  ],

  'Star Quest': [
    (gs) => ({
      title: st('stationWander.starQuest.0.title'),
      description: st('stationWander.starQuest.0.desc'),
      choices: [
        { label: st('stationWander.starQuest.0.c0'), result: (gs) => {
          const t = gs && pickTarget(gs)
          if (!t) return { gs: { reputation: gs!.reputation + 5 }, message: st('stationWander.starQuest.0.c0noTargetMsg') }
          const q = quickQuest(gs!, 'patrol', 'Ganz', st('stationWander.starQuest.0.c0qTitle'), st('stationWander.starQuest.0.c0qDesc', { target: translateStationName(t.name) }), t.name, undefined, 1800, 10)
          return { gs: { reputation: gs!.reputation + 5 }, message: st('stationWander.starQuest.0.c0msg', { target: translateStationName(t.name) }), quest: q }
        }},
        { label: st('stationWander.starQuest.0.c1'), result: (gs) => ({ gs: { reputation: (gs?.reputation ?? 0) + 2 }, message: st('stationWander.starQuest.0.c1msg') }) }
      ]
    }),
  ],
}

export function rollWanderEvent(gs: GameState): WanderEvent {
  const station = getStation(gs.currentStation)

  // 1. Mauvaise réputation → événements spécifiques (rep < -20, 40% de chance)
  if (gs.reputation < -20 && Math.random() < 0.40) {
    return pick(WANDER_EVENTS_BAD_REP)(gs)
  }

  // 2. Événements contextuels (20% de chance) — surprise selon l'état du joueur
  if (Math.random() < 0.20) {
    const ctx = rollContextAwareEvent(gs)
    if (ctx) return ctx
  }

  // 3. Événements de mémoire (25% si éligible — priorité narrative)
  if (Math.random() < 0.25) {
    const mem = rollMemoryEvent(gs)
    if (mem) return mem
  }

  // 4. Événement unique à cette station (30% de chance si disponible)
  const stationSpecific = STATION_WANDER_EVENTS[gs.currentStation]
  if (stationSpecific && stationSpecific.length > 0 && Math.random() < 0.30) {
    return pick(stationSpecific)(gs)
  }

  // 5. JSON ou TS générique
  const useJson = Math.random() < 0.55
  if (useJson) {
    const jsonPool =
      station.danger >= 3 ? getJsonWanderExtreme() :
      station.danger >= 2 ? getJsonWanderHigh() :
      station.danger >= 1 ? getJsonWanderMid() :
      getJsonWanderLow()
    if (jsonPool.length > 0) return pick(jsonPool)(gs)
  }
  const tsPool =
    station.danger >= 3 ? WANDER_EVENTS_HIGH :
    station.danger >= 2 ? WANDER_EVENTS_MID :
    WANDER_EVENTS_LOW
  return pick(tsPool)(gs)
}
