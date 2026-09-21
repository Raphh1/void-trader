// Malédiction du Maudit : une bonne fortune sur deux se retourne contre lui.
//
// Avant, l'effet se limitait aux événements de VOYAGE positifs, qui « fizzaient »
// (aucun effet) une fois sur deux — environ un trajet sur dix, sans rien coûter.
// La classe promettait pourtant que les bonnes choses se retournent contre toi.
//
// Règle : un résultat purement favorable (au moins un gain parmi crédits,
// réputation, PV, carburant, cargo — et aucune perte) est, une fois sur deux,
// inversé. Chaque gain devient une perte du même ordre ; le reste du résultat
// (décisions, journal, quête proposée…) est conservé. Les échanges (payer pour
// gagner) et les paris ne sont pas touchés : ils comportent déjà un coût.
import type { GameState } from '../types'
import i18n from '../i18n/config'

export const CURSE_CHANCE = 0.5

const RESSOURCES = ['credits', 'reputation', 'playerHp', 'fuel'] as const

export function isCursed(gs: GameState): boolean {
  return !!gs.class?.cursedEvents
}

/** Le résultat n'apporte que des gains (aucune perte, aucune sanction). */
export function isPurelyPositive(gs: GameState, patch: Partial<GameState>): boolean {
  let gain = false
  for (const k of RESSOURCES) {
    if (patch[k] === undefined) continue
    const d = (patch[k] as number) - (gs[k] as number)
    if (d < 0) return false
    if (d > 0) gain = true
  }
  if (patch.shipHp !== undefined && patch.shipHp < gs.shipHp) return false
  if (patch.day !== undefined && patch.day > gs.day) return false
  if (patch.isImprisoned || patch.screen) return false
  if (patch.cargo) {
    const cles = new Set([...Object.keys(gs.cargo), ...Object.keys(patch.cargo)])
    for (const c of cles) {
      const d = (patch.cargo[c] ?? 0) - (gs.cargo[c] ?? 0)
      if (d < 0) return false
      if (d > 0) gain = true
    }
  }
  return gain
}

/** Inverse les gains d'un résultat favorable. */
export function cursePatch(gs: GameState, patch: Partial<GameState>): Partial<GameState> {
  const out: Partial<GameState> = { ...patch }
  const dCredits = (patch.credits ?? gs.credits) - gs.credits
  const dRep = (patch.reputation ?? gs.reputation) - gs.reputation
  const dHp = (patch.playerHp ?? gs.playerHp) - gs.playerHp
  const dFuel = (patch.fuel ?? gs.fuel) - gs.fuel

  // Moitié du gain en perte : la malchance fait mal sans ruiner la run d'un coup.
  if (dCredits > 0) out.credits = Math.max(0, gs.credits - Math.ceil(dCredits / 2))
  if (dRep > 0) out.reputation = gs.reputation - Math.ceil(dRep / 2)
  if (dHp > 0) out.playerHp = Math.max(1, gs.playerHp - Math.ceil(dHp / 2))
  if (dFuel > 0) out.fuel = Math.max(0, gs.fuel - dFuel)

  // Marchandises : elles n'arrivent pas, et la manœuvre coûte des crédits.
  if (patch.cargo) {
    const unites = Object.keys(patch.cargo).reduce((n, c) => n + Math.max(0, (patch.cargo![c] ?? 0) - (gs.cargo[c] ?? 0)), 0)
    if (unites > 0) {
      out.cargo = gs.cargo
      out.credits = Math.max(0, (out.credits ?? gs.credits) - unites * 60)
    }
  }
  return out
}

export const curseMessage = () => i18n.t('curse.message', { ns: 'common' })
export const curseHint = () => i18n.t('curse.hint', { ns: 'common' })

/**
 * Applique la malédiction si elle frappe. `cursed` indique au panneau d'afficher
 * le message de malédiction au lieu du texte de réussite.
 */
export function applyCurse(gs: GameState, patch: Partial<GameState>, roll: number = Math.random()): { patch: Partial<GameState>; cursed: boolean } {
  if (!isCursed(gs) || roll >= CURSE_CHANCE || !isPurelyPositive(gs, patch)) return { patch, cursed: false }
  return { patch: cursePatch(gs, patch), cursed: true }
}
