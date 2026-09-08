import type { WeaponData, ArmorData, GameState } from '../types'
import { grantArmor } from './armors'
import i18n from '../i18n/config'
import { translateStationName, translateGood, translateEnemyName } from '../engine/goodsI18n'

const eq = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'equipmentQuests', ...params })

export type EquipmentQuestDifficulty = 'common' | 'rare' | 'epic' | 'legendary'

export interface EquipmentQuest {
  id: string
  title: string
  description: string
  difficulty: EquipmentQuestDifficulty
  station: string
  requirements: EquipmentQuestRequirement[]
  reward: { weapon?: WeaponData; armor?: ArmorData }
}

export type EquipmentQuestRequirement =
  | { type: 'credits'; amount: number }
  | { type: 'reputation'; min: number }
  | { type: 'item'; name: string; qty: number }
  | { type: 'combatsWon'; min: number }
  | { type: 'visitStation'; station: string }
  | { type: 'bossKill'; bossName: string }
  | { type: 'day'; min: number }
  | { type: 'subBoss'; subBossId: string }

function w(name: string, tier: number, dMin: number, dMax: number, crit: number,
  effect: WeaponData['effect'], eChance: number, eDesc: string,
  selfChance = 0, selfMax = 0): WeaponData {
  return { name, tier, damageMin: dMin, damageMax: dMax, critChance: crit, effect, effectChance: eChance, effectDesc: eDesc, selfDmgChance: selfChance, selfDmgMax: selfMax, affinities: {} }
}

function a(name: string, tier: number, def: number, hp: number,
  effect: ArmorData['effect'], eVal: number, desc: string, sell: number): ArmorData {
  return { name, tier, defense: def, hpBonus: hp, effect, effectValue: eVal, description: desc, sellValue: sell }
}

