// Reliques : objets passifs qui changent les règles d'une run.
//
// Le jeu se rejouait à l'identique d'une run à l'autre. Les reliques donnent à
// chaque partie un « build » : on en choisit une parmi trois au départ, puis
// après chaque boss ou lieutenant, et rarement en exploration profonde. Elles
// ne touchent QUE ce que le joueur fait en boucle (voyager, combattre,
// commercer, explorer, se reposer) — une relique qui servirait une fois par run
// ne changerait rien au ressenti.
//
// Beaucoup ont un revers : le choix doit coûter quelque chose. Les effets se
// cumulent entre reliques (additions pour les bonus plats, produits pour les
// multiplicateurs), ce qui crée des combinaisons à chercher.
import type { GameState } from '../types'
import i18n from '../i18n/config'
import { getCrewContributions } from '../engine/crew'

export type RelicRarity = 'common' | 'rare' | 'cursed'

export interface RelicMods {
  dmgMult: number          // dégâts infligés
  critBonus: number        // chance de critique, en points
  dmgTakenMult: number     // dégâts reçus
  lifestealPct: number     // part des dégâts infligés rendue en PV
  enemyHpMult: number      // PV de départ des ennemis
  combatLootMult: number   // crédits gagnés en combat
  killHeal: number         // PV rendus après une victoire
  buyMult: number          // prix d'achat au marché
  sellMult: number         // prix de vente au marché
  exploreLootMult: number  // crédits trouvés en exploration
  travelCredits: number    // crédits gagnés (ou perdus) à chaque voyage
  travelHp: number         // PV gagnés (ou perdus) à chaque voyage
  travelRep: number        // réputation à chaque voyage
  freeFuelChance: number   // chance qu'un voyage ne consomme pas de carburant
  freeRest: number         // > 0 : se reposer ne coûte pas les frais du jour
  maxFuelBonus: number     // appliqué une fois, à l'obtention
  maxHpBonus: number       // appliqué une fois, à l'obtention
  shipRepairPerDay: number // points de coque réparés à chaque jour (équipage)
}

const NEUTRE: RelicMods = {
  dmgMult: 1, critBonus: 0, dmgTakenMult: 1, lifestealPct: 0, enemyHpMult: 1,
  combatLootMult: 1, killHeal: 0, buyMult: 1, sellMult: 1, exploreLootMult: 1,
  travelCredits: 0, travelHp: 0, travelRep: 0, freeFuelChance: 0, freeRest: 0,
  maxFuelBonus: 0, maxHpBonus: 0, shipRepairPerDay: 0,
}

interface RelicDef {
  id: string
  icon: string
  rarity: RelicRarity
  mods: Partial<RelicMods>
}

// Les multiplicateurs sont exprimés en écart (+0.15 = +15 %) et composés à l'agrégation.
const RELICS: RelicDef[] = [
  // ── Voyage ──
  { id: 'boussoleFelee',     icon: '🧭', rarity: 'common', mods: { freeFuelChance: 0.30 } },
  { id: 'tirelirePasseur',   icon: '🪙', rarity: 'common', mods: { travelCredits: 70 } },
  { id: 'medailleNotoriete', icon: '🎖', rarity: 'common', mods: { travelRep: 2 } },
  { id: 'reservoirAux',      icon: '⛽', rarity: 'common', mods: { maxFuelBonus: 2 } },
  { id: 'bourseTrouee',      icon: '💸', rarity: 'cursed', mods: { combatLootMult: 0.35, exploreLootMult: 0.35, travelCredits: -60 } },
  // ── Combat ──
  { id: 'sangFroid',         icon: '🎯', rarity: 'common', mods: { critBonus: 10 } },
  { id: 'plaqueBlindee',     icon: '🛡', rarity: 'common', mods: { dmgTakenMult: -0.15 } },
  { id: 'crocsCharognard',   icon: '🦴', rarity: 'common', mods: { killHeal: 14 } },
  { id: 'mauvaisOeil',       icon: '👁', rarity: 'rare',   mods: { enemyHpMult: -0.15 } },
  { id: 'pucePredatrice',    icon: '🩸', rarity: 'rare',   mods: { lifestealPct: 0.15 } },
  { id: 'coeurInstable',     icon: '☢', rarity: 'cursed', mods: { dmgMult: 0.30, travelHp: -4 } },
  { id: 'contratSang',       icon: '📜', rarity: 'cursed', mods: { combatLootMult: 0.50, dmgTakenMult: 0.15 } },
  { id: 'poingFerraille',    icon: '🥊', rarity: 'common', mods: { dmgMult: 0.15, critBonus: -4 } },
  { id: 'carcasseVivante',   icon: '🫀', rarity: 'rare',   mods: { maxHpBonus: 25, dmgMult: -0.08 } },
  // ── Commerce ──
  { id: 'carnetMarchand',    icon: '📒', rarity: 'common', mods: { buyMult: -0.10 } },
  { id: 'langueArgent',      icon: '👅', rarity: 'common', mods: { sellMult: 0.12 } },
  { id: 'pieceTruquee',      icon: '🎲', rarity: 'cursed', mods: { sellMult: 0.25, buyMult: 0.12 } },
  // ── Exploration / repos ──
  { id: 'detecteurEpaves',   icon: '📡', rarity: 'common', mods: { exploreLootMult: 0.50 } },
  { id: 'sablierBrise',      icon: '⏳', rarity: 'rare',   mods: { travelHp: 6, freeRest: 1 } },
]

