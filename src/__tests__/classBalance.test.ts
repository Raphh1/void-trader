import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { initCombat, processCombatAction } from '../engine/combat'
import { getClasses } from '../data/classes'
import { getWeapons } from '../data/weapons'
import { getArmors } from '../data/armors'
import { getEnemyForStation, scaleEnemy } from '../data/enemies'
import type { GameState, Enemy } from '../types'

// Garde-fou d'équité entre classes. Le jeu avait un écart de 8,2× sur l'indice
// de puissance brut (attaque ÷ dégâts reçus × PV), et deux classes étiquetées
// « good » (Héritier, Hackeur) étaient en réalité les pires du jeu. Les
// compétences de classe sont censées ramener tout le monde dans une fourchette
// jouable : ce test échoue si une classe redevient injouable.

beforeAll(async () => { await initI18n() })

const cls = (n: string) => getClasses().find(c => c.name === n)!

function mk(clsName: string, tier: number): GameState {
  const c = cls(clsName)
  const hp = c.startHp + tier * 18
  return {
    class: c, playerHp: hp, playerMaxHp: hp,
    stamina: 100, maxStamina: 100, shipHp: 100, shipMaxHp: 100,
    credits: 20000, reputation: 50, fuel: 5, maxFuel: 8, day: 25,
    equippedWeapon: getWeapons().filter(w => w.tier === tier)[0],
    equippedArmor: getArmors().filter(a => a.tier === tier)[0],
    cargo: { 'Médicaments': 3 }, weapons: [], armors: [],
    moralTags: [], completedObjectives: [], completedQuestIds: [], activeQuests: [],
    visitedStations: [], stationBossesBeaten: [], subBossesDefeated: {},
    pastDecisions: [], journal: [], runModifiers: [], currentStation: 'La Carcasse',
    combatsWon: 20, combatsFled: 0,
    pillarStanding: { cesarion: 0, raphazarus: 0, eliotis: 0, maxance: 0, alanossa: 0, scotty: 0 },
    factionReputation: { faucons: 0, emporium: 0, gardiens: 0, culte: 0 },
    shipModules: { moteur: 0, soute: 0, tourelle: 0, scanner: 0 },
    faction: 'none', nexusFragments: [], isDead: false, folieLevel: 0,
  } as unknown as GameState
}

/** Joue en utilisant l'action de classe : sans elle, on ne mesurerait rien. */
function fight(gs0: GameState, enemy: Enemy): boolean {
  let gs = { ...gs0 }
  let cs = initCombat(enemy)
  for (let t = 0; t < 250; t++) {
    const low = gs.playerHp < gs.playerMaxHp * 0.45
    const canHeal = (gs.cargo['Médicaments'] ?? 0) > 0 && cs.medicUses < 3
    let a: Parameters<typeof processCombatAction>[3]
    // Le Contrebandier a une fuite garantie comme action de classe : la jouer
    // reviendrait a abandonner chaque combat. On la lui laisse en reserve.
    const actionUtile = gs0.class.name !== 'Contrebandier'
    if (!cs.classActionUsed && t >= 1 && actionUtile) a = { type: 'class' }
    else if (low && canHeal) a = { type: 'heal' }
    else if (cs.momentum >= 3) a = { type: 'finisher' }
    else a = { type: 'attack' }
    const res = processCombatAction(gs, cs, enemy, a)
    gs = { ...gs, ...res.newGs }
    cs = res.newCs
    if (res.outcome === 'victory') return true
    if (res.outcome || gs.playerHp <= 0) return false
  }
  return false
}

describe('équité entre classes', () => {
  it('garde toutes les classes jouables sur les ennemis courants', () => {
    const noms = getClasses().map(c => c.name)
    const stations = ['La Carcasse', 'Port Méridien', 'Fort Kharos']
    const rows: { n: string; v: number }[] = []

    for (const n of noms) {
      const gs = mk(n, 3)
      let wins = 0
      const N = 120
      for (let i = 0; i < N; i++) {
        const d = i % 2 === 0 ? 3 : 5
        const e = scaleEnemy(getEnemyForStation(stations[i % 3], d, 25), Math.max(0, d - 2))
        if (fight(gs, e)) wins++
      }
      rows.push({ n, v: Math.round(wins / N * 100) })
    }
    rows.sort((a, b) => b.v - a.v)
    console.log('\n── ÉQUITÉ DES CLASSES (équipement T3, profondeurs 3 et 5) ──')
    for (const r of rows) console.log('  ' + String(r.v).padStart(3) + ' %  ' + r.n)

    // Rayane est volontairement la pire classe du jeu (« pires stats du jeu »
    // est écrit dans sa description) : on lui laisse un plancher plus bas.
    for (const r of rows) {
      const plancher = r.n === 'Rayane' ? 35 : 55
      expect(r.v, `${r.n} est injouable (${r.v} %)`).toBeGreaterThanOrEqual(plancher)
    }

    // Et l'écart global doit rester un choix de style, pas une hiérarchie.
    const vals = rows.map(r => r.v)
    expect(Math.max(...vals) / Math.min(...vals), 'écart entre classes trop large')
      .toBeLessThan(3)
  })
})