export function getEquipmentQuests(): EquipmentQuest[] {
  return [
  // ── COMMON (Tier 2) ──────────────────────────────────────────────────────
  {
    id: 'eq-lame-recup',
    title: eq('quests.eqLameRecup.title'),
    description: eq('quests.eqLameRecup.description'),
    difficulty: 'common',
    station: 'La Carcasse',
    requirements: [
      { type: 'item', name: 'Métaux bruts', qty: 3 },
      { type: 'credits', amount: 500 },
    ],
    reward: { weapon: w('Lame de la Carcasse', 2, 14, 28, 15, 'armorPierce', 0, eq('quests.eqLameRecup.weaponEffect')) },
  },
  {
    id: 'eq-gilet-garde',
    title: eq('quests.eqGiletGarde.title'),
    description: eq('quests.eqGiletGarde.description'),
    difficulty: 'common',
    station: 'Fort Kharos',
    requirements: [
      { type: 'credits', amount: 800 },
      { type: 'reputation', min: 15 },
    ],
    reward: { armor: a('Gilet du Garde Déchu', 2, 22, 10, 'none', 0, eq('quests.eqGiletGarde.armorDesc'), 300) },
  },

  // ── RARE (Tier 3) ────────────────────────────────────────────────────────
  {
    id: 'eq-fusil-fantome',
    title: eq('quests.eqFusilFantome.title'),
    description: eq('quests.eqFusilFantome.description'),
    difficulty: 'rare',
    station: 'Station Fantôme',
    requirements: [
      { type: 'combatsWon', min: 10 },
      { type: 'credits', amount: 2000 },
      { type: 'item', name: 'Données volées', qty: 2 },
    ],
    reward: { weapon: w('Fusil du Fantôme', 3, 22, 44, 22, 'blind', 40, eq('quests.eqFusilFantome.weaponEffect')) },
  },
  {
    id: 'eq-armure-mira',
    title: eq('quests.eqArmureMira.title'),
    description: eq('quests.eqArmureMira.description'),
    difficulty: 'rare',
    station: 'Les Cavernes de Mira',
    requirements: [
      { type: 'item', name: 'Cristaux énergétiques', qty: 3 },
      { type: 'credits', amount: 2500 },
      { type: 'day', min: 8 },
    ],
    reward: { armor: a('Armure Cristalline de Mira', 3, 28, 20, 'thorns', 30, eq('quests.eqArmureMira.armorDesc'), 800) },
  },
  {
    id: 'eq-lame-noctis',
    title: eq('quests.eqLameNoctis.title'),
    description: eq('quests.eqLameNoctis.description'),
    difficulty: 'rare',
    station: 'La Forge Noire',
    requirements: [
      { type: 'item', name: "Composants d'armure", qty: 2 },
      { type: 'item', name: 'Armes artisanales', qty: 1 },
      { type: 'credits', amount: 3000 },
      { type: 'combatsWon', min: 15 },
    ],
    reward: { weapon: w('Lame Noctis Forgée', 3, 24, 48, 20, 'double_strike', 0, eq('quests.eqLameNoctis.weaponEffect')) },
  },

  // ── EPIC (Tier 4) ────────────────────────────────────────────────────────
  {
    id: 'eq-canon-velkor',
    title: eq('quests.eqCanonVelkor.title'),
    description: eq('quests.eqCanonVelkor.description'),
    difficulty: 'epic',
    station: 'Les Abysses de Velkor',
    requirements: [
      { type: 'item', name: 'Données classifiées', qty: 3 },
      { type: 'item', name: 'Composants expérimentaux', qty: 2 },
      { type: 'credits', amount: 6000 },
      { type: 'reputation', min: 40 },
    ],
    reward: { weapon: w('Canon Abyssal', 4, 32, 62, 26, 'shock', 45, eq('quests.eqCanonVelkor.weaponEffect'), 8, 20) },
  },
  {
    id: 'eq-armure-ecarlate',
    title: eq('quests.eqArmureEcarlate.title'),
    description: eq('quests.eqArmureEcarlate.description'),
    difficulty: 'epic',
    station: "L'Arsenal Écarlate",
    requirements: [
      { type: 'reputation', min: 50 },
      { type: 'combatsWon', min: 25 },
      { type: 'credits', amount: 5000 },
      { type: 'visitStation', station: 'Bastion Mineur' },
    ],
    reward: { armor: a('Armure Légendaire Écarlate', 4, 38, 25, 'regen', 10, eq('quests.eqArmureEcarlate.armorDesc'), 2200) },
  },
  {
    id: 'eq-vampirelle-mk2',
    title: eq('quests.eqVampirelleMk2.title'),
    description: eq('quests.eqVampirelleMk2.description'),
    difficulty: 'epic',
    station: 'La Bulle',
    requirements: [
      { type: 'item', name: 'Composants biologiques', qty: 3 },
      { type: 'credits', amount: 7000 },
      { type: 'day', min: 15 },
    ],
    reward: { weapon: w('Vampirelle Mk.II', 4, 26, 52, 22, 'lifesteal', 0, eq('quests.eqVampirelleMk2.weaponEffect')) },
  },

  // ── LEGENDARY (Tier 5) ───────────────────────────────────────────────────
  {
    id: 'eq-lame-nexus',
    title: eq('quests.eqLameNexus.title'),
    description: eq('quests.eqLameNexus.description'),
    difficulty: 'legendary',
    station: 'Le Berceau',
    requirements: [
      { type: 'item', name: 'Artefacts', qty: 5 },
      { type: 'item', name: 'Données pré-Fracture', qty: 2 },
      { type: 'credits', amount: 15000 },
      { type: 'combatsWon', min: 40 },
      { type: 'reputation', min: 60 },
    ],
    reward: { weapon: w('Lame du Nexus Originel', 5, 45, 88, 32, 'momentum_surge', 0, eq('quests.eqLameNexus.weaponEffect')) },
  },
  {
    id: 'eq-armure-singularite',
    title: eq('quests.eqArmureSingularite.title'),
    description: eq('quests.eqArmureSingularite.description'),
    difficulty: 'legendary',
    station: 'Sanctum Machina',
    requirements: [
      { type: 'item', name: 'Composants expérimentaux', qty: 4 },
      { type: 'item', name: 'Implants cybernétiques', qty: 2 },
      { type: 'credits', amount: 12000 },
      { type: 'day', min: 25 },
      { type: 'combatsWon', min: 35 },
    ],
    reward: { armor: a('Armure de la Singularité Mk.II', 5, 50, 35, 'immunity', 1, eq('quests.eqArmureSingularite.armorDesc'), 5000) },
  },
  {
    id: 'eq-sceptre-roi',
    title: eq('quests.eqSceptreRoi.title'),
    description: eq('quests.eqSceptreRoi.description'),
    difficulty: 'legendary',
    station: "L'Arc Perdu",
    requirements: [
      { type: 'item', name: 'Reliques de la Grande Guerre', qty: 3 },
      { type: 'combatsWon', min: 50 },
      { type: 'credits', amount: 10000 },
      { type: 'reputation', min: 70 },
      { type: 'subBoss', subBossId: 'ala-4' },
    ],
    reward: { weapon: w('Sceptre du Roi Perdu', 5, 48, 92, 30, 'berserker', 0, eq('quests.eqSceptreRoi.weaponEffect')) },
  },
  ]
}