const MULTIPLICATEURS: (keyof RelicMods)[] = ['dmgMult', 'dmgTakenMult', 'enemyHpMult', 'combatLootMult', 'buyMult', 'sellMult', 'exploreLootMult']

export const ALL_RELIC_IDS = RELICS.map(r => r.id)

export interface Relic { id: string; icon: string; rarity: RelicRarity; name: string; description: string }

export function getRelic(id: string): Relic | undefined {
  const def = RELICS.find(r => r.id === id)
  if (!def) return undefined
  return {
    id: def.id, icon: def.icon, rarity: def.rarity,
    name: i18n.t(`relics.${id}.name`, { ns: 'relics' }),
    description: i18n.t(`relics.${id}.description`, { ns: 'relics' }),
  }
}

/**
 * Effets passifs cumulés : reliques possédées ET équipage (cf. engine/crew.ts).
 * Tous les systèmes (voyage, combat, marché, exploration, repos) lisent ici.
 */
export function getPassiveMods(gs: Pick<GameState, 'relics' | 'crew'>): RelicMods {
  const out: RelicMods = { ...NEUTRE }
  const sources: Partial<RelicMods>[] = [
    ...(gs.relics ?? []).map(id => RELICS.find(r => r.id === id)?.mods).filter((m): m is Partial<RelicMods> => !!m),
    ...getCrewContributions(gs.crew),
  ]
  for (const mods of sources) {
    for (const [k, v] of Object.entries(mods) as [keyof RelicMods, number][]) {
      if (MULTIPLICATEURS.includes(k)) out[k] = out[k] * (1 + v)
      else out[k] = out[k] + v
    }
  }
  // Plancher : aucune combinaison ne doit annuler une mécanique.
  out.dmgTakenMult = Math.max(0.5, out.dmgTakenMult)
  out.buyMult = Math.max(0.6, out.buyMult)
  out.enemyHpMult = Math.max(0.6, out.enemyHpMult)
  out.freeFuelChance = Math.min(0.6, out.freeFuelChance)
  out.lifestealPct = Math.min(0.35, out.lifestealPct)
  return out
}

/** Tire `n` reliques différentes que le joueur ne possède pas encore. */
export function drawRelicChoices(gs: Pick<GameState, 'relics'>, n = 3, rng: () => number = Math.random): string[] {
  const owned = new Set(gs.relics ?? [])
  // Les reliques rares sortent moitié moins souvent que les communes.
  const pool = RELICS.filter(r => !owned.has(r.id)).flatMap(r => r.rarity === 'rare' ? [r.id] : [r.id, r.id])
  const out: string[] = []
  while (out.length < n && pool.length > 0) {
    const id = pool[Math.floor(rng() * pool.length)]
    out.push(id)
    for (let i = pool.length - 1; i >= 0; i--) if (pool[i] === id) pool.splice(i, 1)
  }
  return out
}

/** Ajoute une relique et applique ses bonus permanents. */
export function grantRelic(gs: GameState, id: string): Partial<GameState> {
  if ((gs.relics ?? []).includes(id)) return {}
  const def = RELICS.find(r => r.id === id)
  if (!def) return {}
  const patch: Partial<GameState> = { relics: [...(gs.relics ?? []), id], pendingRelicChoice: null }
  if (def.mods.maxFuelBonus) patch.maxFuel = gs.maxFuel + def.mods.maxFuelBonus
  if (def.mods.maxHpBonus) {
    patch.playerMaxHp = gs.playerMaxHp + def.mods.maxHpBonus
    patch.playerHp = gs.playerHp + def.mods.maxHpBonus
  }
  return patch
}
