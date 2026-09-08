import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { initCombat, processCombatAction } from '../engine/combat'
import { getStations, getStation, getFuelCost, LOOT_ONLY_ITEMS, PILLAR_SEAT_STATIONS } from '../data/stations'
import { getClasses } from '../data/classes'
import { getEnemyForStation, scaleEnemy } from '../data/enemies'
import { buildTutorialQuest } from '../engine/quests'
import type { GameState, Enemy } from '../types'

// Le début de partie n'était couvert par aucun test : tout l'équilibrage mesuré
// jusqu'ici portait sur la fin (lieutenants, piliers, T5). Or c'est le premier
// quart d'heure qui décide si un testeur reste. Ces tests vérifient qu'aucune
// classe ne démarre dans une impasse.

beforeAll(async () => { await initI18n() })

/** Stations joignables depuis `from` avec `fuel` carburant. */
function reachableFrom(from: string, fuel: number): string[] {
  return getStations()
    .filter(s => s.name !== from)
    .filter(s => {
      const cost = s.fuelCostFrom?.[from]
      return typeof cost === 'number' && cost <= fuel
    })
    .map(s => s.name)
}

function newGame(clsName: string): GameState {
  const c = getClasses().find(x => x.name === clsName)!
  return {
    class: c, playerHp: c.startHp, playerMaxHp: c.startHp,
    stamina: c.startStamina, maxStamina: c.startStamina,
    shipHp: 100, shipMaxHp: 100,
    credits: c.startCredits, reputation: 0, fuel: c.startFuel, maxFuel: c.maxFuel, day: 1,
    equippedWeapon: null, equippedArmor: null,
    cargo: c.medicBonus ? { 'Médicaments': 2 } : {}, weapons: [], armors: [],
    moralTags: [], completedObjectives: [], completedQuestIds: [], activeQuests: [],
    visitedStations: [c.startStation], stationBossesBeaten: [], subBossesDefeated: {},
    pastDecisions: [], journal: [], runModifiers: [], currentStation: c.startStation,
    combatsWon: 0, combatsFled: 0,
    pillarStanding: { cesarion: 0, raphazarus: 0, eliotis: 0, maxance: 0, alanossa: 0, scotty: 0 },
    factionReputation: { faucons: 0, emporium: 0, gardiens: 0, culte: 0 },
    shipModules: { moteur: 0, soute: 0, tourelle: 0, scanner: 0 },
    faction: 'none', nexusFragments: [], isDead: false, folieLevel: 0,
  } as unknown as GameState
}

function fight(gs0: GameState, enemy: Enemy): boolean {
  let gs = { ...gs0 }
  let cs = initCombat(enemy)
  for (let t = 0; t < 200; t++) {
    const res = processCombatAction(gs, cs, enemy, { type: 'attack' })
    gs = { ...gs, ...res.newGs }
    cs = res.newCs
    if (res.outcome === 'victory') return true
    if (res.outcome || gs.playerHp <= 0) return false
  }
  return false
}

describe('premier quart d\'heure', () => {

  it('ne piège aucune classe au jour 1 (carburant de départ)', () => {
    console.log('\n── DÉPART : destinations joignables au jour 1 ──')
    for (const c of getClasses()) {
      const dests = reachableFrom(c.startStation, c.startFuel)
      console.log('  ' + c.name.padEnd(20) + c.startStation.padEnd(24) +
        c.startFuel + ' fuel → ' + dests.length + ' destination(s)')
      // Une seule destination suffit à ne pas être bloqué, mais zéro est un
      // softlock immédiat : le joueur ne peut littéralement rien faire.
      expect(dests.length, `${c.name} démarre sans aucune destination joignable`)
        .toBeGreaterThan(0)
    }
  })

  it('donne à chaque classe une quête tutoriel cohérente et réalisable', () => {
    console.log('\n── QUÊTE TUTORIEL PAR CLASSE ──')
    for (const c of getClasses()) {
      const q = buildTutorialQuest(c.startStation)
      const cible = q.targetStation!
      const cout = getFuelCost(c.startStation, cible)

      // La cible doit être une vraie station, différente du départ, et joignable
      // avec le carburant initial — sinon la première quête du jeu est un piège.
      expect(() => getStation(cible), `${c.name} : station cible inconnue`).not.toThrow()
      expect(cible, `${c.name} : la quête cible la station de départ`).not.toBe(c.startStation)
      expect(cout, `${c.name} : cible hors de portée (${cout} fuel pour ${c.startFuel})`)
        .toBeLessThanOrEqual(c.startFuel)

      // L'objet demandé doit être vendu au départ ET réellement achetable.
      // La Citadelle Écarlate ne propose que des marchandises « loot only », et
      // le tutoriel y exigeait d'acheter des Armures d'élite : impossible.
      expect(getStation(c.startStation).goods, `${c.name} : objet introuvable au départ`)
        .toContain(q.targetItem)
      expect(LOOT_ONLY_ITEMS.has(q.targetItem!), `${c.name} : objet non achetable (${q.targetItem})`)
        .toBe(false)

      // Et la cible ne doit pas être le siège d un détenteur de pilier : le
      // Contrebandier était envoyé à Arc Ouest Apocalypse, chez Alanossa, pour
      // sa toute première livraison.
      expect(PILLAR_SEAT_STATIONS.has(cible), `${c.name} : tutoriel envoyé chez un détenteur de pilier (${cible})`)
        .toBe(false)

      console.log('  ' + c.name.padEnd(20) + (q.targetItem ?? '').slice(0, 22).padEnd(24) +
        '→ ' + cible.slice(0, 20).padEnd(22) + cout + '/' + c.startFuel + ' fuel')
    }
  })

  it('rend les premiers combats gagnables sans équipement', () => {
    console.log('\n── PREMIER COMBAT (mains nues, profondeur 1) ──')
    const rows: { n: string; v: number }[] = []
    for (const c of getClasses()) {
      const gs = newGame(c.name)
      let wins = 0
      const N = 120
      for (let i = 0; i < N; i++) {
        const e = scaleEnemy(getEnemyForStation(c.startStation, 1, 1), 0)
        if (fight(gs, e)) wins++
      }
      rows.push({ n: c.name, v: Math.round(wins / N * 100) })
    }
    rows.sort((a, b) => a.v - b.v)
    for (const r of rows) console.log('  ' + String(r.v).padStart(3) + ' %  ' + r.n)

    // Un premier combat perdu d'avance, sans arme et sans crédits, met fin au
    // run avant que le joueur ait compris quoi que ce soit.
    for (const r of rows) {
      expect(r.v, `${r.n} : premier combat quasi imperdable à ${r.v} %`).toBeGreaterThan(35)
    }
  })
})
