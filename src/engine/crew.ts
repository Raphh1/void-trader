// Équipage : jusqu'à trois membres recrutés dans les bars des stations.
//
// Chaque membre a un RÔLE à effet permanent (il agit à chaque voyage, chaque
// combat, chaque passage au marché) et un TRAIT qui module son efficacité, son
// salaire ou sa loyauté. En échange : un salaire quotidien, une loyauté à
// entretenir (un membre impayé finit par déserter, en se servant dans la
// caisse) et le risque de le perdre quand un combat tourne mal.
//
// Les effets passent par le même agrégateur que les reliques (cf.
// getPassiveMods dans data/relics.ts) : ils se cumulent avec elles.
import type { GameState, CrewMember, CrewRole, CrewTrait } from '../types'
import type { RelicMods } from '../data/relics'

export const MAX_CREW = 3
export const CREW_ROLES: CrewRole[] = ['mecano', 'pilote', 'tireur', 'medecin', 'negociateur', 'eclaireur']
const TRAITS: CrewTrait[] = ['veteran', 'novice', 'cupide', 'fidele']

const SALAIRE_BASE: Record<CrewRole, number> = {
  mecano: 45, pilote: 50, tireur: 55, medecin: 55, negociateur: 60, eclaireur: 45,
}

// Efficacité et salaire selon le trait.
const TRAIT_SKILL: Record<CrewTrait, number> = { veteran: 1.5, novice: 0.6, cupide: 1.5, fidele: 1 }
const TRAIT_SALARY: Record<CrewTrait, number> = { veteran: 1.5, novice: 0.6, cupide: 1.8, fidele: 1 }

const NOMS = [
  'Rook Delane', 'Maï Sorenth', 'Tobias Kern', 'Ysa Morrow', 'Brann Holt', 'Lune Ferro',
  'Dax Okoye', 'Pira Venn', 'Hollis Grue', 'Sabe Tarkin', 'Nils Ardent', 'Quill Masson',
  'Orla Hesk', 'Jem Castor', 'Veda Lorn', 'Kasimir Dent', 'Tess Ombrel', 'Arno Vasch',
]

/** Effet d'un membre, à pleine efficacité (multiplié par son trait). */
function effetDuRole(role: CrewRole, s: number): Partial<RelicMods> {
  switch (role) {
    case 'mecano':      return { shipRepairPerDay: Math.round(8 * s) }
    case 'pilote':      return { freeFuelChance: 0.2 * s }
    case 'tireur':      return { dmgMult: 0.12 * s }
    case 'medecin':     return { travelHp: Math.round(5 * s), killHeal: Math.round(8 * s) }
    case 'negociateur': return { buyMult: -0.07 * s, sellMult: 0.07 * s }
    case 'eclaireur':   return { exploreLootMult: 0.30 * s }
  }
}

/** Contributions de l'équipage, au format des reliques (écarts à cumuler). */
export function getCrewContributions(crew: CrewMember[] | undefined): Partial<RelicMods>[] {
  return (crew ?? []).map(m => effetDuRole(m.role, TRAIT_SKILL[m.trait]))
}

// ── Recrutement ───────────────────────────────────────────────────────────────

/** Générateur déterministe : les mêmes candidats pour une station un jour donné. */
function graine(station: string, day: number): () => number {
  let h = 2166136261
  for (const ch of `${station}#${day}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/** Candidats disponibles au bar de la station aujourd'hui (0 à 2). */
export function getRecruits(station: string, day: number, crew: CrewMember[] = []): CrewMember[] {
  const r = graine(station, day)
  // Pas de recrue partout : un bar sur trois est vide ce jour-là.
  if (r() < 0.33) return []
  const n = r() < 0.5 ? 1 : 2
  const pris = new Set(crew.map(m => m.name))
  const out: CrewMember[] = []
  for (let i = 0; i < n; i++) {
    const role = CREW_ROLES[Math.floor(r() * CREW_ROLES.length)]
    const trait = TRAITS[Math.floor(r() * TRAITS.length)]
    const name = NOMS[Math.floor(r() * NOMS.length)]
    if (pris.has(name) || out.some(m => m.name === name)) continue
    out.push({
      id: `${station}-${day}-${i}`,
      name, role, trait,
      salary: Math.round(SALAIRE_BASE[role] * TRAIT_SALARY[trait]),
      loyalty: trait === 'fidele' ? 80 : 60,
    })
  }
  return out
}

/** Prime d'embauche : cinq jours de salaire d'avance. */
export function hiringFee(m: CrewMember): number {
  return m.salary * 5
}

export function hireCrew(gs: GameState, m: CrewMember): Partial<GameState> | null {
  const crew = gs.crew ?? []
  if (crew.length >= MAX_CREW || gs.credits < hiringFee(m) || crew.some(c => c.id === m.id)) return null
  return { crew: [...crew, m], credits: gs.credits - hiringFee(m), crewHired: [...(gs.crewHired ?? []), m.id] }
}

export function fireCrew(gs: GameState, id: string): Partial<GameState> {
  return { crew: (gs.crew ?? []).filter(m => m.id !== id) }
}

// ── Vie quotidienne ───────────────────────────────────────────────────────────

export interface CrewLine { key: string; params: Record<string, string | number> }

/**
 * Un jour passe : salaires, loyauté, désertions. Les effets passifs (réparation,
 * soin…) sont appliqués par l'appelant via getPassiveMods.
 */
export function tickCrewDay(gs: GameState, rng: () => number = Math.random): { patch: Partial<GameState>; lines: CrewLine[] } {
  const crew = gs.crew ?? []
  if (crew.length === 0) return { patch: {}, lines: [] }
  const lines: CrewLine[] = []
  let credits = gs.credits
  const due = crew.reduce((n, m) => n + m.salary, 0)
  const paye = credits >= due
  if (paye) credits -= due
  else lines.push({ key: 'unpaid', params: { amount: due } })

  const restants: CrewMember[] = []
  for (const m of crew) {
    // Payé : la loyauté remonte doucement. Impayé : elle chute (moins vite chez les fidèles).
    const delta = paye ? 3 : (m.trait === 'fidele' ? -10 : -20)
    const loyalty = Math.max(0, Math.min(100, m.loyalty + delta))
    if (loyalty < 25 && rng() < 0.4) {
      // Désertion : il part avec ce qu'on lui doit, pris dans la caisse.
      const vol = Math.min(credits, m.salary * 3)
      credits -= vol
      lines.push({ key: 'deserted', params: { name: m.name, amount: vol } })
      continue
    }
    if (loyalty < 25 && m.loyalty >= 25) lines.push({ key: 'grumbling', params: { name: m.name } })
    restants.push({ ...m, loyalty })
  }
  return { patch: { crew: restants, credits }, lines }
}

/** Un combat perdu (assommé, capturé) peut coûter un membre d'équipage. */
export function crewCasualty(gs: GameState, rng: () => number = Math.random): { patch: Partial<GameState>; line: CrewLine | null } {
  const crew = gs.crew ?? []
  if (crew.length === 0 || rng() >= 0.3) return { patch: {}, line: null }
  const victime = crew[Math.floor(rng() * crew.length)]
  return {
    patch: { crew: crew.filter(m => m.id !== victime.id) },
    line: { key: 'killed', params: { name: victime.name } },
  }
}
