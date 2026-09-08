import type { GameState, Quest, QuestType } from '../types'
import { getAccessibleStations, getStation, LOOT_ONLY_ITEMS } from '../data/stations'
import { getRunQuestRewardMult } from '../data/runModifiers'
import { translateGood, translateStationName } from './goodsI18n'
import i18n from '../i18n/config'

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// Traduction : `descs.<type>.<index>` — un index au hasard dans le pool du type.
const DESC_POOL_SIZES: Record<QuestType, number> = {
  delivery: 5, kill: 5, revenge: 5, escort: 5,
  sabotage: 4, heist: 4, extraction: 4, bounty: 4, patrol: 4,
}
function pickDesc(type: QuestType, params: Record<string, string>): string {
  const idx = Math.floor(Math.random() * DESC_POOL_SIZES[type])
  return i18n.t(`descs.${type}.${idx}`, { ns: 'quests', ...params })
}

// Économie volontairement dure : les quêtes rapportent nettement moins de crédits.
const ECONOMY_MULT = 0.6

const GIVER_NAMES = [
  'Marek','Sela','Donn','Yara','Pistis','Boro','Cael','Neva','Torvak','Lira',
  'Besh','Rook','Ysla','Ganz','Myrra','Sten','Orva','Kael','Fen','Drela',
  'Vance','Wyll','Soru','Thas','Nori','Brixa','Cador','Eska','Ulmo','Pheth',
  'Juno','Varek','Sinn','Drex','Orvyn','Cassa','Thael','Wyrn','Pell','Idos',
]

const DELIVERY_ITEMS = [
  'Médicaments','Pièces techniques','Vivres','Or',
  'Artefacts','Ferraille','Plantes médicinales',
  'Données classifiées','Composants électroniques','Munitions',
  'Implants','Eau purifiée','Rations militaires','Cristaux énergétiques',
]

// Objets qui n'existent nulle part dans le commerce — uniquement issus de
// l'Atelier de fabrication (recipes.ts : void_regulator, ghost_nav_chip,
// annealed_alloy). Une quête ciblant l'un d'eux ne peut pas se résoudre en
// achetant : il faut réunir les matériaux et les fabriquer soi-même.
export const CRAFTED_DELIVERY_ITEMS = ['Régulateur de Vide', 'Puce de Navigation Fantôme', 'Alliage Recuit']

// ── QUÊTE TUTORIELLE (5.1) ────────────────────────────────────────────────────
// Auto-assignée au jour 1. Un PNJ de la station de départ demande une livraison
// vers la station proche la moins chère. Guide le joueur : acheter → voyager →
// livrer → revenir. Récompense : crédits + révélation du tracker Nexus.
export const TUTORIAL_QUEST_ID = 'tutorial-delivery'

export function buildTutorialQuest(startStation: string): Quest {
  const accessible = getAccessibleStations(startStation)
  // Cible : la station accessible la moins chère en carburant (la plus proche)
  const target = accessible.length > 0
    ? accessible.reduce((best, s) =>
        (s.fuelCostFrom[startStation] ?? 99) < (best.fuelCostFrom[startStation] ?? 99) ? s : best
      )
    : null
  const targetName = target?.name ?? startStation
  // Item vendu sur place mais PAS dans la cargaison de départ (Médicaments) :
  // force le joueur à passer par le marché pour apprendre l'achat.
  const startGoods = getStation(startStation).goods
  const achetables = startGoods.filter(g => !LOOT_ONLY_ITEMS.has(g))
  const item = achetables.find(g => g !== 'Médicaments') ?? achetables[0] ?? 'Médicaments'

  return {
    id: TUTORIAL_QUEST_ID,
    title: i18n.t('tutorial.title', { ns: 'quests', item: translateGood(item) }),
    giver: 'Vieux Doss',
    giverStation: startStation,
    type: 'delivery',
    description: i18n.t('tutorial.description', { ns: 'quests', station: translateStationName(startStation), target: translateStationName(targetName), item: translateGood(item) }),
    targetStation: targetName,
    targetItem: item,
    creditReward: 800,
    repReward: 15,
  }
}

