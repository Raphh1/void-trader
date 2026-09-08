import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { getSubBossesForPillar } from '../data/subBosses'
import { getStations } from '../data/stations'
import { getTierBoss } from '../data/enemies'
import { canResolveSubBoss, resolveSubBoss, getResolutionMeta, pactProgress, breakPact } from '../engine/subBossResolutions'
import type { GameState } from '../types'

beforeAll(async () => {
  await initI18n()
})

const subs = () =>
  ['alanossa', 'cesarion', 'raphazarus', 'scotty'].flatMap(p => getSubBossesForPillar(p))

function baseGs(over: Partial<GameState> = {}): GameState {
  return {
    credits: 0, reputation: 0, day: 1, cargo: {},
    combatsWon: 0, visitedStations: [], stationBossesBeaten: [],
    completedQuestIds: [], subBossesDefeated: {}, pastDecisions: [],
    pillarStanding: {}, factionReputation: { faucons: 0, emporium: 0, gardiens: 0, culte: 0 },
    ...over,
  } as unknown as GameState
}

describe('demandes propres à chaque lieutenant', () => {
  it('donne à chacun des 16 lieutenants un prix de rachat et un service', () => {
    expect(subs()).toHaveLength(16)
    for (const sb of subs()) {
      expect(sb.bribe?.credits, sb.name).toBeGreaterThan(0)
      expect(sb.service?.requirements.length, sb.name).toBeGreaterThan(0)
      expect(sb.resolutions, sb.name).toContain('bribe')
      expect(sb.resolutions, sb.name).toContain('service')
    }
  })

  it('fait parler chaque lieutenant : une demande écrite, propre à lui', () => {
    const seen = new Set<string>()
    for (const sb of subs()) {
      const demand = sb.service!.demand
      expect(demand, sb.name).toBeTruthy()
      // pas une clé i18n non résolue
      expect(demand, sb.name).not.toMatch(/^[a-z]+\d\.serviceDemand$/)
      // un vrai texte, pas un libellé de deux mots
      expect(demand.length, sb.name).toBeGreaterThan(120)
      seen.add(demand)
    }
    expect(seen.size).toBe(subs().length)
  })

  it('donne à chacun un service RÉELLEMENT différent', () => {
    // Tout l'intérêt de la fonctionnalité : plus de conditions génériques.
    const signatures = subs().map(sb =>
      JSON.stringify(sb.service?.requirements.map(r => Object.values(r)).sort()))
    expect(new Set(signatures).size).toBe(subs().length)
  })

  it('fait monter le prix de rachat avec le rang du lieutenant', () => {
    for (const pillar of ['alanossa', 'cesarion', 'raphazarus', 'scotty']) {
      const byOrder = subs().filter(s => s.pillar === pillar).sort((a, b) => a.order - b.order)
      for (let i = 1; i < byOrder.length; i++) {
        expect(byOrder[i].bribe!.credits, `${pillar} o${byOrder[i].order}`)
          .toBeGreaterThan(byOrder[i - 1].bribe!.credits)
      }
    }
  })
})

describe('intégrité des conditions de service', () => {
  // Une faute de frappe rendrait un service impossible à satisfaire pour
  // toujours — donc un lieutenant infranchissable autrement qu'au combat.
  it('ne référence que des objets, stations, boss et lieutenants existants', () => {
    const goods = new Set(getStations().flatMap(s => s.goods))
    const stations = new Set(getStations().map(s => s.name))
    const bosses = new Set(getTierBoss().map(e => e.name))
    const ids = new Set(subs().map(s => s.id))

    for (const sb of subs()) {
      for (const req of sb.service!.requirements) {
        if (req.type === 'item') expect(goods, `${sb.name} → ${req.name}`).toContain(req.name)
        if (req.type === 'visitStation') expect(stations, `${sb.name} → ${req.station}`).toContain(req.station)
        if (req.type === 'bossKill') expect(bosses, `${sb.name} → ${req.bossName}`).toContain(req.bossName)
        if (req.type === 'subBoss') expect(ids, `${sb.name} → ${req.subBossId}`).toContain(req.subBossId)
      }
    }
  })

  it('ne demande jamais à un lieutenant de dépendre de lui-même', () => {
    for (const sb of subs()) {
      for (const req of sb.service!.requirements) {
        if (req.type === 'subBoss') expect(req.subBossId, sb.name).not.toBe(sb.id)
      }
    }
  })
})

