// Défi du jour : une run aux tirages de départ identiques pour tout le monde
// ce jour-là (classe, modificateurs, objectif, reliques proposées,
// concurrents), sans bonus d'héritage. Le meilleur score du jour est gardé
// dans le navigateur.
//
// Le reste de la partie (combats, événements) reste aléatoire : le défi fixe
// le point de départ, pas le chemin.
import type { GameState } from '../types'
import { getClasses } from '../data/classes'
import { getRunModifiers } from '../data/runModifiers'
import { seededRng, todayKey } from './seed'

const STORAGE_KEY = 'vt_daily_best'

// Même pondération que le tirage normal : le Seigneur de guerre reste rare.
const CLASS_WEIGHTS: Record<string, number> = { 'Seigneur de guerre': 0.18 }

export interface DailySetup { date: string; className: string; modIds: string[] }

export function getDailySetup(date = todayKey()): DailySetup {
  const rand = seededRng(`daily:${date}:setup`)
  const classes = getClasses().map(c => ({ name: c.name, w: CLASS_WEIGHTS[c.name] ?? 1 }))
  let r = rand() * classes.reduce((s, c) => s + c.w, 0)
  let className = classes[classes.length - 1].name
  for (const c of classes) { r -= c.w; if (r <= 0) { className = c.name; break } }
  // Mélange déterministe des modificateurs (triés par id pour ne pas dépendre de l'ordre de déclaration).
  const mods = [...getRunModifiers()].sort((a, b) => a.id.localeCompare(b.id))
  for (let i = mods.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [mods[i], mods[j]] = [mods[j], mods[i]] }
  return { date, className, modIds: mods.slice(0, 2).map(m => m.id) }
}

/** Score du défi : les crédits gagnés sur toute la run, hors crédits de départ. */
export function dailyScore(gs: Pick<GameState, 'totalCreditsEarned' | 'class'>): number {
  return Math.max(0, (gs.totalCreditsEarned ?? 0) - (gs.class?.startCredits ?? 0))
}

function lire(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number> } catch { return {} }
}

export function getDailyBest(date = todayKey()): number | null {
  return lire()[date] ?? null
}

export function recordDailyScore(date: string, score: number): void {
  try {
    const all = lire()
    if ((all[date] ?? -1) >= score) return
    all[date] = score
    // On ne garde que les 30 derniers jours.
    const garde = Object.keys(all).sort().slice(-30)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(garde.map(k => [k, all[k]]))))
  } catch { /* stockage indisponible : le défi reste jouable, sans record */ }
}