const HEIST_ITEMS = [
  'Données classifiées','Implants','Cristaux énergétiques',
  'Or','Armes illégales','Technologies avancées','Composants expérimentaux',
]

const EXTRACTION_ITEMS = [
  'Pièces techniques','Composants électroniques','Données','Artefacts',
  'Médicaments premium','Logiciels','Renseignements',
]

const BOSS_NAMES: Record<string, string> = {
  'Arc Ouest Apocalypse':   'Alanossa',
  'Le Nid des Faucons':     'La Faucon',
  'Les Abysses de Velkor':  'Directeur Pale',
  'Star Quest':             "Garde du Corps d'Eliotis",
  'Emporium Requiem':       'Le Directeur Pale',
  'La Citadelle Écarlate':  'La Commandante Sable',
  'Fort Kharos':            'Le Général Ossian',
  'Fort Ossian':            'Frère Ossian le Dernier',
}

// ── GÉNÉRATEUR PRINCIPAL ─────────────────────────────────────────────────────

const ALL_TYPES: QuestType[] = [
  'delivery','kill','revenge',
  'escort','sabotage','heist','extraction','bounty','patrol',
]

// Types dont la complétion exige de vaincre le chef de la station cible —
// ce combat ne peut se déclencher (via exploration) que si danger >= 2.
// Une station trop calme rendrait la quête littéralement impossible.
export const BOSS_TRIGGER_TYPES: QuestType[] = ['kill', 'revenge', 'sabotage', 'bounty']

// Poids par type pour le tirage (rare = plus intéressant)
const TYPE_WEIGHTS: Record<QuestType, number> = {
  delivery:   20, revenge:   15, kill:      12,
  escort:     10, sabotage:  8,  extraction: 8,  heist:     5,
  bounty:     5,  patrol:    3,
}

function pickWeightedType(available: QuestType[]): QuestType {
  const total = available.reduce((s, t) => s + TYPE_WEIGHTS[t], 0)
  let r = Math.random() * total
  for (const t of available) {
    r -= TYPE_WEIGHTS[t]
    if (r <= 0) return t
  }
  return available[available.length - 1]
}

