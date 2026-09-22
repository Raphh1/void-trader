import type { GameState } from '../types'
import i18n from '../i18n/config'
import { getFuelPrice } from '../data/stations'
import { getBuyDiscount } from './factions'

const mt = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'marketScreen', ...params })

// ── PROFILS DE PRIX PAR TYPE DE STATION ──────────────────────────────────────
// Multiplicateur > 1 = item plus cher ici (offre basse ou demande haute)
// Multiplicateur < 1 = item moins cher ici (offre abondante)

type StationType = 'dangerous' | 'peaceful' | 'industrial' | 'scientific' | 'ruins' | 'luxury' | 'military'

const STATION_TYPE_PROFILES: Record<StationType, Record<string, number>> = {
  dangerous: {
    'Armes illégales': 0.70,    // marché noir abondant
    'Drogues de synthèse': 0.65,
    'Pièces de contrebande': 0.75,
    'Marchandises volées': 0.70,
    'Médicaments': 1.40,         // rares et demandés
    'Médicaments premium': 1.50,
    'Nourriture fraîche': 1.30,
    'Eau purifiée': 1.35,
  },
  peaceful: {
    'Médicaments': 0.80,
    'Nourriture fraîche': 0.75,
    'Nourriture synthétique': 0.80,
    'Équipement agricole': 0.85,
    'Vivres': 0.80,
    'Armes illégales': 1.80,     // interdites ici, très chères
    'Armes lourdes': 1.60,
    'Munitions': 1.40,
  },
  industrial: {
    'Métaux bruts': 0.70,
    'Métaux rares': 0.80,
    'Composants électroniques': 0.75,
    'Pièces techniques': 0.75,
    "Composants d'armure": 0.80,
    'Outils lourds': 0.80,
    'Carburant de récup': 0.85,
    'Implants': 1.30,
    'Médicaments': 1.20,
    'Luxe': 1.50,
  },
  scientific: {
    'Implants': 0.75,
    'Logiciels': 0.70,
    'Données classifiées': 0.80,
    'Composants expérimentaux': 0.75,
    'Technologies avancées': 0.80,
    'Médicaments premium': 0.85,
    'Armes illégales': 1.60,
    'Drogues de synthèse': 1.50,
  },
  ruins: {
    'Artefacts': 0.65,           // partout dans les ruines
    'Données pré-Fracture': 0.70,
    'Reliques': 0.70,
    'Matériel de pillage': 0.75,
    'Butin de guerre': 0.70,
    'Médicaments': 1.60,         // très difficiles à trouver
    'Nourriture fraîche': 1.50,
    'Carburant premium': 1.40,
    'Eau purifiée': 1.55,
  },
  luxury: {
    'Luxe': 0.80,
    'Médicaments premium': 0.80,
    'Armures premium': 0.85,
    "Armures d'élite": 0.80,
    'Or': 0.85,
    'Médicaments': 1.20,
    'Métaux bruts': 1.40,
    'Ferraille': 1.60,
  },
  military: {
    'Munitions': 0.70,
    'Munitions spéciales': 0.75,
    'Rations militaires': 0.70,
    'Rations': 0.75,
    'Équipements blindés': 0.80,
    'Composants tactiques': 0.75,
    'Équipement tactique': 0.80,
    'Armes Tier 3': 0.85,
    'Armes lourdes': 0.85,
    'Drogues de synthèse': 1.70,
    'Luxe': 1.60,
  },
}

// ── RABAIS PAR PILIER ─────────────────────────────────────────────────────────
// Si tu as un bon standing avec le pilier de la station, tu obtiens un rabais

const PILLAR_STATIONS: Record<string, keyof GameState['pillarStanding']> = {
  'Emporium Requiem': 'cesarion',
  "L'Arc Perdu": 'raphazarus',
  'Arc Ouest Apocalypse': 'alanossa',
  'Scotty Golden North': 'scotty',
  'La Tribosphère': 'eliotis',
  'Paradoxa Eterna': 'maxance',
}

export function getPillarDiscount(gs: GameState): number {
  const pillarKey = PILLAR_STATIONS[gs.currentStation]
  if (!pillarKey) return 0
  const standing = (gs.pillarStanding ?? {})[pillarKey] ?? 0
  if (standing >= 60) return 0.20   // allié : -20%
  if (standing >= 40) return 0.15   // respecté : -15%
  if (standing >= 20) return 0.08   // connu : -8%
  if (standing <= -20) return -0.15 // méfiant : +15% (surcharge hostile)
  if (standing <= -40) return -0.30 // ennemi : +30%
  return 0
}

// ── MULTIPLICATEUR FINAL ─────────────────────────────────────────────────────

export function getStationItemMult(stationType: string, item: string): number {
  const profile = STATION_TYPE_PROFILES[stationType as StationType] ?? {}
  return profile[item] ?? 1.0
}

export function getFullBuyMult(gs: GameState, stationType: string, item: string): number {
  const typeMult  = getStationItemMult(stationType, item)
  const pillarDisc = getPillarDiscount(gs)
  const sellMult = getFullSellMult(gs, stationType, item)
  return Math.max(sellMult + 0.10, typeMult * (1 - pillarDisc))
}

export function getFullSellMult(_gs: GameState, stationType: string, item: string): number {
  const typeMult = getStationItemMult(stationType, item)
  return Math.max(0.40, typeMult * 0.75)
}

// ── AFFICHAGE CONTEXTE MARCHÉ ─────────────────────────────────────────────────

export function getMarketContext(gs: GameState, stationType: string): string[] {
  const lines: string[] = []
  const pillarKey = PILLAR_STATIONS[gs.currentStation]
  const standing  = pillarKey ? (gs.pillarStanding ?? {})[pillarKey] ?? 0 : 0
  const disc      = getPillarDiscount(gs)

  if (pillarKey && disc > 0) lines.push(mt('allianceDiscount', { pillar: pillarKey, pct: Math.round(disc * 100) }))
  if (pillarKey && disc < 0) lines.push(mt('hostileSurcharge', { pillar: pillarKey, pct: Math.round(Math.abs(disc) * 100) }))

  const profile = STATION_TYPE_PROFILES[stationType as StationType]
  if (profile) {
    const cheap  = Object.entries(profile).filter(([, m]) => m < 0.80).map(([k]) => k).slice(0, 3)
    const pricey = Object.entries(profile).filter(([, m]) => m > 1.30).map(([k]) => k).slice(0, 2)
    if (cheap.length)  lines.push(mt('abundantHere', { list: cheap.join(', ') }))
    if (pricey.length) lines.push(mt('rareHere', { list: pricey.join(', ') }))
  }

  return lines
}

// ── CARBURANT ────────────────────────────────────────────────────────────────
// Un seul prix pour le marché et l'atelier : celui de la station (type +
// isolement, voir getFuelPrice), moins la remise de faction. Pas de
// multiplicateur d'arbitrage : le carburant va dans le réservoir, il ne se
// revend pas. null = la station n'en vend pas.
export function getFuelUnitPrice(gs: GameState): number | null {
  const base = getFuelPrice(gs.currentStation)
  if (base === null) return null
  return Math.max(1, Math.floor(base * (1 - getBuyDiscount(gs) / 100)))
}
