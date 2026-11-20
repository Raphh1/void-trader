import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { useGameStore } from '../store/gameStore'
import { getClasses } from '../data/classes'
import { getEnemyForStation } from '../data/enemies'
import {
  generateQuest, generateChainQuest, recordVictoryForQuests, checkQuestsOnArrival, CARRY_TYPES,
} from '../engine/quests'
import type { GameState, Quest, QuestType } from '../types'

let base: GameState
beforeAll(async () => {
  await initI18n()
  useGameStore.getState().selectClass(getClasses().find(c => c.name === 'Marchand')!)
  base = { ...useGameStore.getState().gs!, activeQuests: [] }
})

const at = (station: string, extra: Partial<GameState> = {}): GameState => ({ ...base, currentStation: station, ...extra })

describe('variété des quêtes proposées', () => {
  it("le transport n'est plus la majorité des offres, depuis aucun point de départ", () => {
    const parType = new Map<QuestType, number>()
    let total = 0
    for (const c of getClasses()) {
      for (let i = 0; i < 300; i++) {
        const q = generateQuest(at(c.startStation))
        if (!q) continue
        total++
        parType.set(q.type, (parType.get(q.type) ?? 0) + 1)
      }
    }
    const transport = CARRY_TYPES.reduce((n, t) => n + (parType.get(t) ?? 0), 0) / total
    console.log('\n── OFFRES DE QUÊTES (départs de toutes les classes) ──')
    for (const [t, n] of [...parType].sort((a, b) => b[1] - a[1])) console.log('  ' + t.padEnd(12) + `${Math.round(n / total * 100)} %`)
    console.log(`  transport : ${Math.round(transport * 100)} %`)
    expect(transport).toBeLessThan(0.45)
    expect(parType.get('hunt') ?? 0).toBeGreaterThan(0)
    expect(parType.get('mediation') ?? 0).toBeGreaterThan(0)
  })

  it("« changer d'offre » propose un autre type que celui qu'on refuse", () => {
    for (let i = 0; i < 300; i++) {
      expect(generateQuest(at('Port Méridien'), 'delivery')?.type).not.toBe('delivery')
    }
  })

  it('un type déjà en cours revient nettement moins souvent', () => {
    const livraisons = (gs: GameState) => Array.from({ length: 2000 }, () => generateQuest(gs)).filter(q => q?.type === 'delivery').length
    const enCours = generateQuest(at('Port Méridien'))!
    const sans = livraisons(at('Port Méridien'))
    const avec = livraisons(at('Port Méridien', { activeQuests: [{ ...enCours, type: 'delivery', targetStation: 'Station Rocaille' }] }))
    expect(avec).toBeLessThan(sans * 0.6)
  })

  it('les chasses et médiations peuvent se faire sur place, sans voyager', () => {
    const locales = Array.from({ length: 600 }, () => generateQuest(at('Port Méridien')))
      .filter(q => (q?.type === 'hunt' || q?.type === 'mediation') && q.targetStation === 'Port Méridien')
    expect(locales.length).toBeGreaterThan(0)
  })

  it("une suite de livraison n'est plus une livraison", () => {
    const livraison = { ...generateQuest(at('Port Méridien'))!, type: 'delivery' as const }
    for (let i = 0; i < 500; i++) {
      const suite = generateChainQuest(livraison, at('Port Méridien'))
      if (suite) expect(CARRY_TYPES.includes(suite.type) && suite.type !== 'escort').toBe(false)
    }
  })
})

describe('chasse', () => {
  it('se valide après le bon nombre de victoires sur place, pas ailleurs', () => {
    const chasse: Quest = { ...generateQuest(at('Port Méridien'))!, type: 'hunt', targetStation: 'Fort Kharos', goal: 2, progress: 0 }
    const ennemi = getEnemyForStation('Fort Kharos', 1, 1)

    let gs = at('Port Méridien', { activeQuests: [chasse] })
    gs = { ...gs, activeQuests: recordVictoryForQuests(gs, ennemi) }
    expect(gs.activeQuests[0].progress).toBe(0)

    gs = { ...gs, currentStation: 'Fort Kharos' }
    gs = { ...gs, activeQuests: recordVictoryForQuests(gs, ennemi) }
    expect(checkQuestsOnArrival(gs).completed).toHaveLength(0)
    gs = { ...gs, activeQuests: recordVictoryForQuests(gs, ennemi) }
    expect(checkQuestsOnArrival(gs).completed.map(q => q.id)).toEqual([chasse.id])
  })
})

describe('médiation', () => {
  it("se règle en battant l'homme de main, mieux payée mais moins respectée", () => {
    const med: Quest = { ...generateQuest(at('Port Méridien'))!, type: 'mediation', targetStation: 'Port Méridien', creditReward: 1000, repReward: 20 }
    const gs = at('Port Méridien', { activeQuests: [med] })
    const homme = { ...getEnemyForStation('Port Méridien', 4, 1), questId: med.id }

    expect(checkQuestsOnArrival(gs).completed).toHaveLength(0)
    const apres = { ...gs, activeQuests: recordVictoryForQuests(gs, homme) }
    const [reglee] = checkQuestsOnArrival(apres).completed
    expect(reglee.creditReward).toBe(1200)
    expect(reglee.repReward).toBe(10)
  })

  it('un combat ordinaire ne règle pas une médiation', () => {
    const med: Quest = { ...generateQuest(at('Port Méridien'))!, type: 'mediation', targetStation: 'Port Méridien' }
    const gs = at('Port Méridien', { activeQuests: [med] })
    const apres = { ...gs, activeQuests: recordVictoryForQuests(gs, getEnemyForStation('Port Méridien', 2, 1)) }
    expect(checkQuestsOnArrival(apres).completed).toHaveLength(0)
  })
})
