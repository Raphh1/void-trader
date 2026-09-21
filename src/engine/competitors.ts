// Concurrents : trois pilotes qui jouent la même partie que toi, en même temps.
//
// Sans eux, le secteur est immobile : les prix ne bougent que par les
// événements mondiaux et personne d'autre ne gagne ni ne perd. Les concurrents
// se déplacent et agissent chaque jour, et le joueur le sent en continu :
//  - une ou deux nouvelles dans le briefing à chaque arrivée ;
//  - des prix qui bougent là où ils sont passés (stock vidé, marché inondé,
//    station pillée) ;
//  - des rencontres quand on atterrit au même endroit (tuyau, défi, ignorer),
//    et une embuscade si on s'en est fait un ennemi ;
//  - un classement par fortune, qui donne un rang à la fin de la run.
//
// Chaque concurrent a un style qui détermine ce qu'il fait : le marchand fait
// bouger les prix, le pillard rend les stations plus chères et chasse ceux qu'il
// déteste, le chasseur de primes s'enrichit vite et répond aux défis.
import type { GameState, Competitor, CompetitorStyle, MarketPressure, CompetitorNews, Enemy } from '../types'
import { getAccessibleStations, getStation, getStations, LOOT_ONLY_ITEMS } from '../data/stations'

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const NOMS: Record<CompetitorStyle, string[]> = {
  marchand: ['Vex Morrane', 'Idra Kell', 'Sol Petrov'],
  pillard:  ['Kira Sulfate', 'Grax Dent-Noire', 'Nhoa la Rouge'],
  chasseur: ['Oddo Brask', 'Tamsin Vey', 'Le Borgne'],
}
const HUMEUR_INITIALE: Record<CompetitorStyle, number> = { marchand: 10, pillard: -15, chasseur: 0 }

/** Les trois concurrents d'une nouvelle run, dispersés loin du joueur. */
export function createCompetitors(startStation: string): Competitor[] {
  const loin = getStations().filter(s => s.name !== startStation && !getAccessibleStations(startStation).some(a => a.name === s.name))
  const styles: CompetitorStyle[] = ['marchand', 'pillard', 'chasseur']
  return styles.map((style, i) => ({
    id: `${style}-${i}`,
    name: pick(NOMS[style]),
    style,
    station: pick(loin).name,
    credits: rng(700, 1300),
    mood: HUMEUR_INITIALE[style],
    outUntilDay: 0,
  }))
}

function achetable(station: string): string[] {
  return getStation(station).goods.filter(g => !LOOT_ONLY_ITEMS.has(g))
}

const JOURS_PRESSION = 3

// Probabilité qu'un concurrent se rapproche du joueur plutôt que d'errer.
// Laissés au hasard sur 60 stations, on ne les croisait qu'1,6 fois par mois et
// 7 % des arrivées seulement avaient des prix touchés : ils n'existaient pas.
// Ils visent les mêmes marchés que toi, donc ils convergent vers ta zone.
// Mesuré sur 300 runs simulées de 30 jours : à 0,25 → ~5 rencontres par mois
// (environ une par semaine), 1,7 nouvelle par jour, prix touchés à 17 % des
// arrivées. À 0,45 on tombait à une rencontre tous les trois jours, lassant.
const ATTRACTION = 0.25

/** Distance (en sauts) de chaque station à celle du joueur. */
function distancesDepuis(origine: string): Map<string, number> {
  const dist = new Map<string, number>([[origine, 0]])
  const file = [origine]
  while (file.length > 0) {
    const cur = file.shift()!
    for (const v of getAccessibleStations(cur)) {
      if (dist.has(v.name)) continue
      dist.set(v.name, dist.get(cur)! + 1)
      file.push(v.name)
    }
  }
  return dist
}

/** Un jour passe pour les concurrents : déplacement, action, nouvelles. */
export function tickCompetitors(gs: GameState): Pick<GameState, 'competitors' | 'marketPressure' | 'competitorNews'> {
  const day = gs.day
  const dist = distancesDepuis(gs.currentStation)
  let pressure = (gs.marketPressure ?? []).filter(p => p.untilDay >= day)
  const news: CompetitorNews[] = []
  const competitors = (gs.competitors ?? []).map(c0 => {
    const c = { ...c0 }
    if ((c.outUntilDay ?? 0) > day) return c

    // Déplacement : ils bougent la plupart du temps, comme le joueur.
    if (Math.random() < 0.7) {
      const voisins = getAccessibleStations(c.station)
      if (voisins.length > 0) {
        if (Math.random() < ATTRACTION) {
          const d = (n: string) => dist.get(n) ?? 99
          const best = Math.min(...voisins.map(v => d(v.name)))
          c.station = pick(voisins.filter(v => d(v.name) === best)).name
        } else {
          c.station = pick(voisins).name
        }
      }
    }

    switch (c.style) {
      case 'marchand': {
        const biens = achetable(c.station)
        if (biens.length === 0) break
        const item = pick(biens)
        if (Math.random() < 0.6) {
          // Il rafle le stock : plus cher à l'achat comme à la vente.
          pressure.push({ station: c.station, item, mult: 1.25, untilDay: day + JOURS_PRESSION, by: c.name })
          news.push({ key: 'news.bought', params: { name: c.name, item, station: c.station } })
        } else {
          // Il écoule sa cargaison : le marché est inondé, les prix chutent.
          pressure.push({ station: c.station, item, mult: 0.8, untilDay: day + JOURS_PRESSION, by: c.name })
          news.push({ key: 'news.dumped', params: { name: c.name, item, station: c.station } })
        }
        c.credits += rng(150, 420)
        break
      }
      case 'pillard': {
        c.credits += rng(80, 520)
        if (Math.random() < 0.45) {
          // Station rançonnée : tout y est plus cher pendant quelques jours.
          pressure.push({ station: c.station, item: '*', mult: 1.15, untilDay: day + JOURS_PRESSION - 1, by: c.name })
          news.push({ key: 'news.raided', params: { name: c.name, station: c.station } })
        }
        break
      }
      case 'chasseur': {
        const prime = rng(200, 650)
        c.credits += prime
        if (Math.random() < 0.5) news.push({ key: 'news.bounty', params: { name: c.name, station: c.station, amount: prime } })
        break
      }
    }
    return c
  })

  // Pas plus de deux lignes par jour : au-delà, le briefing devient du bruit.
  // On garde en priorité ce qui se passe près du joueur.
  const proches = new Set([gs.currentStation, ...getAccessibleStations(gs.currentStation).map(s => s.name)])
  news.sort((a, b) => Number(proches.has(String(b.params.station))) - Number(proches.has(String(a.params.station))))
  // Une seule pression par station et par bien : la plus récente l'emporte.
  const vues = new Set<string>()
  pressure = pressure.reverse().filter(p => { const k = `${p.station}|${p.item}`; if (vues.has(k)) return false; vues.add(k); return true }).reverse()

  return { competitors, marketPressure: pressure, competitorNews: news.slice(0, 2) }
}

