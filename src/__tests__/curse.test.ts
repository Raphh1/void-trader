import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { applyCurse, isPurelyPositive } from '../engine/curse'
import { rollTravelEvent } from '../engine/travelEvents'
import type { GameState } from '../types'

// Le Maudit promet qu'une bonne fortune sur deux se retourne contre lui.
// Avant, seuls les événements de voyage « fizzaient » (aucun effet, aucun coût).

beforeAll(async () => { await initI18n() })

function gs(cursed = true): GameState {
  return {
    class: { name: cursed ? 'Maudit' : 'Marchand', cursedEvents: cursed },
    credits: 1000, reputation: 20, playerHp: 50, playerMaxHp: 90, fuel: 3, maxFuel: 8, shipHp: 100,
    day: 4, cargo: { Ferraille: 1 }, isImprisoned: false,
  } as unknown as GameState
}

describe('malédiction du Maudit', () => {

  it('transforme un gain en perte quand elle frappe', () => {
    const base = gs()
    const r = applyCurse(base, { credits: 1400, reputation: 30, fuel: 5 }, 0)
    expect(r.cursed).toBe(true)
    expect(r.patch.credits).toBe(800)     // +400 → -200
    expect(r.patch.reputation).toBe(15)   // +10 → -5
    expect(r.patch.fuel).toBe(1)          // +2 → -2
  })

  it('annule les marchandises et les fait payer', () => {
    const base = gs()
    const r = applyCurse(base, { cargo: { Ferraille: 1, Artefacts: 2 } }, 0)
    expect(r.patch.cargo).toEqual({ Ferraille: 1 })
    expect(r.patch.credits).toBeLessThan(base.credits)
  })

  it('épargne la chance, les autres classes et les échanges', () => {
    const base = gs()
    expect(applyCurse(base, { credits: 1400 }, 0.9).cursed, 'tirage raté').toBe(false)
    expect(applyCurse(gs(false), { credits: 1400 }, 0).cursed, 'autre classe').toBe(false)
    // Payer pour gagner de la réputation n'est pas une bonne fortune pure.
    expect(isPurelyPositive(base, { credits: 900, reputation: 40 })).toBe(false)
    expect(applyCurse(base, { credits: 900, reputation: 40 }, 0).cursed).toBe(false)
  })

  it('frappe environ une fois sur deux', () => {
    const base = gs()
    let n = 0
    for (let i = 0; i < 4000; i++) if (applyCurse(base, { credits: 1200 }).cursed) n++
    expect(n / 4000).toBeGreaterThan(0.45)
    expect(n / 4000).toBeLessThan(0.55)
  })

  it('fait perdre sur les événements de voyage positifs maudits', () => {
    const base = gs()
    let pertes = 0, gains = 0
    for (let i = 0; i < 3000; i++) {
      const ev = rollTravelEvent(base)
      if (!ev) continue
      const res = ev.effect(base)
      if (res.message === 'COMBAT_TRIGGER' || res.message === 'BOUNTY_TRIGGER') continue
      if ((res.credits ?? base.credits) < base.credits && !res.shipHp) pertes++
      if ((res.credits ?? base.credits) > base.credits) gains++
    }
    expect(pertes, 'aucun gain de voyage retourné en perte').toBeGreaterThan(0)
    expect(gains, 'plus aucun gain de voyage').toBeGreaterThan(0)
  })
})