export function generateQuest(gs: GameState): Quest | null {
  const accessible = getAccessibleStations(gs.currentStation)
    .filter(s => s.name !== gs.currentStation)
  if (accessible.length === 0) return null

  const usedCombos = new Set(gs.activeQuests.map(q => `${q.type}:${q.targetStation}`))

  const candidates = accessible.filter(s =>
    ALL_TYPES.some(t => !usedCombos.has(`${t}:${s.name}`))
  )
  const pool = candidates.length > 0 ? candidates : accessible
  const target = pick(pool)

  const giver = pick(GIVER_NAMES)
  const id    = Math.random().toString(36).slice(2, 8)

  const typesForTarget = target.danger < 2 ? ALL_TYPES.filter(t => !BOSS_TRIGGER_TYPES.includes(t)) : ALL_TYPES
  const availableTypes = typesForTarget.filter(t => !usedCombos.has(`${t}:${target.name}`))
  const types = availableTypes.length > 0 ? availableTypes : typesForTarget
  const type  = pickWeightedType(types)

  const dayMult = +Math.min(2.5, 1 + (gs.day - 1) * 0.05).toFixed(2)
  const scale   = (base: number) => Math.round(base * dayMult * ECONOMY_MULT)

  switch (type) {
    case 'delivery': {
      // 20% de chance de cibler une pièce exclusive à l'Atelier — introuvable
      // en achat, doit être fabriquée. Récompense majorée en conséquence.
      const isCrafted = Math.random() < 0.20
      const item   = isCrafted ? pick(CRAFTED_DELIVERY_ITEMS) : pick(DELIVERY_ITEMS)
      const reward = isCrafted ? scale(rng(1400, 3200)) : scale(rng(600, 2200))
      const desc   = isCrafted
        ? i18n.t('craftedDeliveryDesc', { ns: 'quests', giver, item: translateGood(item), target: translateStationName(target.name) })
        : pickDesc('delivery', { item: translateGood(item), giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.delivery', { ns: 'quests', item: translateGood(item) }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, targetItem: item, creditReward: reward, repReward: isCrafted ? 15 : 10, dayMult }
    }
    case 'kill': {
      const boss   = BOSS_NAMES[target.name] ?? i18n.t('bossFallbackKill', { ns: 'quests', target: translateStationName(target.name) })
      const reward = scale(rng(1500, 5000))
      const desc   = pickDesc('kill', { boss, giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.kill', { ns: 'quests', boss }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, creditReward: reward, repReward: 25, dayMult }
    }
    case 'revenge': {
      const reward = scale(rng(900, 2800))
      const desc   = pickDesc('revenge', { giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.revenge', { ns: 'quests', target: translateStationName(target.name) }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, creditReward: reward, repReward: 18, dayMult }
    }
    case 'escort': {
      const reward = scale(rng(1400, 3500))
      const desc   = pickDesc('escort', { giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.escort', { ns: 'quests', target: translateStationName(target.name) }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, targetItem: 'Passager', creditReward: reward, repReward: 15, dayMult }
    }
    case 'sabotage': {
      const reward = scale(rng(1800, 4500))
      const desc   = pickDesc('sabotage', { giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.sabotage', { ns: 'quests', target: translateStationName(target.name) }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, creditReward: reward, repReward: -5, dayMult }
    }
    case 'heist': {
      const item   = pick(HEIST_ITEMS)
      const reward = scale(rng(2200, 5500))
      const desc   = pickDesc('heist', { item: translateGood(item), giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.heist', { ns: 'quests', item: translateGood(item) }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, targetItem: item, creditReward: reward, repReward: 5, dayMult }
    }
    case 'extraction': {
      const item   = pick(EXTRACTION_ITEMS)
      const reward = scale(rng(1100, 3200))
      const desc   = pickDesc('extraction', { item: translateGood(item), giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.extraction', { ns: 'quests', target: translateStationName(target.name) }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, targetItem: item, creditReward: reward, repReward: 12, dayMult }
    }
    case 'bounty': {
      const boss   = BOSS_NAMES[target.name] ?? i18n.t('bossFallbackBounty', { ns: 'quests', target: translateStationName(target.name) })
      const reward = scale(rng(3000, 7000))
      const desc   = pickDesc('bounty', { boss, giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.bounty', { ns: 'quests', boss }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, creditReward: reward, repReward: 35, dayMult }
    }
    case 'patrol': {
      const reward = scale(rng(500, 1800))
      const desc   = pickDesc('patrol', { giver, target: translateStationName(target.name) })
      return { id, title: i18n.t('titles.patrol', { ns: 'quests', target: translateStationName(target.name) }), giver, giverStation: gs.currentStation, type,
        description: desc, targetStation: target.name, creditReward: reward, repReward: 6, dayMult }
    }
  }
}

// ── QUÊTES ENCHAÎNÉES ────────────────────────────────────────────────────────

const CHAIN_CHANCE: Partial<Record<QuestType, number>> = {
  delivery: 0.45, escort: 0.40, extraction: 0.40, patrol: 0.35,
  kill: 0.30, revenge: 0.25, bounty: 0.25, sabotage: 0.20, heist: 0.20,
}

const CHAIN_FOLLOW: Partial<Record<QuestType, QuestType[]>> = {
  delivery:   ['delivery', 'extraction', 'escort'],
  escort:     ['delivery', 'extraction'],
  extraction: ['delivery', 'heist'],
  patrol:     ['patrol', 'bounty'],
  kill:       ['bounty', 'kill'],
  revenge:    ['kill', 'bounty'],
  bounty:     ['bounty', 'kill'],
  sabotage:   ['kill', 'sabotage'],
  heist:      ['delivery', 'heist'],
}

function chainDesc(type: QuestType, prev: Quest): string {
  return i18n.t(`chain.${type}`, { ns: 'quests', giver: prev.giver })
}

export function generateChainQuest(completed: Quest, gs: GameState): Quest | null {
  const chance = CHAIN_CHANCE[completed.type] ?? 0
  if (Math.random() > chance) return null

  const followTypes = CHAIN_FOLLOW[completed.type] ?? [completed.type]
  const newType = followTypes[Math.floor(Math.random() * followTypes.length)]

  const accessible = getAccessibleStations(gs.currentStation).filter(s => s.name !== gs.currentStation)
  if (accessible.length === 0) return null
  const targetPool = BOSS_TRIGGER_TYPES.includes(newType) ? accessible.filter(s => s.danger >= 2) : accessible
  if (targetPool.length === 0) return null
  const target = targetPool[Math.floor(Math.random() * targetPool.length)]

  const id = Math.random().toString(36).slice(2, 8)
  const dayMult = +Math.min(2.5, 1 + (gs.day - 1) * 0.05).toFixed(2)
  const scale = (base: number) => Math.round(base * dayMult * 1.25 * ECONOMY_MULT)

  const targetItem = ['delivery','extraction','heist'].includes(newType)
    ? pick(newType === 'delivery' ? DELIVERY_ITEMS : newType === 'extraction' ? EXTRACTION_ITEMS : HEIST_ITEMS)
    : undefined

  const REWARDS: Record<QuestType, [number, number]> = {
    delivery: [700, 2500], escort: [1500, 4000], extraction: [1200, 3500],
    patrol: [900, 2500], kill: [1700, 5500], revenge: [1000, 3200],
    bounty: [3200, 7500], sabotage: [2000, 5000], heist: [2500, 6000],
  }
  const [rMin, rMax] = REWARDS[newType]
  const creditReward = scale(rng(rMin, rMax))
  const repReward = Math.round((completed.repReward ?? 10) * 1.3)

  return {
    id, title: i18n.t('chain.titlePrefix', { ns: 'quests', title: completed.title }),
    giver: completed.giver, giverStation: completed.giverStation,
    type: newType, targetStation: target.name, targetItem,
    description: chainDesc(newType, completed),
    creditReward, repReward, dayMult,
  }
}

// ── COMPLICATIONS ────────────────────────────────────────────────────────────

export type QuestComplication =
  | { type: 'normal' }
  | { type: 'bad_faith';   quest: Quest }
  | { type: 'intercepted'; quest: Quest }
  | { type: 'customs';     quest: Quest }
  | { type: 'client_dead'; quest: Quest }
  | { type: 'ambush';      quest: Quest }

export function checkDeliveryComplication(quest: Quest): QuestComplication {
  if (Math.random() >= 0.28) return { type: 'normal' }
  const roll = Math.floor(Math.random() * 5)
  switch (roll) {
    case 0: return { type: 'bad_faith',   quest }
    case 1: return { type: 'intercepted', quest }
    case 2: return { type: 'customs',     quest }
    case 3: return { type: 'client_dead', quest }
    default: return { type: 'ambush',     quest }
  }
}

// ── COMPLÉTION ────────────────────────────────────────────────────────────────

export function checkQuestsOnArrival(gs: GameState): { completed: Quest[]; complications: QuestComplication[] } {
  const completed: Quest[] = []
  const complications: QuestComplication[] = []
  // Copie locale du cargo décrémentée au fil de la boucle, pour éviter que
  // plusieurs quêtes réclamant le même item ne soient toutes validées avec un seul exemplaire.
  const remainingCargo = { ...gs.cargo }
  const consume = (item: string) => {
    const cur = remainingCargo[item] ?? 0
    if (cur <= 1) delete remainingCargo[item]
    else remainingCargo[item] = cur - 1
  }

  for (const q of gs.activeQuests) {
    // Quêtes qui se complètent à la station CIBLE
    if (q.targetStation === gs.currentStation) {
      if (q.type === 'escort' && (remainingCargo['Passager'] ?? 0) > 0) {
        completed.push(q)
        consume('Passager')
        // delivery et heist nécessitent une livraison manuelle depuis le hub (voir StationHub)
      } else if ((q.type === 'revenge' || q.type === 'sabotage') && gs.stationBossesBeaten.includes(q.targetStation)) {
        completed.push(q)
      } else if ((q.type === 'kill' || q.type === 'bounty') && gs.stationBossesBeaten.includes(q.targetStation)) {
        completed.push(q)
      }
    }

    // Extraction : se complète en retournant à la station du DONNEUR avec l'item
    if (q.type === 'extraction' && q.giverStation === gs.currentStation
        && q.targetItem && (remainingCargo[q.targetItem] ?? 0) > 0) {
      completed.push(q)
      consume(q.targetItem)
    }
  }

  return { completed, complications }
}

export function completeQuest(gs: GameState, quest: Quest): Partial<GameState> {
  const newCargo = { ...gs.cargo }

  if ((quest.type === 'delivery' || quest.type === 'heist' || quest.type === 'extraction') && quest.targetItem) {
    const cur = newCargo[quest.targetItem] ?? 0
    if (cur <= 1) delete newCargo[quest.targetItem]
    else newCargo[quest.targetItem] = cur - 1
  }
  if (quest.type === 'escort') {
    const cur = newCargo['Passager'] ?? 0
    if (cur <= 1) delete newCargo['Passager']
    else newCargo['Passager'] = cur - 1
  }

  const rewardMult = getRunQuestRewardMult(gs)
  const baseReward = Math.floor(quest.creditReward * rewardMult)

  const result: Partial<GameState> = {
    credits: gs.credits + baseReward,
    reputation: gs.reputation + quest.repReward,
    activeQuests: gs.activeQuests.filter(q => q.id !== quest.id),
    completedQuestIds: [...gs.completedQuestIds, quest.id],
    cargo: newCargo,
    // Rayane — libre de rejouer cette récompense à pile ou face, ou de la garder.
    ...(gs.class.name === 'Rayane' ? { rayaneGambleOffer: baseReward } : {}),
  }

  // Quête tutorielle : révèle le tracker Nexus + bonus de bienvenue
  if (quest.id === TUTORIAL_QUEST_ID) {
    result.nexusTrackerUnlocked = true
  }

  if (quest.factionId && quest.factionId === gs.faction) {
    result.factionMissions = (gs.factionMissions ?? 0) + 1
  }

  if (quest.factionId && gs.factionReputation) {
    const rivals: Record<string, string> = { faucons: 'gardiens', gardiens: 'faucons', emporium: 'culte', culte: 'emporium' }
    const fkey = quest.factionId
    const rival = rivals[fkey]
    const newRep = Math.min(100, (gs.factionReputation[fkey as keyof typeof gs.factionReputation] ?? 0) + 20)
    const newRivalRep = rival ? Math.max(-100, (gs.factionReputation[rival as keyof typeof gs.factionReputation] ?? 0) - 10) : undefined
    result.factionReputation = {
      ...gs.factionReputation,
      [fkey]: newRep,
      ...(rival && newRivalRep !== undefined ? { [rival]: newRivalRep } : {}),
    }
  }

  return result
}

// ── RUMEURS ───────────────────────────────────────────────────────────────────

// ── MISSIONS DE FACTION ──────────────────────────────────────────────────────

const FACTION_ENEMY_STATIONS: Record<string, string[]> = {
  faucons:  ['La Citadelle Écarlate', 'Fort Ossian', "L'Arsenal Écarlate", 'Fort de Cendres'],
  gardiens: ['Arc Ouest Apocalypse', 'Le Nid des Faucons', 'Station Ombre', 'La Tanière'],
  emporium: ['Port Méridien', 'Nexus Aldara', "L'Entrepôt Zéro", 'La Forge Noire'],
  culte:    ['Le Purgatoire', 'Les Abysses de Velkor', 'Station Zéphyr', 'Nexus Aldara'],
}

const FACTION_MISSION_TYPES: Record<string, QuestType[]> = {
  faucons:  ['kill', 'sabotage'],
  gardiens: ['kill', 'sabotage'],
  emporium: ['delivery', 'heist'],
  culte:    ['delivery', 'escort'],
}

const FACTION_GIVERS: Record<string, string> = {
  faucons:  'Officier Faucon',
  gardiens: 'Commandante Garde',
  emporium: 'Agent Emporium',
  culte:    'Disciple du Vide',
}

export function generateFactionMission(gs: GameState, factionId: string): Quest | null {
  const stations = FACTION_ENEMY_STATIONS[factionId]
  const types    = FACTION_MISSION_TYPES[factionId]
  if (!stations || !types) return null

  const usedTargets = new Set(
    gs.activeQuests.filter(q => q.factionId === factionId).map(q => q.targetStation)
  )
  const pool = stations.filter(s => s !== gs.currentStation && !usedTargets.has(s))
  const target = pick(pool.length > 0 ? pool : stations.filter(s => s !== gs.currentStation))
  if (!target) return null

  const type    = pick(types)
  const giver   = FACTION_GIVERS[factionId] ?? 'Officier'
  const id      = Math.random().toString(36).slice(2, 8)
  const dayMult = +Math.min(2.5, 1 + (gs.day - 1) * 0.05).toFixed(2)
  const scale   = (base: number) => Math.round(base * dayMult * ECONOMY_MULT)

  switch (type) {
    case 'kill': {
      const boss   = BOSS_NAMES[target] ?? i18n.t('bossFallbackKill', { ns: 'quests', target: translateStationName(target) })
      const reward = scale(rng(2500, 6000))
      return { id, factionId, title: i18n.t('faction.titles.kill', { ns: 'quests', boss }), giver, giverStation: gs.currentStation, type,
        description: i18n.t('faction.descs.kill', { ns: 'quests', boss, target: translateStationName(target) }),
        targetStation: target, creditReward: reward, repReward: 15, dayMult }
    }
    case 'sabotage': {
      const reward = scale(rng(2000, 5000))
      return { id, factionId, title: i18n.t('faction.titles.sabotage', { ns: 'quests', target: translateStationName(target) }), giver, giverStation: gs.currentStation, type,
        description: i18n.t('faction.descs.sabotage', { ns: 'quests', target: translateStationName(target) }),
        targetStation: target, creditReward: reward, repReward: 10, dayMult }
    }
    case 'delivery': {
      const item   = pick(DELIVERY_ITEMS)
      const reward = scale(rng(1500, 4000))
      return { id, factionId, title: i18n.t('faction.titles.delivery', { ns: 'quests', item: translateGood(item), target: translateStationName(target) }), giver, giverStation: gs.currentStation, type,
        description: i18n.t('faction.descs.delivery', { ns: 'quests', item: translateGood(item), target: translateStationName(target) }),
        targetStation: target, targetItem: item, creditReward: reward, repReward: 10, dayMult }
    }
    case 'heist': {
      const item   = pick(HEIST_ITEMS)
      const reward = scale(rng(3000, 7000))
      return { id, factionId, title: i18n.t('faction.titles.heist', { ns: 'quests', item: translateGood(item), target: translateStationName(target) }), giver, giverStation: gs.currentStation, type,
        description: i18n.t('faction.descs.heist', { ns: 'quests', item: translateGood(item), target: translateStationName(target) }),
        targetStation: target, targetItem: item, creditReward: reward, repReward: 10, dayMult }
    }
    case 'escort': {
      const reward = scale(rng(2000, 5000))
      return { id, factionId, title: i18n.t('faction.titles.escort', { ns: 'quests', target: translateStationName(target) }), giver, giverStation: gs.currentStation, type,
        description: i18n.t('faction.descs.escort', { ns: 'quests', target: translateStationName(target) }),
        targetStation: target, targetItem: 'Passager', creditReward: reward, repReward: 12, dayMult }
    }
    default: return null
  }
}

// ── QUÊTES PNJ ───────────────────────────────────────────────────────────────

const NPC_QUEST_PROFILES: Record<string, { types: QuestType[]; items?: string[]; creditMult?: number; repMult?: number }> = {
  'Ferrailleur': { types: ['delivery','extraction'], items: ['Pièces techniques','Composants électroniques','Métaux bruts'], creditMult: 1.0 },
  'Marchande':   { types: ['delivery','escort'], items: ['Médicaments','Vivres','Composants électroniques'], creditMult: 1.0 },
  'Vétéran':     { types: ['revenge','bounty'], creditMult: 1.3, repMult: 1.5 },
  'Hackeuse':    { types: ['heist','sabotage'], items: ['Données classifiées','Logiciels'], creditMult: 1.4 },
  'Dealer':      { types: ['delivery','escort'], items: ['Pièces de contrebande','Drogues de synthèse'], creditMult: 1.2 },
  'Lieutenant':  { types: ['sabotage','bounty'], creditMult: 1.5, repMult: 0.8 },
  'Survivante':  { types: ['patrol','extraction'], items: ['Artefacts','Données'], creditMult: 0.9, repMult: 1.4 },
  'Courtier':    { types: ['delivery','heist'], items: ['Renseignements','Artefacts','Or'], creditMult: 1.3 },
  'Organisateur':{ types: ['delivery','patrol'], creditMult: 1.1 },
  'Commandante': { types: ['bounty','sabotage'], creditMult: 1.4, repMult: 1.3 },
  'Chercheuse':  { types: ['heist','extraction'], items: ['Artefacts','Composants expérimentaux','Données classifiées'], creditMult: 1.2, repMult: 1.2 },
  'Pilote retraité': { types: ['patrol','escort'], creditMult: 0.9, repMult: 1.1 },
  'Forgeron':    { types: ['extraction','delivery'], items: ['Métaux rares','Cristaux énergétiques',"Composants d'armure"], creditMult: 1.0 },
  'Fermier':     { types: ['delivery','patrol'], items: ['Nourriture fraîche','Eau purifiée','Équipement agricole'], creditMult: 0.8, repMult: 1.3 },
  'Recruteur':   { types: ['sabotage','bounty'], creditMult: 1.4, repMult: 0.7 },
  'Officière':   { types: ['revenge','bounty'], creditMult: 1.2, repMult: 1.1 },
  'Gardien':     { types: ['extraction','heist'], items: ['Marchandises volées','Données','Artefacts'], creditMult: 1.3 },
  'Conseiller':  { types: ['bounty','kill'], creditMult: 1.6, repMult: 1.0 },
}

export function generateNpcQuest(gs: GameState, npcName: string, npcRole: string, npcStation: string): Quest | null {
  const accessible = getAccessibleStations(npcStation).filter(s => s.name !== npcStation)
  if (accessible.length === 0) return null
  const target = accessible[Math.floor(Math.random() * accessible.length)]
  const profile = NPC_QUEST_PROFILES[npcRole]
  if (!profile) return null

  const type = profile.types[Math.floor(Math.random() * profile.types.length)]
  const item  = profile.items ? profile.items[Math.floor(Math.random() * profile.items.length)] : undefined
  const creditBase = Math.round(rng(1200, 3500) * ECONOMY_MULT)
  const creditReward = Math.floor(creditBase * (profile.creditMult ?? 1.0))
  const repReward = Math.floor(rng(8, 20) * (profile.repMult ?? 1.0))
  const id = Math.random().toString(36).slice(2, 8)

  const flavor = i18n.t(`npcQuest.flavors.${npcRole}`, { ns: 'quests' })
  const itemOrPackage = item ? translateGood(item) : i18n.t('npcQuest.itemFallbackPackage', { ns: 'quests' })
  const itemOrThing    = item ? translateGood(item) : i18n.t('npcQuest.itemFallbackThing', { ns: 'quests' })
  const itemOrObject   = item ? translateGood(item) : i18n.t('npcQuest.itemFallbackObject', { ns: 'quests' })
  const itemByType: Partial<Record<QuestType, string>> = {
    delivery: itemOrPackage, extraction: itemOrThing, heist: itemOrObject,
  }

  const description = i18n.t(`npcQuest.descs.${type}`, {
    ns: 'quests', npcName, flavor, target: translateStationName(target.name), item: itemByType[type] ?? (item ? translateGood(item) : ''),
  })

  return {
    id, giver: npcName, giverStation: npcStation, type,
    title: i18n.t('npcQuest.titleTemplate', { ns: 'quests', npcName, type: type.toUpperCase() }),
    description,
    targetStation: target.name,
    targetItem: (type === 'delivery' || type === 'extraction' || type === 'heist') ? item : undefined,
    creditReward, repReward,
  }
}

export function getGossip(station: string): string {
  const key = i18n.exists(`gossip.${station}`, { ns: 'quests' }) ? station : 'default'
  const lines = i18n.t(`gossip.${key}`, { ns: 'quests', returnObjects: true }) as string[]
  return lines[Math.floor(Math.random() * lines.length)]
}