export function getQuestsAtStation(station: string): EquipmentQuest[] {
  return getEquipmentQuests().filter(q => q.station === station)
}

export function canStartQuest(gs: GameState, quest: EquipmentQuest): { ok: boolean; missing: string[] } {
  if ((gs.completedEquipmentQuests ?? []).includes(quest.id)) return { ok: false, missing: [eq('missing.alreadyCompleted')] }
  const missing: string[] = []
  for (const req of quest.requirements) {
    switch (req.type) {
      case 'credits':
        if (gs.credits < req.amount) missing.push(eq('missing.creditsMissing', { amount: req.amount - gs.credits }))
        break
      case 'reputation':
        if (gs.reputation < req.min) missing.push(eq('missing.reputation', { value: gs.reputation, needed: req.min }))
        break
      case 'item': {
        const qty = gs.cargo[req.name] ?? 0
        if (qty < req.qty) missing.push(eq('missing.item', { name: translateGood(req.name), have: qty, needed: req.qty }))
        break
      }
      case 'combatsWon':
        if ((gs.combatsWon ?? 0) < req.min) missing.push(eq('missing.combatsWon', { value: gs.combatsWon ?? 0, needed: req.min }))
        break
      case 'visitStation':
        if (!gs.visitedStations.includes(req.station)) missing.push(eq('missing.visitStation', { station: translateStationName(req.station) }))
        break
      case 'bossKill':
        if (!gs.stationBossesBeaten.includes(req.bossName)) missing.push(eq('missing.bossKill', { boss: translateEnemyName(req.bossName) }))
        break
      case 'day':
        if (gs.day < req.min) missing.push(eq('missing.day', { value: gs.day, needed: req.min }))
        break
      case 'subBoss': {
        const defeated = gs.subBossesDefeated ?? {}
        const allDefeated = Object.values(defeated).flat()
        if (!allDefeated.includes(req.subBossId)) missing.push(eq('missing.subBoss'))
        break
      }
    }
  }
  return { ok: missing.length === 0, missing }
}

export function completeQuest(gs: GameState, quest: EquipmentQuest): Partial<GameState> {
  const patch: Partial<GameState> = {
    completedEquipmentQuests: [...(gs.completedEquipmentQuests ?? []), quest.id],
  }
  let newCargo = { ...gs.cargo }
  let newCredits = gs.credits
  for (const req of quest.requirements) {
    if (req.type === 'credits') newCredits -= req.amount
    if (req.type === 'item') {
      newCargo[req.name] = (newCargo[req.name] ?? 0) - req.qty
      if (newCargo[req.name] <= 0) delete newCargo[req.name]
    }
  }
  patch.credits = newCredits
  patch.cargo = newCargo
  if (quest.reward.weapon) {
    patch.weapons = [...gs.weapons, quest.reward.weapon]
  }
  if (quest.reward.armor) {
    Object.assign(patch, grantArmor({ ...gs, credits: newCredits }, quest.reward.armor))
  }
  return patch
}
