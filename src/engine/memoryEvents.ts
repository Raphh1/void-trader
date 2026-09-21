import type { GameState } from '../types'
import type { WanderEvent } from './exploration'
import { getAccessibleStations } from '../data/stations'
import i18n from '../i18n/config'
import { translateStationName } from './goodsI18n'

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const me = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'memoryEvents', ...params })

function addDecision(gs: GameState, d: string): string[] {
  const arr = gs.pastDecisions ?? []
  return arr.includes(d) ? arr : [...arr, d]
}
function shiftPillar(gs: GameState, pillar: keyof GameState['pillarStanding'], delta: number) {
  const cur = gs.pillarStanding ?? { cesarion: 0, raphazarus: 0, eliotis: 0, maxance: 0, alanossa: 0, scotty: 0 }
  return { ...cur, [pillar]: Math.max(-100, Math.min(100, (cur[pillar] ?? 0) + delta)) }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function pickTarget(gs: GameState) {
  const list = getAccessibleStations(gs.currentStation).filter(s => s.name !== gs.currentStation)
  return list.length > 0 ? pick(list) : null
}

// ── ÉVÉNEMENTS DE MÉMOIRE ─────────────────────────────────────────────────────
// Chaque entrée définit les conditions de déclenchement et l'événement produit.

export interface MemoryEventDef {
  id: string
  requires: {
    decisions?: string[]   // au moins une de ces décisions dans pastDecisions
    tags?: string[]        // au moins un de ces moralTags
    pillarThreshold?: { pillar: keyof GameState['pillarStanding']; min?: number; max?: number }
    minDay?: number
  }
  weight: number           // probabilité relative si plusieurs événements éligibles
  build: (gs: GameState) => WanderEvent
}

export const MEMORY_EVENT_DEFS: MemoryEventDef[] = [

  // ── MERCENAIRE CADOR ─────────────────────────────────────────────────────
  {
    id: 'cador-returns',
    requires: { decisions: ['saved-mercenary'] },
    weight: 3,
    build: (gs) => ({
      title: me('cadorReturns.title'),
      description: me('cadorReturns.description'),
      choices: [
        { label: me('cadorReturns.c0'), result: (gs) => {
          const t = pickTarget(gs)
          const q = t ? {
            id: Math.random().toString(36).slice(2,8),
            title: me('cadorReturns.questTitle', { station: translateStationName(t.name) }),
            titleI18n: { key: 'cadorReturns.questTitle', params: { station: t.name }, ns: 'memoryEvents' },
            giver: me('cadorReturns.questGiver'),
            giverI18n: { key: 'cadorReturns.questGiver', params: {}, ns: 'memoryEvents' },
            giverStation: gs.currentStation,
            type: 'bounty' as const,
            description: me('cadorReturns.questDesc', { station: translateStationName(t.name) }),
            descI18n: { key: 'cadorReturns.questDesc', params: { station: t.name }, ns: 'memoryEvents' },
            targetStation: t.name,
            creditReward: 4500,
            repReward: 30,
          } : undefined
          return { gs: { reputation: gs.reputation + 10 }, message: me('cadorReturns.c0Msg', { targetSuffix: t ? me('cadorReturns.c0TargetSuffix', { station: translateStationName(t.name) }) : '' }), quest: q }
        }},
        { label: me('cadorReturns.c1'), result: (gs) => ({
          gs: { credits: gs.credits + rng(300, 700) },
          message: me('cadorReturns.c1Msg')
        })},
        { label: me('cadorReturns.c2'), result: () => ({
          gs: {},
          message: me('cadorReturns.c2Msg')
        })}
      ]
    })
  },

  // ── TRANSFUGE TRAHIE ─────────────────────────────────────────────────────
  {
    id: 'transfuge-vengeance',
    requires: { decisions: ['betrayed-transfuge'] },
    weight: 4,
    build: (gs) => ({
      title: me('transfugeVengeance.title'),
      description: me('transfugeVengeance.description'),
      choices: [
        { label: me('transfugeVengeance.c0'), result: () => ({
          gs: {},
          message: me('transfugeVengeance.c0Msg')
        })},
        { label: me('transfugeVengeance.c1'), result: (gs) => {
          if (Math.random() < 0.25 + gs.reputation / 400) {
            return { gs: { reputation: gs.reputation + 8, pastDecisions: addDecision(gs, 'reconciled-transfuge') }, message: me('transfugeVengeance.c1Success') }
          }
          return { gs: { playerHp: Math.max(1, gs.playerHp - rng(20, 40)), reputation: gs.reputation - 10 }, message: me('transfugeVengeance.c1Fail') }
        }},
        { label: me('transfugeVengeance.c2'), result: (gs) => {
          if (gs.credits < 500) return { gs: {}, message: me('transfugeVengeance.c2Insufficient') }
          return { gs: { credits: gs.credits - 500, pastDecisions: addDecision(gs, 'bought-silence-transfuge') }, message: me('transfugeVengeance.c2Msg') }
        }}
      ]
    })
  },

  // ── SCIENTIFIQUE SAUVÉ ───────────────────────────────────────────────────
  {
    id: 'scientist-gift',
    requires: { decisions: ['aided-scientist'] },
    weight: 2,
    build: (gs) => ({
      title: me('scientistGift.title'),
      description: me('scientistGift.description'),
      choices: [
        { label: me('scientistGift.c0'), result: (gs) => {
          const roll = Math.random()
          if (roll < 0.40) return { gs: { cargo: { ...gs.cargo, 'Implants': (gs.cargo['Implants'] ?? 0) + 1 } }, message: me('scientistGift.c0Implant') }
          if (roll < 0.75) { const amount = rng(800, 1800); return { gs: { credits: gs.credits + amount }, message: me('scientistGift.c0Credits', { amount }) } }
          return { gs: { cargo: { ...gs.cargo, 'Données classifiées': (gs.cargo['Données classifiées'] ?? 0) + 1 }, reputation: gs.reputation + 15 }, message: me('scientistGift.c0Data') }
        }}
      ]
    })
  },

  // ── RÉPUTATION DE DÉLATEUR ───────────────────────────────────────────────
  {
    id: 'delateur-reputation',
    requires: { tags: ['délateur'] },
    weight: 3,
    build: (gs) => ({
      title: me('delateurReputation.title'),
      description: me('delateurReputation.description'),
      choices: [
        { label: me('delateurReputation.c0'), result: (gs) => {
          if (Math.random() < 0.3 + gs.reputation / 400) {
            return { gs: { reputation: gs.reputation + 5 }, message: me('delateurReputation.c0Success') }
          }
          return { gs: { reputation: gs.reputation - 12 }, message: me('delateurReputation.c0Fail') }
        }},
        { label: me('delateurReputation.c1'), result: (gs) => ({
          gs: { reputation: gs.reputation - 8, credits: gs.credits + rng(200, 500) },
          message: me('delateurReputation.c1Msg')
        })},
        { label: me('delateurReputation.c2'), result: () => ({
          gs: {},
          message: me('delateurReputation.c2Msg')
        })}
      ]
    })
  },

  // ── ÉVASION LÉGENDAIRE ───────────────────────────────────────────────────
  {
    id: 'escape-legend',
    requires: { decisions: ['escaped-interrogation'] },
    weight: 2,
    build: (gs) => ({
      title: me('escapeLegend.title'),
      description: me('escapeLegend.description'),
      choices: [
        { label: me('escapeLegend.c0'), result: (gs) => ({
          gs: { reputation: gs.reputation + 12 },
          message: me('escapeLegend.c0Msg')
        })},
        { label: me('escapeLegend.c1'), result: (gs) => ({
          gs: { reputation: gs.reputation - 5 },
          message: me('escapeLegend.c1Msg')
        })},
        { label: me('escapeLegend.c2'), result: (gs) => {
          const t = pickTarget(gs)
          if (!t) return { gs: { credits: gs.credits + rng(200, 500) }, message: me('escapeLegend.c2NoTarget') }
          const q = {
            id: Math.random().toString(36).slice(2,8),
            title: me('escapeLegend.questTitle', { station: translateStationName(t.name) }),
            titleI18n: { key: 'escapeLegend.questTitle', params: { station: t.name }, ns: 'memoryEvents' },
            giver: me('escapeLegend.questGiver'),
            giverI18n: { key: 'escapeLegend.questGiver', params: {}, ns: 'memoryEvents' },
            giverStation: gs.currentStation,
            type: 'extraction' as const,
            description: me('escapeLegend.questDesc', { station: translateStationName(t.name) }),
            descI18n: { key: 'escapeLegend.questDesc', params: { station: t.name }, ns: 'memoryEvents' },
            targetStation: t.name,
            creditReward: 5000,
            repReward: 20,
          }
          return { gs: { credits: gs.credits + rng(300, 600) }, message: me('escapeLegend.c2Msg', { station: translateStationName(t.name) }), quest: q }
        }}
      ]
    })
  },

  // ── PISTIS / EMPORIUM ────────────────────────────────────────────────────
  {
    id: 'pistis-recommends',
    requires: { decisions: ['pistis-ally'] },
    weight: 2,
    build: (gs) => ({
      title: me('pistisRecommends.title'),
      description: me('pistisRecommends.description'),
      choices: [
        { label: me('pistisRecommends.c0'), result: (gs) => {
          const t = pickTarget(gs)
          const q = t ? {
            id: Math.random().toString(36).slice(2,8),
            title: me('pistisRecommends.questTitle', { station: translateStationName(t.name) }),
            titleI18n: { key: 'pistisRecommends.questTitle', params: { station: t.name }, ns: 'memoryEvents' },
            giver: me('pistisRecommends.questGiver'),
            giverI18n: { key: 'pistisRecommends.questGiver', params: {}, ns: 'memoryEvents' },
            giverStation: gs.currentStation,
            type: 'delivery' as const,
            description: me('pistisRecommends.questDesc', { station: translateStationName(t.name) }),
            descI18n: { key: 'pistisRecommends.questDesc', params: { station: t.name }, ns: 'memoryEvents' },
            targetStation: t.name,
            creditReward: 3800,
            repReward: 15,
          } : undefined
          return {
            gs: { pillarStanding: shiftPillar(gs, 'cesarion', +10), factionReputation: { ...gs.factionReputation, emporium: gs.factionReputation.emporium + 8 } },
            message: me('pistisRecommends.c0Msg'),
            quest: q
          }
        }},
        { label: me('pistisRecommends.c1'), result: () => ({ gs: {}, message: me('pistisRecommends.c1Msg') })}
      ]
    })
  },

  // ── CAEL / FAUCONS ───────────────────────────────────────────────────────
  {
    id: 'cael-message',
    requires: { decisions: ['cael-contact'] },
    weight: 2,
    build: (gs) => ({
      title: me('caelMessage.title'),
      description: me('caelMessage.description'),
      choices: [
        { label: me('caelMessage.c0'), result: (gs) => {
          const t = pickTarget(gs)
          const q = t ? {
            id: Math.random().toString(36).slice(2,8),
            title: me('caelMessage.questTitle', { station: translateStationName(t.name) }),
            titleI18n: { key: 'caelMessage.questTitle', params: { station: t.name }, ns: 'memoryEvents' },
            giver: me('caelMessage.questGiver'),
            giverI18n: { key: 'caelMessage.questGiver', params: {}, ns: 'memoryEvents' },
            giverStation: gs.currentStation,
            type: 'sabotage' as const,
            description: me('caelMessage.questDesc', { station: translateStationName(t.name) }),
            descI18n: { key: 'caelMessage.questDesc', params: { station: t.name }, ns: 'memoryEvents' },
            targetStation: t.name,
            creditReward: 6000,
            repReward: -5,
          } : undefined
          return {
            gs: { factionReputation: { ...gs.factionReputation, faucons: gs.factionReputation.faucons + 12 } },
            message: me('caelMessage.c0Msg'),
            quest: q
          }
        }},
        { label: me('caelMessage.c1'), result: () => ({ gs: {}, message: me('caelMessage.c1Msg') })}
      ]
    })
  },

  // ── OPPORTUNISTE CONNU ───────────────────────────────────────────────────
  {
    id: 'opportunist-rep',
    requires: { tags: ['opportuniste'] },
    weight: 2,
    build: () => ({
      title: me('opportunistRep.title'),
      description: me('opportunistRep.description'),
      choices: [
        { label: me('opportunistRep.c0'), result: (gs) => {
          const t = pickTarget(gs)
          const q = t ? {
            id: Math.random().toString(36).slice(2,8),
            title: me('opportunistRep.questTitle', { station: translateStationName(t.name) }),
            titleI18n: { key: 'opportunistRep.questTitle', params: { station: t.name }, ns: 'memoryEvents' },
            giver: me('opportunistRep.questGiver'),
            giverI18n: { key: 'opportunistRep.questGiver', params: {}, ns: 'memoryEvents' },
            giverStation: gs.currentStation,
            type: 'heist' as const,
            description: me('opportunistRep.questDesc', { station: translateStationName(t.name) }),
            descI18n: { key: 'opportunistRep.questDesc', params: { station: t.name }, ns: 'memoryEvents' },
            targetStation: t.name,
            creditReward: 3500,
            repReward: -8,
          } : undefined
          return { gs: {}, message: me('opportunistRep.c0Msg'), quest: q }
        }},
        { label: me('opportunistRep.c1'), result: (gs) => ({
          gs: { reputation: gs.reputation + 5 },
          message: me('opportunistRep.c1Msg')
        })}
      ]
    })
  },

  // ── DÉSERTEUR EMMENÉ ─────────────────────────────────────────────────────
  {
    id: 'defector-gratitude',
    requires: { decisions: ['helped-defector'] },
    weight: 2,
    build: (gs) => ({
      title: me('defectorGratitude.title'),
      description: me('defectorGratitude.description'),
      choices: [
        { label: me('defectorGratitude.c0'), result: (gs) => ({
          gs: { reputation: gs.reputation + 15, pastDecisions: addDecision(gs, 'defector-network') },
          message: me('defectorGratitude.c0Msg')
        })},
        { label: me('defectorGratitude.c1'), result: () => ({
          gs: {},
          message: me('defectorGratitude.c1Msg')
        })}
      ]
    })
  },

  // ── TENSIONS PILIERS — CHASSEUR DE CESARION ──────────────────────────────
  {
    id: 'cesarion-bounty-hunter',
    requires: { pillarThreshold: { pillar: 'cesarion', max: -25 } },
    weight: 4,
    build: (gs) => ({
      title: me('cesarionBountyHunter.title'),
      description: me('cesarionBountyHunter.description'),
      choices: [
        { label: me('cesarionBountyHunter.c0'), result: (gs) => Math.random() < 0.40
          ? { gs: {}, message: me('cesarionBountyHunter.c0Success') }
          : { gs: { isImprisoned: true, prisonDaysLeft: rng(2, 4), screen: 'prison' as const }, message: me('cesarionBountyHunter.c0Fail') }
        },
        { label: me('cesarionBountyHunter.c1'), result: () => ({ type: 'combat' as const, message: me('cesarionBountyHunter.c1Msg') }) },
        { label: me('cesarionBountyHunter.c2'), result: (gs) => {
          if (gs.credits < 800) return { gs: {}, message: me('cesarionBountyHunter.c2Insufficient') }
          return {
            gs: { credits: gs.credits - 800, pillarStanding: shiftPillar(gs, 'cesarion', +15) },
            message: me('cesarionBountyHunter.c2Msg')
          }
        }}
      ]
    })
  },

  // ── TENSIONS PILIERS — FAVEUR DE RAPHAZARUS ──────────────────────────────
  {
    id: 'raphazarus-favor',
    requires: { pillarThreshold: { pillar: 'raphazarus', min: 30 } },
    weight: 2,
    build: (gs) => ({
      title: me('raphazarusFavor.title'),
      description: me('raphazarusFavor.description'),
      choices: [
        { label: me('raphazarusFavor.c0'), result: (gs) => {
          const roll = Math.random()
          if (roll < 0.5) return {
            gs: { cargo: { ...gs.cargo, 'Reliques': (gs.cargo['Reliques'] ?? 0) + 1, 'Artefacts': (gs.cargo['Artefacts'] ?? 0) + 1 } },
            message: me('raphazarusFavor.c0Relics')
          }
          const amount = rng(2000, 5000)
          return {
            gs: { credits: gs.credits + amount, reputation: gs.reputation + 20 },
            message: me('raphazarusFavor.c0Credits', { amount })
          }
        }},
        { label: me('raphazarusFavor.c1'), result: (gs) => ({
          gs: { pillarStanding: shiftPillar(gs, 'raphazarus', -10) },
          message: me('raphazarusFavor.c1Msg')
        })}
      ]
    })
  },

  // ── TENSIONS PILIERS — SCOTTY RECONNAISSANT ──────────────────────────────
  {
    id: 'scotty-network',
    requires: { pillarThreshold: { pillar: 'scotty', min: 20 } },
    weight: 2,
    build: (gs) => ({
      title: me('scottyNetwork.title'),
      description: me('scottyNetwork.description'),
      choices: [
        { label: me('scottyNetwork.c0'), result: (gs) => {
          const roll = Math.random()
          if (roll < 0.4) return { gs: { credits: gs.credits + rng(1000, 2500) }, message: me('scottyNetwork.c0Credits') }
          if (roll < 0.7) return { gs: { cargo: { ...gs.cargo, 'Spécialités festives': (gs.cargo['Spécialités festives'] ?? 0) + 2 } }, message: me('scottyNetwork.c0Goods') }
          return { gs: { playerHp: Math.min(gs.playerMaxHp, gs.playerHp + rng(20, 40)), stamina: Math.min(gs.maxStamina, gs.stamina + 2) }, message: me('scottyNetwork.c0Medical') }
        }},
        { label: me('scottyNetwork.c1'), result: () => ({ gs: {}, message: me('scottyNetwork.c1Msg') })}
      ]
    })
  },

]

// ── SÉLECTION D'UN ÉVÉNEMENT DE MÉMOIRE ──────────────────────────────────────

export function rollMemoryEvent(gs: GameState): WanderEvent | null {
  const decisions = gs.pastDecisions ?? []
  const tags = gs.moralTags ?? []
  const standing = gs.pillarStanding ?? { cesarion: 0, raphazarus: 0, eliotis: 0, maxance: 0, alanossa: 0, scotty: 0 }

  const eligible = MEMORY_EVENT_DEFS.filter(def => {
    const r = def.requires
    if (r.decisions && !r.decisions.some(d => decisions.includes(d))) return false
    if (r.tags && !r.tags.some(t => tags.includes(t))) return false
    if (r.pillarThreshold) {
      const val = standing[r.pillarThreshold.pillar] ?? 0
      if (r.pillarThreshold.min !== undefined && val < r.pillarThreshold.min) return false
      if (r.pillarThreshold.max !== undefined && val > r.pillarThreshold.max) return false
    }
    if (r.minDay && gs.day < r.minDay) return false
    return true
  })

  if (eligible.length === 0) return null

  // Tirage pondéré
  const total = eligible.reduce((s, e) => s + e.weight, 0)
  let rand = Math.random() * total
  for (const e of eligible) {
    rand -= e.weight
    if (rand <= 0) return e.build(gs)
  }
  return eligible[eligible.length - 1].build(gs)
}

// ── UTILITAIRES EXPORT ────────────────────────────────────────────────────────

export { addDecision, shiftPillar }
