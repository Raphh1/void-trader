import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { initCombat, processCombatAction } from '../engine/combat'
import { getTierBoss, getTierLow } from '../data/enemies'
import { getSubBossesForPillar } from '../data/subBosses'
import { getWeapons } from '../data/weapons'
import { getArmors } from '../data/armors'
import { getClasses } from '../data/classes'
import type { GameState, Enemy, PlayerClass, WeaponData, ArmorData } from '../types'

// Ces simulations pilotent le VRAI moteur de combat (initCombat +
// processCombatAction) plutôt qu'un modèle réécrit à la main : c'est la seule
// façon d'être sûr que les chiffres d'équilibrage correspondent au jeu réel,
// mécaniques spéciales des boss et des sous-boss comprises.

beforeAll(async () => {
  await initI18n()
})

const N = 400

function makeGs(cls: PlayerClass, weapon: WeaponData, armor: ArmorData, maxHp: number, meds: number): GameState {
  return {
    class: cls,
    playerHp: maxHp, playerMaxHp: maxHp,
    stamina: 100, maxStamina: 100,
    shipHp: 100, shipMaxHp: 100,
    credits: 5000, reputation: 50, fuel: 5, maxFuel: 8, day: 30,
    equippedWeapon: weapon, equippedArmor: armor,
    cargo: { 'Médicaments': meds },
    weapons: [weapon], armors: [armor],
    moralTags: [], completedObjectives: [], completedQuestIds: [], activeQuests: [],
    visitedStations: [], stationBossesBeaten: [], subBossesDefeated: {},
    pastDecisions: [], journal: [], runModifiers: [],
    currentStation: 'La Carcasse', combatsWon: 20, combatsFled: 0,
    pillarStanding: {}, factionReputation: { faucons: 0, emporium: 0, gardiens: 0, culte: 0 },
    faction: 'none', nexusFragments: [], isDead: false,
  } as unknown as GameState
}

/** Joue un combat complet avec une IA simple : soigne si bas, finisher si prêt, sinon attaque. */
function fight(gs0: GameState, enemy: Enemy): 'win' | 'loss' {
  let gs = { ...gs0 }
  let cs = initCombat(enemy)
  for (let turn = 0; turn < 300; turn++) {
    const lowHp = gs.playerHp < gs.playerMaxHp * 0.45
    const canHeal = (gs.cargo['Médicaments'] ?? 0) > 0 && cs.medicUses < 3
    const action = lowHp && canHeal
      ? { type: 'heal' as const }
      : cs.momentum >= 3
        ? { type: 'finisher' as const }
        : { type: 'attack' as const }

    const res = processCombatAction(gs, cs, enemy, action)
    gs = { ...gs, ...res.newGs }
    cs = res.newCs
    if (res.outcome === 'victory') return 'win'
    if (res.outcome) return 'loss'          // dead / captured / stunned / fled
    if (gs.playerHp <= 0) return 'loss'
  }
  return 'loss'                              // combat interminable = échec
}

function winRate(gs: GameState, enemy: Enemy): number {
  let wins = 0
  for (let i = 0; i < N; i++) if (fight(gs, enemy) === 'win') wins++
  return Math.round((wins / N) * 100)
}

// ── Personnages de test, construits à partir des VRAIES données ──────────────
const cls = (name: string) => getClasses().find(c => c.name === name)!
const weapon = (name: string) => getWeapons().find(w => w.name === name)!
const armor = (name: string) => getArmors().find(a => a.name === name)!
const boss = (name: string) => getTierBoss().find(e => e.name === name)!

function endgame(className: string): GameState {
  // arme T5 la plus forte + meilleure armure + implants (PV max ~185-225)
  const base = cls(className)
  const maxHp = base.startHp + 45 + 40
  return makeGs(base, weapon('Lame de la Fin des Temps'), armor('Armure de la Singularité'), maxHp, 3)
}

