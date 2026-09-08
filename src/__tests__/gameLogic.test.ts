import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import {
  getStations, getStation, findPath, getFuelCost,
  BOSS_STATIONS, FUEL_STATIONS, PEACEFUL_STATIONS,
} from '../data/stations'
import { getEnemyForStation, getTierLow, getTierBoss, getArenaFighters, scaleEnemy } from '../data/enemies'
import { getFullBuyMult, getFullSellMult } from '../engine/marketPricing'
import { getClasses } from '../data/classes'
import type { GameState } from '../types'

beforeAll(async () => {
  await initI18n()
})

describe('intégrité du graphe de stations', () => {
  it('a des stations avec des noms uniques', () => {
    const names = getStations().map(s => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('ne référence que des stations existantes dans fuelCostFrom', () => {
    const known = new Set(getStations().map(s => s.name))
    for (const station of getStations()) {
      for (const from of Object.keys(station.fuelCostFrom)) {
        expect(known, `${station.name}.fuelCostFrom référence "${from}"`).toContain(from)
      }
    }
  })

  it('ne référence que des stations existantes dans les ensembles spéciaux', () => {
    const known = new Set(getStations().map(s => s.name))
    for (const name of [...FUEL_STATIONS, ...PEACEFUL_STATIONS, ...Object.keys(BOSS_STATIONS)]) {
      expect(known, `station inconnue : "${name}"`).toContain(name)
    }
  })

  it('rend toute station atteignable depuis le point de départ de chaque classe', () => {
    // Une station orpheline serait un contenu définitivement inaccessible.
    const starts = [...new Set(getClasses().map(c => c.startStation))]
    for (const start of starts) {
      for (const target of getStations()) {
        if (target.name === start) continue
        const path = findPath(start, target.name)
        expect(path.length, `aucune route ${start} → ${target.name}`).toBeGreaterThan(0)
      }
    }
  })

  it('renvoie un chemin qui commence et finit aux bonnes stations', () => {
    const path = findPath('La Carcasse', 'Port Méridien')
    expect(path[0]).toBe('La Carcasse')
    expect(path[path.length - 1]).toBe('Port Méridien')
  })

  it('renvoie un coût en carburant strictement positif entre stations reliées', () => {
    for (const station of getStations()) {
      for (const from of Object.keys(station.fuelCostFrom)) {
        expect(getFuelCost(from, station.name)).toBeGreaterThan(0)
      }
    }
  })
})

describe('pools d\'ennemis par station', () => {
  it('ne retombe jamais silencieusement sur l\'ennemi par défaut', () => {
    // Les pools sont construits par nom : une faute de frappe ferait passer
    // discrètement toutes les rencontres d'une station sur TIER_LOW[0].
    const fallback = getTierLow()[0].name
    for (const station of getStations()) {
      const drawn = new Set<string>()
      for (let i = 0; i < 40; i++) drawn.add(getEnemyForStation(station.name, 5, 20).name)
      expect(drawn.size, `${station.name} ne tire qu'un seul ennemi`).toBeGreaterThan(1)
      expect(
        drawn.size === 1 && drawn.has(fallback),
        `${station.name} retombe sur le fallback`,
      ).toBe(false)
    }
  })

  it('donne à chaque ennemi des stats cohérentes', () => {
    for (const e of [...getTierLow(), ...getTierBoss(), ...getArenaFighters()]) {
      expect(e.maxHp, e.name).toBeGreaterThan(0)
      expect(e.damageMax, e.name).toBeGreaterThanOrEqual(e.damageMin)
      expect(e.lootMax, e.name).toBeGreaterThanOrEqual(e.lootMin)
      expect(e.description, e.name).toBeTruthy()
    }
  })

  it('monte les stats en échelle sans jamais les faire régresser', () => {
    const base = getTierLow()[0]
    const scaled = scaleEnemy(base, 3)
    expect(scaled.maxHp).toBeGreaterThan(base.maxHp)
    expect(scaled.damageMin).toBeGreaterThanOrEqual(base.damageMin)
    expect(scaled.name).toBe(base.name)
  })
})

describe('économie', () => {
  const gs = { currentStation: 'La Carcasse', pillarStanding: {} } as unknown as GameState

  it('rend impossible l\'arbitrage sur une même station', () => {
    // Régression du fix 1.4 : acheter puis revendre au même endroit doit
    // toujours être perdant, quels que soient le type de station et l'objet.
    const types = [...new Set(getStations().map(s => s.type))]
    const items = [...new Set(getStations().flatMap(s => s.goods))]
    for (const type of types) {
      for (const item of items) {
        const buy = getFullBuyMult(gs, type, item)
        const sell = getFullSellMult(gs, type, item)
        expect(buy, `${type} / ${item}`).toBeGreaterThan(sell)
      }
    }
  })

  it('garde un prix de revente plancher strictement positif', () => {
    for (const type of [...new Set(getStations().map(s => s.type))]) {
      expect(getFullSellMult(gs, type, 'Médicaments')).toBeGreaterThanOrEqual(0.40)
    }
  })
})

describe('classes jouables', () => {
  it('démarre chaque classe sur une station existante', () => {
    for (const c of getClasses()) {
      expect(() => getStation(c.startStation), c.name).not.toThrow()
    }
  })

  it('donne à chaque classe des stats de départ viables', () => {
    for (const c of getClasses()) {
      expect(c.startHp, c.name).toBeGreaterThan(0)
      expect(c.maxFuel, c.name).toBeGreaterThan(0)
      expect(c.startFuel, c.name).toBeGreaterThan(0)
      expect(c.startFuel, c.name).toBeLessThanOrEqual(c.maxFuel)
      expect(c.startCredits, c.name).toBeGreaterThanOrEqual(0)
    }
  })
})
