import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { getWeapons } from '../data/weapons'
import {
  BAR_CONFIGS, matchWeaponFamily, weaponFamily, cursorPosition, accuracyAt, shotMultiplier, finalMultiplier,
  type WeaponFamily,
} from '../engine/attackBar'

beforeAll(async () => { await initI18n() })

describe("famille de chaque arme", () => {
  it('toutes les armes du jeu ont une barre choisie exprès (aucune ne tombe par défaut)', () => {
    const orphelines = getWeapons().map(w => w.name).filter(n => matchWeaponFamily(n) === null)
    expect(orphelines).toEqual([])
  })

  it('les cas piégeux tombent dans la bonne famille', () => {
    const attendu: Record<string, WeaponFamily> = {
      'Fusil de précision Céleste': 'precision',
      'Fusil à pompe galactique': 'lourd',
      'Fusil Berserk': 'tir',
      'Électrogrenade (une)': 'explosif',
      'Double-lame des bas-fonds': 'lame',
      'Arbalète de fortune': 'precision',
    }
    for (const [nom, famille] of Object.entries(attendu)) expect(matchWeaponFamily(nom), nom).toBe(famille)
    expect(weaponFamily(null)).toBe('mains')
  })

  it('chaque famille est représentée parmi les armes', () => {
    const familles = new Set(getWeapons().map(w => weaponFamily(w)))
    for (const f of ['lame', 'tir', 'precision', 'lourd', 'explosif'] as const) expect(familles.has(f), f).toBe(true)
  })
})

describe('multiplicateurs', () => {
  it('centre parfait = maximum, bord = minimum, raté = moitié du minimum', () => {
    for (const cfg of Object.values(BAR_CONFIGS)) {
      expect(shotMultiplier(cfg, 1)).toBeCloseTo(cfg.max)
      expect(shotMultiplier(cfg, 0)).toBeCloseTo(cfg.min)
      expect(shotMultiplier(cfg, null)).toBeCloseTo(cfg.min / 2)
    }
  })

  it("un joueur correct (précision 0,9) frappe autour d'un coup normal, sans exploser l'équilibrage", () => {
    for (const [famille, cfg] of Object.entries(BAR_CONFIGS)) {
      const m = shotMultiplier(cfg, 0.9)
      expect(m, famille).toBeGreaterThan(0.9)
      expect(m, famille).toBeLessThan(1.4)
    }
  })

  it('la précision paie plus gros mais punit davantage que les armes lourdes', () => {
    const p = BAR_CONFIGS.precision, l = BAR_CONFIGS.lourd
    expect(shotMultiplier(p, 1)).toBeGreaterThan(shotMultiplier(l, 1))
    expect(shotMultiplier(p, 0.7)).toBeLessThan(shotMultiplier(l, 0.7))
  })

  it('une rafale entièrement parfaite vaut un bonus, une balle ratée fait baisser la moyenne', () => {
    const tir = BAR_CONFIGS.tir
    expect(finalMultiplier(tir, [1, 1, 1])).toBeCloseTo(tir.max * 1.15, 1)
    expect(finalMultiplier(tir, [1, 1, null])).toBeLessThan(finalMultiplier(tir, [1, 1, 1]) / 1.15)
  })

  it('la précision se mesure par rapport à la cible, même décentrée', () => {
    expect(accuracyAt(0.3, 0.3)).toBe(1)
    expect(accuracyAt(0.5, 0.3)).toBeCloseTo(0.6)
    expect(accuracyAt(1, 0.2)).toBe(0)
  })
})

describe('curseur', () => {
  it('traverse une fois de gauche à droite, puis le tir est perdu', () => {
    const cfg = BAR_CONFIGS.lame
    expect(cursorPosition(cfg, 0)).toBe(0)
    expect(cursorPosition(cfg, cfg.durationMs / 2)).toBeCloseTo(0.5)
    expect(cursorPosition(cfg, cfg.durationMs)).toBeNull()
  })

  it("accélère pour les armes lourdes : il est encore loin du centre à mi-temps", () => {
    const cfg = BAR_CONFIGS.lourd
    expect(cursorPosition(cfg, cfg.durationMs / 2)!).toBeLessThan(0.4)
  })

  it('fait des allers-retours pour les explosifs, jusqu’à ce que la mèche brûle', () => {
    const cfg = BAR_CONFIGS.explosif
    expect(cursorPosition(cfg, cfg.durationMs)).toBeCloseTo(1)
    expect(cursorPosition(cfg, cfg.durationMs * 1.5)).toBeCloseTo(0.5)
    expect(cursorPosition(cfg, cfg.durationMs * 2 * cfg.bounces!)).toBeNull()
  })
})