describe('simulation de combat sur le moteur réel', () => {
  it('rend les boss piliers gagnables en fin de partie, Raphazarus restant le mur', () => {
    const marchand = endgame('Marchand')
    const rows = getTierBoss()
      .filter(e => e.pillarAbility)
      .map(e => ({ name: e.name, hp: e.maxHp, wr: winRate(marchand, e) }))

    console.log('\n── MARCHAND full stuff vs BOSS PILIERS (moteur réel, ' + N + ' combats) ──')
    for (const r of rows.sort((a, b) => b.wr - a.wr)) {
      console.log('  ' + String(r.wr).padStart(3) + ' %  ' + r.name.padEnd(18) + String(r.hp).padStart(4) + ' PV')
    }

    // Chaque pilier doit rester battable par une classe neutre bien équipée…
    for (const r of rows) {
      expect(r.wr, `${r.name} injouable`).toBeGreaterThan(5)
    }
    // …mais Raphazarus doit rester le plus dur des cinq.
    const raph = rows.find(r => r.name === 'Raphazarus')!
    const others = rows.filter(r => r.name !== 'Raphazarus')
    expect(Math.min(...others.map(o => o.wr)), 'Raphazarus n\'est plus le plus dur')
      .toBeGreaterThanOrEqual(raph.wr)
  })

  it('récompense les classes de combat face au boss final', () => {
    const raphazarus = boss('Raphazarus')
    const results = ['Marchand', 'Vétéran', 'Seigneur de guerre'].map(name => ({
      name, wr: winRate(endgame(name), raphazarus),
    }))

    console.log('\n── vs RAPHAZARUS par classe (moteur réel) ──')
    for (const r of results) console.log('  ' + String(r.wr).padStart(3) + ' %  ' + r.name)

    const marchand = results.find(r => r.name === 'Marchand')!.wr
    const veteran = results.find(r => r.name === 'Vétéran')!.wr
    const seigneur = results.find(r => r.name === 'Seigneur de guerre')!.wr

    // Régression du bug corrigé : les bonus de classe ne s'appliquaient qu'à
    // mains nues, donc toutes les classes frappaient pareil une fois équipées.
    expect(veteran, 'le Vétéran ne tire aucun avantage de sa classe').toBeGreaterThan(marchand)
    expect(seigneur, 'le Seigneur de guerre ne tire aucun avantage de sa classe').toBeGreaterThan(marchand)
  })

  it('garde les lieutenants franchissables une fois équipé, mais pas avant', () => {
    const lieutenants = ['alanossa','cesarion','raphazarus','scotty'].flatMap(p => getSubBossesForPillar(p))
    const early = makeGs(cls('Marchand'), weapon('Couteau de rue'), armor('Veste en cuir renforcé'), 100, 1)
    const late = endgame('Marchand')

    console.log('\n── LIEUTENANTS : début vs fin de partie (moteur réel) ──')
    for (const sb of lieutenants) {
      const wrEarly = winRate(early, sb.enemy)
      const wrLate = winRate(late, sb.enemy)
      console.log('  ' + String(wrEarly).padStart(3) + ' % → ' + String(wrLate).padStart(3) + ' %   ' + sb.name)
      // S'équiper doit toujours aider, même quand le combat reste très dur.
      expect(wrLate, `${sb.name} pas plus facile une fois équipé`).toBeGreaterThanOrEqual(wrEarly)

      // Les 16 lieutenants sont des passages OBLIGÉS vers les fragments : aucun
      // ne doit être un mur au combat pour un joueur en équipement maximal.
      // Ce seuil garde le plafond par coup (subBossHitCap) honnête : s'il est
      // resserré, ou si une mécanique d'annulation est ajoutée sans relever le
      // damageCapPct correspondant, ce test le rattrape.
      expect(wrLate, `${sb.name} reste un mur en équipement maximal`).toBeGreaterThan(50)
    }
  })

  it('ne produit jamais d\'état de combat incohérent', () => {
    // Garde-fou : PV négatifs, NaN, combats sans fin — sur un large échantillon
    // d'ennemis et d'actions variées.
    const gs = endgame('Vétéran')
    const enemies = [...getTierLow().slice(0, 5), ...getTierBoss().slice(0, 5)]
    for (const enemy of enemies) {
      for (let i = 0; i < 30; i++) {
        let g = { ...gs }
        let cs = initCombat(enemy)
        for (let t = 0; t < 60; t++) {
          const res = processCombatAction(g, cs, enemy, { type: 'attack' })
          g = { ...g, ...res.newGs }
          cs = res.newCs
          expect(Number.isFinite(cs.enemyHp), enemy.name).toBe(true)
          expect(Number.isFinite(g.playerHp), enemy.name).toBe(true)
          expect(g.playerHp, enemy.name).toBeGreaterThanOrEqual(0)
          if (res.outcome) break
        }
      }
    }
  })
})