describe('résolution par rachat et par service', () => {
  it('refuse le rachat sans les fonds, l\'accepte avec', () => {
    const sb = subs()[0]
    const price = sb.bribe!.credits

    const poor = canResolveSubBoss(baseGs({ credits: price - 1 }), sb, 'bribe')
    expect(poor.ok).toBe(false)
    expect(poor.reason).toBeTruthy()

    const rich = canResolveSubBoss(baseGs({ credits: price }), sb, 'bribe')
    expect(rich.ok).toBe(true)
  })

  it('débite le prix et neutralise le lieutenant au rachat', () => {
    const sb = subs()[0]
    const price = sb.bribe!.credits
    const gs = baseGs({ credits: price + 500 })
    const res = resolveSubBoss(gs, sb, 'bribe')

    expect(res.success).toBe(true)
    expect(res.patch.credits).toBe(500)
    expect(Object.values(res.patch.subBossesDefeated ?? {}).flat()).toContain(sb.id)
  })

  it('propose de s\'engager tant que le marché n\'est pas accepté', () => {
    const sb = subs().find(s => s.service!.requirements.some(r => r.type === 'item'))!
    const check = canResolveSubBoss(baseGs(), sb, 'service')

    // Sans marché, le bouton sert à accepter — donc actionnable même sans rien.
    expect(check.ok).toBe(true)
    expect(check.hint).toBeTruthy()
    expect(check.hint).not.toMatch(/^service\.|^canResolve\./)
  })

  it('énumère ce qui manque une fois le marché accepté', () => {
    const sb = subs().find(s => s.service!.requirements.some(r => r.type === 'item'))!
    const gs = baseGs({ lieutenantPacts: [sb.id] })
    const check = canResolveSubBoss(gs, sb, 'service')

    expect(check.ok).toBe(false)
    expect(check.reason).toBeTruthy()
    // jamais de clé i18n brute affichée au joueur
    expect(check.reason).not.toMatch(/^service\.|^canResolve\./)
    expect(check.hint).not.toMatch(/^service\.|^canResolve\./)
  })

  it('consomme les objets et crédits exigés une fois le service rendu', () => {
    const sb = subs().find(s => s.service!.requirements.some(r => r.type === 'item'))!
    const gs = baseGs({
      lieutenantPacts: [sb.id],
      credits: 100000, reputation: 100, day: 99, combatsWon: 99,
      visitedStations: getStations().map(s => s.name),
      completedQuestIds: Array.from({ length: 20 }, (_, i) => `q${i}`),
      subBossesDefeated: { alanossa: ['ala-3'], cesarion: ['ces-3'], scotty: ['sco-3'] },
      pillarStanding: { alanossa: 99, cesarion: 99, raphazarus: 99, scotty: 99, eliotis: 99, maxance: 99 },
      factionReputation: { faucons: 99, emporium: 99, gardiens: 99, culte: 99 },
      cargo: Object.fromEntries(getStations().flatMap(s => s.goods).map(g => [g, 99])),
    })

    expect(canResolveSubBoss(gs, sb, 'service').ok).toBe(true)
    const res = resolveSubBoss(gs, sb, 'service')
    expect(res.success).toBe(true)

    const itemReq = sb.service!.requirements.find(r => r.type === 'item')!
    if (itemReq.type === 'item') {
      expect(res.patch.cargo![itemReq.name]).toBe(99 - itemReq.qty)
    }
  })

  it('suit le cycle complet : accepter → suivre → honorer', () => {
    const sb = subs().find(s => s.service!.requirements.some(r => r.type === 'item'))!

    // 1. accepter : le marché s'ouvre et entre au journal
    const accepted = resolveSubBoss(baseGs(), sb, 'service')
    expect(accepted.patch.lieutenantPacts).toContain(sb.id)
    expect(accepted.patch.journal?.length).toBeGreaterThan(0)
    // le lieutenant n'est PAS encore neutralisé
    expect(Object.values(accepted.patch.subBossesDefeated ?? {}).flat()).not.toContain(sb.id)

    // 2. suivre : la progression liste ce qui manque
    const pending = pactProgress(baseGs({ lieutenantPacts: [sb.id] }), sb)
    expect(pending.done).toBe(false)
    expect(pending.missing.length).toBeGreaterThan(0)

    // 3. honorer : il se retire et le marché se referme
    const ready = baseGs({
      lieutenantPacts: [sb.id], credits: 100000, reputation: 100, day: 99, combatsWon: 99,
      visitedStations: getStations().map(s => s.name),
      completedQuestIds: Array.from({ length: 20 }, (_, i) => `q${i}`),
      subBossesDefeated: { alanossa: ['ala-3'], cesarion: ['ces-3'], scotty: ['sco-3'] },
      pillarStanding: { alanossa: 99, cesarion: 99, raphazarus: 99, scotty: 99, eliotis: 99, maxance: 99 },
      factionReputation: { faucons: 99, emporium: 99, gardiens: 99, culte: 99 },
      cargo: Object.fromEntries(getStations().flatMap(s => s.goods).map(g => [g, 99])),
    })
    expect(pactProgress(ready, sb).done).toBe(true)
    const honored = resolveSubBoss(ready, sb, 'service')
    expect(honored.success).toBe(true)
    expect(honored.patch.lieutenantPacts).not.toContain(sb.id)
    expect(Object.values(honored.patch.subBossesDefeated ?? {}).flat()).toContain(sb.id)
  })

  it('ferme définitivement la voie du service quand on rompt sa parole', () => {
    const sb = subs()[0]
    const broken = breakPact(baseGs({ lieutenantPacts: [sb.id] }), sb)

    expect(broken.patch.brokenPacts).toContain(sb.id)
    expect(broken.patch.lieutenantPacts).not.toContain(sb.id)

    // même en remplissant tout, il ne renégocie plus
    const after = baseGs({
      brokenPacts: [sb.id], credits: 100000, reputation: 100, day: 99, combatsWon: 99,
      visitedStations: getStations().map(s => s.name),
      cargo: Object.fromEntries(getStations().flatMap(s => s.goods).map(g => [g, 99])),
    })
    const check = canResolveSubBoss(after, sb, 'service')
    expect(check.ok).toBe(false)
    expect(check.reason).not.toMatch(/^service\.|^canResolve\./)
  })

  it('expose un libellé traduit pour les deux nouvelles voies', () => {
    const meta = getResolutionMeta()
    for (const action of ['bribe', 'service'] as const) {
      expect(meta[action].label).toBeTruthy()
      expect(meta[action].label).not.toMatch(/^meta\./)
      expect(meta[action].icon).toBeTruthy()
    }
  })
})
