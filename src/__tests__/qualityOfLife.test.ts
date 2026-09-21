import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { priceTrend, bestSeenElsewhere } from '../engine/priceMemory'
import { getDailySetup, dailyScore } from '../engine/daily'
import { getClasses } from '../data/classes'
import { useGameStore, AVAILABLE_CLASSES } from '../store/gameStore'

// Mémoire des prix, défi du jour, faits marquants de la run.

beforeAll(async () => { await initI18n() })

describe('mémoire des prix', () => {
  const memoire = {
    'Port Méridien': { day: 3, buy: { Outils: 200 }, sell: { Outils: 150 } },
    'La Carcasse':   { day: 5, buy: { Outils: 170 }, sell: { Outils: 190 } },
    'Nexus Aldara':  { day: 6, buy: { Outils: 240 }, sell: { Outils: 120 } },
  }

  it('donne la tendance depuis la dernière visite, en ignorant le bruit', () => {
    expect(priceTrend(memoire['Port Méridien'], 'buy', 'Outils', 240)).toEqual({ pct: 20 })
    expect(priceTrend(memoire['Port Méridien'], 'buy', 'Outils', 202), 'variation de 1 %').toBeNull()
    expect(priceTrend(undefined, 'buy', 'Outils', 200), 'première visite').toBeNull()
  })

  it('retrouve le meilleur prix vu ailleurs, à l\'achat comme à la vente', () => {
    expect(bestSeenElsewhere(memoire, 'Port Méridien', 'buy', 'Outils')).toEqual({ price: 170, station: 'La Carcasse', day: 5 })
    expect(bestSeenElsewhere(memoire, 'Port Méridien', 'sell', 'Outils')).toEqual({ price: 190, station: 'La Carcasse', day: 5 })
    // La station courante n'est jamais comptée comme « ailleurs ».
    expect(bestSeenElsewhere(memoire, 'La Carcasse', 'buy', 'Outils')!.station).toBe('Port Méridien')
    expect(bestSeenElsewhere(memoire, 'Port Méridien', 'buy', 'Or')).toBeNull()
  })
})

describe('défi du jour', () => {
  it('donne le même départ à tout le monde un jour donné, et change d\'un jour à l\'autre', () => {
    const a = getDailySetup('2026-09-21')
    expect(getDailySetup('2026-09-21')).toEqual(a)
    expect(getClasses().some(c => c.name === a.className)).toBe(true)
    expect(a.modIds).toHaveLength(2)
    const semaine = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'].map(d => getDailySetup(d))
    expect(semaine.some(s => s.className !== a.className || s.modIds.join() !== a.modIds.join())).toBe(true)
  })

  it('fixe aussi l\'objectif, les reliques proposées et les concurrents', () => {
    const lancer = () => {
      const cls = AVAILABLE_CLASSES[0]
      useGameStore.getState().newGame()
      useGameStore.getState().selectClass(cls, [], [], '2026-09-21')
      const gs = useGameStore.getState().gs!
      return { obj: gs.runObjectiveId, reliques: gs.pendingRelicChoice?.options, rivaux: gs.competitors.map(c => c.name + c.station) }
    }
    expect(lancer()).toEqual(lancer())
    expect(useGameStore.getState().gs!.dailyChallenge).toBe('2026-09-21')
    const gsFin = useGameStore.getState().gs!
    expect(dailyScore({ totalCreditsEarned: gsFin.class.startCredits + 4200, class: gsFin.class }), 'hors crédits de départ').toBe(4200)
  })
})

describe('faits marquants de la run', () => {
  it('retient le plus gros gain et la plus grosse perte d\'un seul coup', () => {
    useGameStore.getState().newGame()
    useGameStore.getState().selectClass(AVAILABLE_CLASSES[0], [])
    const { patch } = useGameStore.getState()
    const base = useGameStore.getState().gs!.credits
    patch({ credits: base + 300 })
    patch({ credits: base + 1500 })   // +1200 d'un coup
    patch({ credits: base + 100 })    // −1400 d'un coup
    patch({ credits: base + 50 })
    const h = useGameStore.getState().gs!.runHighlights
    expect(h.bestGain!.amount).toBe(1200)
    expect(h.worstLoss!.amount).toBe(1400)
  })
})