/** Multiplicateur de prix dû aux concurrents, pour un bien dans une station. */
export function getCompetitorPriceMult(gs: Pick<GameState, 'marketPressure' | 'day'>, station: string, item: string): number {
  let mult = 1
  for (const p of gs.marketPressure ?? []) {
    if (p.untilDay < gs.day || p.station !== station) continue
    if (p.item === item || p.item === '*') mult *= p.mult
  }
  return mult
}

export function getPressuresAt(gs: Pick<GameState, 'marketPressure' | 'day'>, station: string): MarketPressure[] {
  return (gs.marketPressure ?? []).filter(p => p.station === station && p.untilDay >= gs.day)
}

/** Concurrent présent (et disponible) à la station du joueur. */
export function competitorHere(gs: GameState): Competitor | undefined {
  return (gs.competitors ?? []).find(c => c.station === gs.currentStation && (c.outUntilDay ?? 0) <= gs.day)
}

/** Un concurrent devenu ennemi tend une embuscade à l'arrivée. */
export function shouldCompetitorAmbush(c: Competitor): boolean {
  return c.mood <= -50 && Math.random() < 0.4
}

export function competitorToEnemy(c: Competitor, day: number): Enemy {
  const base = c.style === 'chasseur' ? 70 : c.style === 'pillard' ? 60 : 45
  return {
    name: c.name,
    maxHp: base + day * 3,
    damageMin: c.style === 'marchand' ? 8 : 12,
    damageMax: c.style === 'marchand' ? 18 : 26,
    lootMin: 0, lootMax: 0, // le vrai butin : une part de sa fortune (cf. settleCompetitorDuel)
    description: '',
    captureChance: 0, killChance: 0, isBoss: false,
    role: c.style === 'chasseur' ? 'ranged' : c.style === 'pillard' ? 'tank' : 'normal',
    competitorId: c.id,
  }
}

/**
 * Échanger un tuyau : le concurrent indique un marché où un bien se vend cher
 * en ce moment. Le tuyau est réel — il crée la hausse qu'il annonce.
 */
export function tradeTip(gs: GameState, id: string): Pick<GameState, 'competitors' | 'marketPressure'> & { tip: CompetitorNews } {
  const voisins = getAccessibleStations(gs.currentStation)
  const cible = voisins.length > 0 ? pick(voisins) : getStation(gs.currentStation)
  const biens = achetable(cible.name)
  const item = biens.length > 0 ? pick(biens) : 'Médicaments'
  const c = (gs.competitors ?? []).find(x => x.id === id)
  return {
    competitors: (gs.competitors ?? []).map(x => x.id === id ? { ...x, mood: Math.min(100, x.mood + 15) } : x),
    marketPressure: [...(gs.marketPressure ?? []), { station: cible.name, item, mult: 1.35, untilDay: gs.day + 4, by: c?.name ?? '' }],
    tip: { key: 'tip', params: { name: c?.name ?? '', item, station: cible.name } },
  }
}

/** Issue d'un duel gagné : le joueur prend une part de sa fortune, il est hors-jeu quelques jours. */
export function settleCompetitorDuel(gs: GameState, id: string): { patch: Pick<GameState, 'competitors' | 'credits'>; amount: number } {
  const c = (gs.competitors ?? []).find(x => x.id === id)
  const amount = c ? Math.floor(c.credits * 0.25) : 0
  return {
    amount,
    patch: {
      credits: gs.credits + amount,
      competitors: (gs.competitors ?? []).map(x => x.id === id
        ? { ...x, credits: x.credits - amount, mood: Math.max(-100, x.mood - 30), outUntilDay: gs.day + 3 }
        : x),
    },
  }
}

export function snubCompetitor(gs: GameState, id: string): Pick<GameState, 'competitors'> {
  return { competitors: (gs.competitors ?? []).map(x => x.id === id ? { ...x, mood: Math.max(-100, x.mood - 5) } : x) }
}

/** Classement par fortune, joueur compris. Rang 1 = le plus riche. */
export function getStandings(gs: GameState): { name: string; credits: number; isPlayer: boolean; style?: CompetitorStyle }[] {
  return [
    { name: '', credits: gs.credits, isPlayer: true },
    ...(gs.competitors ?? []).map(c => ({ name: c.name, credits: c.credits, isPlayer: false, style: c.style })),
  ].sort((a, b) => b.credits - a.credits)
}

export function getPlayerRank(gs: GameState): number {
  return getStandings(gs).findIndex(s => s.isPlayer) + 1
}
