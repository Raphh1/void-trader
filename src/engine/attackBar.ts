// Barre d'attaque façon Undertale : un curseur traverse la barre, on frappe
// en l'arrêtant au plus près de la cible. La précision devient le
// `precisionMult` de l'action (engine/combat.ts), qui multiplie les dégâts.
// Chaque famille d'arme a sa propre barre.
import type { WeaponData } from '../types'

export type WeaponFamily = 'mains' | 'lame' | 'tir' | 'precision' | 'lourd' | 'explosif'

export interface BarConfig {
  /** Curseurs successifs : un par balle pour les armes de tir. */
  shots: number
  /** Durée d'une traversée (ms). */
  durationMs: number
  /** Multiplicateur au bord de la barre et au centre parfait. */
  min: number
  max: number
  /** Plus il est grand, plus il faut être près du centre pour dépasser ×1. */
  curve: number
  /** Le curseur accélère au lieu d'avancer à vitesse constante. */
  accelerate?: boolean
  /** Allers-retours avant que la mèche ne brûle (explosifs), cible décentrée. */
  bounces?: number
}

export const BAR_CONFIGS: Record<WeaponFamily, BarConfig> = {
  mains:     { shots: 1, durationMs: 1100, min: 0.4,  max: 1.3,  curve: 2.5 },
  lame:      { shots: 1, durationMs: 900,  min: 0.35, max: 1.6,  curve: 3 },
  tir:       { shots: 3, durationMs: 620,  min: 0.3,  max: 1.45, curve: 3 },
  precision: { shots: 1, durationMs: 1300, min: 0.2,  max: 2.3,  curve: 6 },
  lourd:     { shots: 1, durationMs: 1300, min: 0.7,  max: 1.3,  curve: 1.5, accelerate: true },
  explosif:  { shots: 1, durationMs: 800,  min: 0.5,  max: 1.6,  curve: 2.5, bounces: 3 },
}

// L'ordre compte : « Fusil de précision » est une arme de précision, « Fusil à pompe » une arme lourde.
const RULES: [RegExp, WeaponFamily][] = [
  [/sniper|précision|arbalète/i, 'precision'],
  [/grenade|bombe/i, 'explosif'],
  [/pompe|gatling|canon|lance-flammes|réacteur/i, 'lourd'],
  [/pistolet|revolver|fusil|taser|foudroyeur|désintégrateur|archon|dernière parole/i, 'tir'],
  [/couteau|lame|épée|shiv|pique|poing|matraque|bâton|fouet|gantelet|sceptre|vampirelle|injecto|insistance|éveilleur/i, 'lame'],
]

/** Famille reconnue par son nom, ou null si aucune règle ne s'applique. */
export function matchWeaponFamily(name: string): WeaponFamily | null {
  return RULES.find(([re]) => re.test(name))?.[1] ?? null
}

export function weaponFamily(weapon: Pick<WeaponData, 'name'> | null): WeaponFamily {
  return weapon ? matchWeaponFamily(weapon.name) ?? 'lame' : 'mains'
}

/** Position du curseur (0 = gauche, 1 = droite) à l'instant t d'un tir, ou null si le tir est passé. */
export function cursorPosition(cfg: BarConfig, elapsedMs: number): number | null {
  const u = elapsedMs / cfg.durationMs
  if (cfg.bounces) {
    if (u >= cfg.bounces * 2) return null
    const phase = u % 2
    return phase < 1 ? phase : 2 - phase
  }
  if (u >= 1) return null
  return cfg.accelerate ? Math.pow(u, 1.7) : u
}

/** 1 sur la cible, 0 au plus loin (bord de la barre côté opposé, ou demi-barre de distance). */
export function accuracyAt(position: number, target = 0.5): number {
  return Math.max(0, 1 - Math.abs(position - target) / 0.5)
}

export function shotMultiplier(cfg: BarConfig, accuracy: number | null): number {
  if (accuracy === null) return cfg.min / 2
  return cfg.min + (cfg.max - cfg.min) * Math.pow(accuracy, cfg.curve)
}

export type HitGrade = 'parfait' | 'bien' | 'bof' | 'rate'

export function gradeOf(accuracy: number | null): HitGrade {
  if (accuracy === null) return 'rate'
  if (accuracy >= 0.95) return 'parfait'
  if (accuracy >= 0.8) return 'bien'
  return 'bof'
}

/** Multiplicateur final : moyenne des tirs, avec un bonus quand toute la rafale est parfaite. */
export function finalMultiplier(cfg: BarConfig, accuracies: (number | null)[]): number {
  const mults = accuracies.map(a => shotMultiplier(cfg, a))
  const moyenne = mults.reduce((s, m) => s + m, 0) / Math.max(1, mults.length)
  const rafale = cfg.shots > 1 && accuracies.every(a => gradeOf(a) === 'parfait') ? 1.15 : 1
  return Math.round(moyenne * rafale * 100) / 100
}
