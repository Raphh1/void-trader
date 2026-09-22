import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import {
  getStations, getFuelCost, getAccessibleStations, fuelToNearestRefuel, getFuelPrice, sellsFuel,
  FUEL_DEPOTS, NO_FUEL_STATIONS, FUEL_DEPOT_PRICE,
} from '../data/stations'

// Joueur bloqué à La Couronne d'Eos avec 2 de carburant : aucune pompe à moins
// de 6 sauts, et deux voisins accessibles qui étaient des impasses. Désormais
// presque toutes les stations vendent du carburant, à un prix qui dépend du type
// de station et de son isolement ; seuls quelques lieux morts n'en vendent pas.

beforeAll(async () => { await initI18n() })

const PLUS_PETIT_RESERVOIR = 5

describe('carburant vendu partout, à prix variable', () => {
  it("vend du carburant à La Couronne d'Eos, mais cher", () => {
    const prix = getFuelPrice("La Couronne d'Eos")
    expect(prix).not.toBeNull()
    expect(prix!).toBeGreaterThan(FUEL_DEPOT_PRICE * 2)
    expect(fuelToNearestRefuel("La Couronne d'Eos")).toBe(0)
  })

  it('garde les dépôts au prix plancher et les lieux morts sans pompe', () => {
    for (const d of FUEL_DEPOTS) expect(getFuelPrice(d), d).toBe(FUEL_DEPOT_PRICE)
    for (const n of NO_FUEL_STATIONS) expect(getFuelPrice(n), n).toBeNull()
  })

  it('étale les prix entre le plancher et environ cinq fois plus', () => {
    const prix = getStations().map(s => getFuelPrice(s.name)).filter((p): p is number => p !== null)
    expect(Math.min(...prix)).toBe(FUEL_DEPOT_PRICE)
    expect(Math.max(...prix)).toBeGreaterThan(FUEL_DEPOT_PRICE * 3)
    expect(Math.max(...prix)).toBeLessThanOrEqual(FUEL_DEPOT_PRICE * 5)
  })

  it('fait payer l’isolement : plus loin d’un dépôt, plus cher à type égal', () => {
    const luxe = getStations().filter(s => s.type === 'luxury' && sellsFuel(s.name))
      .map(s => ({ n: s.name, iso: fuelToNearestRefuel(s.name, undefined, 0, FUEL_DEPOTS), p: getFuelPrice(s.name)! }))
      .sort((a, b) => a.iso - b.iso)
    for (let i = 1; i < luxe.length; i++) {
      if (luxe[i].iso > luxe[i - 1].iso) expect(luxe[i].p, luxe[i].n).toBeGreaterThan(luxe[i - 1].p)
    }
  })

  it('tient compte du surcoût par saut', () => {
    const mort = 'Station Quarantaine'
    expect(fuelToNearestRefuel(mort, undefined, 1)).toBeGreaterThan(fuelToNearestRefuel(mort))
  })

  // Depuis un lieu mort, il faut pouvoir rejoindre une pompe par des sauts qui
  // tiennent dans le plus petit réservoir (en fouillant en route au besoin).
  it('permet toujours de rejoindre une pompe par des sauts réalistes', () => {
    const exclues = new Set(["L'Arc Perdu"])
    const coinces: string[] = []
    for (const depart of getStations()) {
      if (exclues.has(depart.name)) continue
      const vus = new Set([depart.name])
      const file = [depart.name]
      let ok = false
      while (file.length && !ok) {
        const cur = file.shift()!
        if (sellsFuel(cur)) { ok = true; break }
        for (const s of getAccessibleStations(cur)) {
          if (vus.has(s.name) || exclues.has(s.name)) continue
          if (getFuelCost(cur, s.name) > PLUS_PETIT_RESERVOIR) continue
          vus.add(s.name)
          file.push(s.name)
        }
      }
      if (!ok) coinces.push(depart.name)
    }
    expect(coinces, 'stations dont on ne ressort jamais').toEqual([])
  })

  it('ne référence que des stations existantes', () => {
    const noms = new Set(getStations().map(s => s.name))
    for (const n of [...FUEL_DEPOTS, ...NO_FUEL_STATIONS]) expect(noms, n).toContain(n)
  })
})
