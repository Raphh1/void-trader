import type { SubBossData, Enemy, GameState } from '../types'
import { getStation } from './stations'
import i18n from '../i18n/config'
import { translateStationName } from '../engine/goodsI18n'

const sb = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'subBosses', ...params })

function makeEnemy(name: string, hp: number, dMin: number, dMax: number, lootMin: number, lootMax: number, desc: string, role: Enemy['role'] = 'normal'): Enemy {
  return { name, maxHp: hp, damageMin: dMin, damageMax: dMax, lootMin, lootMax, description: desc, captureChance: 5, killChance: 15, isBoss: true, role, isSubBoss: true }
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── ALANOSSA — Faucons Noirs ────────────────────────────────────────────────
function getAlanossaSubs(): SubBossData[] {
  return [
  {
    id: 'ala-1',
    name: 'Le Vigie Immortel',
    pillar: 'alanossa',
    station: 'Le Perchoir',
    order: 1,
    personality: sb('ala1.personality'),
    motivation: sb('ala1.motivation'),
    backstory: sb('ala1.backstory'),
    combatMechanic: sb('ala1.combatMechanic'),
    specialAbility: sb('ala1.specialAbility'),
    reward: { type: 'weapon', value: 'Lunette du Vigie' },
    resolutions: ['kill', 'manipulate', 'sabotage', 'bribe', 'service'],
    bribe: { credits: 9000 },
    service: { demand: sb('ala1.serviceDemand'), requirements: [
      { type: 'item', name: 'Composants électroniques', qty: 4 },
      { type: 'visitStation', station: 'Station Ombre' },
    ] },
    enemy: makeEnemy('Le Vigie Immortel', 160, 18, 35, 2000, 4500, sb('ala1.enemyDesc'), 'ranged'),
  },
  {
    id: 'ala-2',
    name: "Le Ravitailleur de l'Ombre",
    pillar: 'alanossa',
    station: 'Relais Noir',
    order: 2,
    personality: sb('ala2.personality'),
    motivation: sb('ala2.motivation'),
    backstory: sb('ala2.backstory'),
    combatMechanic: sb('ala2.combatMechanic'),
    specialAbility: sb('ala2.specialAbility'),
    reward: { type: 'item', value: 'Carte des routes Faucon' },
    resolutions: ['kill', 'ally', 'betray', 'bribe', 'service'],
    bribe: { credits: 12000 },
    service: { demand: sb('ala2.serviceDemand'), requirements: [
      { type: 'item', name: 'Rations militaires', qty: 5 },
      { type: 'item', name: 'Carburant de récup', qty: 3 },
    ] },
    enemy: makeEnemy("Le Ravitailleur de l'Ombre", 200, 20, 38, 2500, 5500, sb('ala2.enemyDesc'), 'normal'),
  },
  {
    id: 'ala-3',
    name: 'Le Fantôme des Ombres',
    pillar: 'alanossa',
    station: 'Station Ombre',
    order: 3,
    personality: sb('ala3.personality'),
    motivation: sb('ala3.motivation'),
    backstory: sb('ala3.backstory'),
    combatMechanic: sb('ala3.combatMechanic'),
    specialAbility: sb('ala3.specialAbility'),
    reward: { type: 'armor', value: 'Cape des Ombres' },
    resolutions: ['kill', 'manipulate', 'sabotage', 'bribe', 'service'],
    bribe: { credits: 21000 },
    service: { demand: sb('ala3.serviceDemand'), requirements: [
      { type: 'combatsWon', min: 12 },
      { type: 'item', name: 'Fausses identités', qty: 2 },
    ] },
    // Invisible un tour sur deux : la moitié des coups est annulée, et il
    // contre-attaque en plus. Avec le plafond de base, le cumul rend le combat
    // ingagnable même en équipement maximal — on le relève donc fortement.
    enemy: { ...makeEnemy('Le Fantôme des Ombres', 180, 28, 52, 3000, 6500, sb('ala3.enemyDesc'), 'ranged'), damageCapPct: 0.45 },
  },
  {
    id: 'ala-4',
    name: 'La Faucon',
    pillar: 'alanossa',
    station: 'Le Nid des Faucons',
    order: 4,
    personality: sb('ala4.personality'),
    motivation: sb('ala4.motivation'),
    backstory: sb('ala4.backstory'),
    combatMechanic: sb('ala4.combatMechanic'),
    specialAbility: sb('ala4.specialAbility'),
    reward: { type: 'weapon', value: 'Lame de la Faucon' },
    resolutions: ['kill', 'ally', 'betray', 'bribe', 'service'],
    bribe: { credits: 34000 },
    service: { demand: sb('ala4.serviceDemand'), requirements: [
      { type: 'factionReputation', faction: 'faucons', min: 45 },
      { type: 'subBoss', subBossId: 'ala-3' },
    ] },
    enemy: makeEnemy('La Faucon', 250, 28, 52, 3500, 7000, sb('ala4.enemyDesc'), 'normal'),
  },
  ]
}

// ── CESARION — Emporium ────────────────────────────────────────────────────
function getCesarionSubs(): SubBossData[] {
  return [
  {
    id: 'ces-1',
    name: 'La Marchande de Mort',
    pillar: 'cesarion',
    station: 'Comptoir Sud',
    order: 1,
    personality: sb('ces1.personality'),
    motivation: sb('ces1.motivation'),
    backstory: sb('ces1.backstory'),
    combatMechanic: sb('ces1.combatMechanic'),
    specialAbility: sb('ces1.specialAbility'),
    reward: { type: 'weapon', value: 'Dague empoisonnée de Morte' },
    resolutions: ['kill', 'manipulate', 'ally', 'bribe', 'service'],
    bribe: { credits: 11000 },
    service: { demand: sb('ces1.serviceDemand'), requirements: [
      { type: 'item', name: 'Munitions spéciales', qty: 4 },
      { type: 'credits', amount: 6000 },
    ] },
    enemy: makeEnemy('La Marchande de Mort', 155, 18, 36, 2200, 5000, sb('ces1.enemyDesc'), 'ranged'),
  },
  {
    id: 'ces-2',
    name: 'Le Passeur Sanguinaire',
    pillar: 'cesarion',
    station: 'Relais de Transit',
    order: 2,
    personality: sb('ces2.personality'),
    motivation: sb('ces2.motivation'),
    backstory: sb('ces2.backstory'),
    combatMechanic: sb('ces2.combatMechanic'),
    specialAbility: sb('ces2.specialAbility'),
    reward: { type: 'credits', value: 5000 },
    resolutions: ['kill', 'manipulate', 'betray', 'bribe', 'service'],
    bribe: { credits: 15000 },
    service: { demand: sb('ces2.serviceDemand'), requirements: [
      { type: 'visitStation', station: 'Relais de Transit' },
      { type: 'item', name: 'Marchandises volées', qty: 3 },
    ] },
    enemy: makeEnemy('Le Passeur Sanguinaire', 190, 22, 42, 3000, 6000, sb('ces2.enemyDesc'), 'normal'),
  },
  {
    id: 'ces-3',
    name: "L'Archiviste sans Visage",
    pillar: 'cesarion',
    station: "L'Entrepôt Zéro",
    order: 3,
    personality: sb('ces3.personality'),
    motivation: sb('ces3.motivation'),
    backstory: sb('ces3.backstory'),
    combatMechanic: sb('ces3.combatMechanic'),
    specialAbility: sb('ces3.specialAbility'),
    reward: { type: 'item', value: 'Dossier Cesarion' },
    resolutions: ['kill', 'manipulate', 'sabotage', 'bribe', 'service'],
    bribe: { credits: 24000 },
    service: { demand: sb('ces3.serviceDemand'), requirements: [
      { type: 'item', name: 'Données classifiées', qty: 4 },
      { type: 'questsCompleted', min: 6 },
    ] },
    enemy: makeEnemy("L'Archiviste sans Visage", 175, 26, 48, 3500, 7000, sb('ces3.enemyDesc'), 'ranged'),
  },
  {
    id: 'ces-4',
    name: 'Le Directeur Fantôme',
    pillar: 'cesarion',
    station: 'Annexe Commerciale',
    order: 4,
    personality: sb('ces4.personality'),
    motivation: sb('ces4.motivation'),
    backstory: sb('ces4.backstory'),
    combatMechanic: sb('ces4.combatMechanic'),
    specialAbility: sb('ces4.specialAbility'),
    reward: { type: 'armor', value: 'Uniforme Diplomatique' },
    resolutions: ['kill', 'ally', 'betray', 'manipulate', 'bribe', 'service'],
    bribe: { credits: 40000 },
    service: { demand: sb('ces4.serviceDemand'), requirements: [
      { type: 'factionReputation', faction: 'emporium', min: 50 },
      { type: 'credits', amount: 20000 },
      { type: 'subBoss', subBossId: 'ces-3' },
    ] },
    enemy: makeEnemy('Le Directeur Fantôme', 220, 24, 46, 4000, 8000, sb('ces4.enemyDesc'), 'support'),
  },
  ]
}

// ── RAPHAZARUS — Vétérans de la Grande Guerre / L'Arc Perdu ─────────────────
function getRaphazarusSubs(): SubBossData[] {
  return [
  {
    id: 'raph-1',
    name: 'Le Sergent Cendré',
    pillar: 'raphazarus',
    station: 'Les Cendres',
    order: 1,
    personality: sb('raph1.personality'),
    motivation: sb('raph1.motivation'),
    backstory: sb('raph1.backstory'),
    combatMechanic: sb('raph1.combatMechanic'),
    specialAbility: sb('raph1.specialAbility'),
    reward: { type: 'item', value: 'Plaque d\'identification 3e Bataillon' },
    resolutions: ['kill', 'manipulate', 'sabotage', 'bribe', 'service'],
    bribe: { credits: 8000 },
    service: { demand: sb('raph1.serviceDemand'), requirements: [
      { type: 'visitStation', station: 'Les Cendres' },
      { type: 'item', name: 'Médicaments', qty: 4 },
    ] },
    enemy: makeEnemy('Le Sergent Cendré', 170, 20, 38, 2200, 5000, sb('raph1.enemyDesc'), 'normal'),
  },
  {
    id: 'raph-2',
    name: 'La Veuve de Fer',
    pillar: 'raphazarus',
    station: 'La Forteresse Exilée',
    order: 2,
    personality: sb('raph2.personality'),
    motivation: sb('raph2.motivation'),
    backstory: sb('raph2.backstory'),
    combatMechanic: sb('raph2.combatMechanic'),
    specialAbility: sb('raph2.specialAbility'),
    reward: { type: 'armor', value: 'Armure de la Veuve' },
    resolutions: ['kill', 'manipulate', 'betray', 'bribe', 'service'],
    bribe: { credits: 16000 },
    service: { demand: sb('raph2.serviceDemand'), requirements: [
      { type: 'item', name: 'Composants d\'armure', qty: 3 },
      { type: 'reputation', min: 45 },
    ] },
    enemy: makeEnemy('La Veuve de Fer', 210, 24, 45, 3000, 6500, sb('raph2.enemyDesc'), 'tank'),
  },
  {
    id: 'raph-3',
    name: 'Le Spectre du 7e',
    pillar: 'raphazarus',
    station: 'Station Fantôme',
    order: 3,
    personality: sb('raph3.personality'),
    motivation: sb('raph3.motivation'),
    backstory: sb('raph3.backstory'),
    combatMechanic: sb('raph3.combatMechanic'),
    specialAbility: sb('raph3.specialAbility'),
    reward: { type: 'weapon', value: 'Lame Fantôme du 7e' },
    resolutions: ['kill', 'manipulate', 'sabotage', 'bribe', 'service'],
    bribe: { credits: 23000 },
    service: { demand: sb('raph3.serviceDemand'), requirements: [
      { type: 'visitStation', station: 'Station Fantôme' },
      { type: 'combatsWon', min: 15 },
    ] },
    // Phase spectrale un tour sur deux : même logique que Le Fantôme, en moins
    // sévère puisqu'il ne contre-attaque pas.
    enemy: { ...makeEnemy('Le Spectre du 7e', 230, 30, 55, 4000, 8000, sb('raph3.enemyDesc'), 'ranged'), damageCapPct: 0.28 },
  },
  {
    id: 'raph-4',
    name: 'Le Maréchal Osseux',
    pillar: 'raphazarus',
    station: 'La Forge des Damnés',
    order: 4,
    personality: sb('raph4.personality'),
    motivation: sb('raph4.motivation'),
    backstory: sb('raph4.backstory'),
    combatMechanic: sb('raph4.combatMechanic'),
    specialAbility: sb('raph4.specialAbility'),
    reward: { type: 'weapon', value: 'Le Poing du Maréchal' },
    resolutions: ['kill', 'ally', 'bribe', 'service'],
    bribe: { credits: 38000 },
    service: { demand: sb('raph4.serviceDemand'), requirements: [
      { type: 'pillarStanding', pillar: 'raphazarus', min: 35 },
      { type: 'item', name: 'Armes artisanales', qty: 3 },
      { type: 'day', min: 25 },
    ] },
    enemy: makeEnemy('Le Maréchal Osseux', 280, 30, 58, 5000, 10000, sb('raph4.enemyDesc'), 'tank'),
  },
  ]
}

// ── SAMY SCOTTY — Luxe / Criminel / Casino ─────────────────────────────────
function getScottySubs(): SubBossData[] {
  return [
  {
    id: 'sco-1',
    name: 'Le Roi de Nuit',
    pillar: 'scotty',
    station: 'Port de Nuit',
    order: 1,
    personality: sb('sco1.personality'),
    motivation: sb('sco1.motivation'),
    backstory: sb('sco1.backstory'),
    combatMechanic: sb('sco1.combatMechanic'),
    specialAbility: sb('sco1.specialAbility'),
    reward: { type: 'weapon', value: 'Dague de la Nuit' },
    resolutions: ['kill', 'manipulate', 'betray', 'bribe', 'service'],
    bribe: { credits: 10000 },
    service: { demand: sb('sco1.serviceDemand'), requirements: [
      { type: 'item', name: 'Jetons de casino', qty: 6 },
      { type: 'visitStation', station: 'Port de Nuit' },
    ] },
    enemy: makeEnemy('Le Roi de Nuit', 175, 20, 40, 2500, 5500, sb('sco1.enemyDesc'), 'normal'),
  },
  {
    id: 'sco-2',
    name: 'Le Maître des Ombres',
    pillar: 'scotty',
    station: "Club Privé Éos",
    order: 2,
    personality: sb('sco2.personality'),
    motivation: sb('sco2.motivation'),
    backstory: sb('sco2.backstory'),
    combatMechanic: sb('sco2.combatMechanic'),
    specialAbility: sb('sco2.specialAbility'),
    reward: { type: 'item', value: 'Carnet de Chantage' },
    resolutions: ['kill', 'manipulate', 'ally', 'betray', 'bribe', 'service'],
    bribe: { credits: 18000 },
    service: { demand: sb('sco2.serviceDemand'), requirements: [
      { type: 'item', name: 'Informations VIP', qty: 3 },
      { type: 'reputation', min: 50 },
    ] },
    enemy: makeEnemy('Le Maître des Ombres', 195, 24, 45, 3000, 6500, sb('sco2.enemyDesc'), 'ranged'),
  },
  {
    id: 'sco-3',
    name: 'Oracle de la Singularité',
    pillar: 'scotty',
    station: "La Couronne d'Eos",
    order: 3,
    personality: sb('sco3.personality'),
    motivation: sb('sco3.motivation'),
    backstory: sb('sco3.backstory'),
    combatMechanic: sb('sco3.combatMechanic'),
    specialAbility: sb('sco3.specialAbility'),
    reward: { type: 'armor', value: 'Armure Prédictive' },
    resolutions: ['kill', 'manipulate', 'sabotage', 'bribe', 'service'],
    bribe: { credits: 26000 },
    service: { demand: sb('sco3.serviceDemand'), requirements: [
      { type: 'item', name: 'Composants expérimentaux', qty: 4 },
      { type: 'item', name: 'Cristaux énergétiques', qty: 3 },
    ] },
    enemy: makeEnemy('Oracle de la Singularité', 210, 30, 55, 4000, 8000, sb('sco3.enemyDesc'), 'ranged'),
  },
  {
    id: 'sco-4',
    name: 'Directeur Pale',
    pillar: 'scotty',
    station: 'Les Abysses de Velkor',
    order: 4,
    personality: sb('sco4.personality'),
    motivation: sb('sco4.motivation'),
    backstory: sb('sco4.backstory'),
    combatMechanic: sb('sco4.combatMechanic'),
    specialAbility: sb('sco4.specialAbility'),
    reward: { type: 'weapon', value: 'Scalpel de Velkor' },
    resolutions: ['kill', 'manipulate', 'bribe', 'service'],
    bribe: { credits: 42000 },
    service: { demand: sb('sco4.serviceDemand'), requirements: [
      { type: 'pillarStanding', pillar: 'scotty', min: 40 },
      { type: 'credits', amount: 25000 },
      { type: 'subBoss', subBossId: 'sco-3' },
    ] },
    enemy: makeEnemy('Directeur Pale', 260, 25, 50, 5000, 10000, sb('sco4.enemyDesc'), 'normal'),
  },
  ]
}

function getSubBosses(): SubBossData[] {
  return [
    ...getAlanossaSubs(),
    ...getCesarionSubs(),
    ...getRaphazarusSubs(),
    ...getScottySubs(),
  ]
}

// ── MINI-JEU DE COUP CIBLÉ (obligatoire à chaque coup contre un sous-boss) ───
// 4 types selon le profil du lieutenant :
//   hack  — tech/info/réseau (HackSequence — mémoire séquentielle)
//   draw  — furtif/précision (QuickDraw — cibles surgissantes)
//   react — militaire/agressif (ReactFlash — mémoriser la couleur)
//   stop  — tank/méthodique (StopTheBar — arrêter la barre)
const HACK_SUBBOSSES = new Set([
  "Le Ravitailleur de l'Ombre",   // drones logistiques
  "L'Archiviste sans Visage",     // analyse tactique
  'Le Directeur Fantôme',         // directive réseau
  'Le Maître des Ombres',         // espion info-broker
  'Oracle de la Singularité',     // prédiction algorithmique
])
const DRAW_SUBBOSSES = new Set([
  'Le Fantôme des Ombres',        // invisibilité / frappe fantôme
  'Le Spectre du 7e',             // phase spectrale / renseignement
  'Le Roi de Nuit',               // combat dans l\'obscurité
  'Directeur Pale',               // calme absolu / précision clinique
])
const REACT_SUBBOSSES = new Set([
  'Le Vigie Immortel',            // tir préventif / réaction instantanée
  'La Faucon',                    // stances changeantes / adaptation
  'Le Sergent Cendré',            // cadence militaire / double attaque
  'Le Passeur Sanguinaire',       // agressif / combat contre la montre
])
// Tout le reste → StopTheBar (Marchande de Mort, Veuve de Fer, Maréchal Osseux)

// Difficulté croissante selon l'ordre du sous-boss dans son pilier (1→4).
const ORDER_DIFFICULTY: Record<number, 1 | 2 | 3> = { 1: 1, 2: 2, 3: 2, 4: 3 }

export type SubBossMinigameKind = 'stop' | 'hack' | 'draw' | 'react'

export function getSubBossMinigame(enemyName: string): { kind: SubBossMinigameKind; difficulty: 1 | 2 | 3 } | null {
  const sb = getSubBosses().find(s => s.name === enemyName)
  if (!sb) return null
  const kind: SubBossMinigameKind =
    HACK_SUBBOSSES.has(enemyName)  ? 'hack'  :
    DRAW_SUBBOSSES.has(enemyName)  ? 'draw'  :
    REACT_SUBBOSSES.has(enemyName) ? 'react' : 'stop'
  return { kind, difficulty: ORDER_DIFFICULTY[sb.order] ?? 2 }
}

// ── STATIONS DES LIEUTENANTS — mélangées par run ─────────────────────────────
// Les 4 lieutenants d'un même pilier gardent les 4 stations habituelles de ce
// pilier, mais laquelle appartient à qui change à chaque run : impossible de
// mémoriser "le lieutenant 2 d'Alanossa est toujours au Perchoir" d'une partie
// à l'autre. Le mélange reste à l'intérieur du territoire du pilier — on ne
// mélange pas entre piliers, pour ne pas percuter le reste du contenu propre
// à chaque station (contrôle de faction, quêtes d'équipement, etc.).
export function generateLieutenantStationAssignment(): Record<string, string> {
  const assignment: Record<string, string> = {}
  const pillars = [...new Set(getSubBosses().map(sb => sb.pillar))]
  for (const pillar of pillars) {
    const subs = getSubBossesForPillar(pillar)
    const shuffledStations = shuffle(subs.map(sb => sb.station))
    subs.forEach((sb, i) => { assignment[sb.id] = shuffledStations[i] })
  }
  return assignment
}

export function getSubBossStation(gs: GameState, sb: SubBossData): string {
  return gs.lieutenantStationAssignment?.[sb.id] ?? sb.station
}

export function getSubBossesForPillar(pillar: string, gs?: GameState): SubBossData[] {
  const subs = getSubBosses().filter(sb => sb.pillar === pillar).sort((a, b) => a.order - b.order)
  if (!gs) return subs
  return subs.map(sb => ({ ...sb, station: getSubBossStation(gs, sb) }))
}

export function getSubBossAtStation(gs: GameState, station: string): SubBossData | undefined {
  const sb = getSubBosses().find(s => getSubBossStation(gs, s) === station)
  return sb ? { ...sb, station: getSubBossStation(gs, sb) } : undefined
}

export function isSubBossDefeated(defeated: Record<string, string[]>, subBossId: string): boolean {
  return Object.values(defeated).some(ids => ids.includes(subBossId))
}

export function arePillarSubBossesCleared(defeated: Record<string, string[]>, pillar: string): boolean {
  const subs = getSubBossesForPillar(pillar)
  const pillarDefeated = defeated[pillar] ?? []
  return subs.every(sb => pillarDefeated.includes(sb.id))
}

// ── INDICES DE LOCALISATION DES LIEUTENANTS ──────────────────────────────────
// Après plusieurs quêtes complétées, un informateur croisé en exploration
// donne un indice sur où trouver le prochain lieutenant à affronter. Le
// premier indice réutilise la description propre de la station cible —
// assez concrète pour qu'un joueur attentif la reconnaisse immédiatement,
// sans jamais nommer la station. Le second indice, s'il n'a pas encore été
// trouvé, la révèle explicitement.
const CLUE_PILLARS = ['alanossa', 'cesarion', 'raphazarus', 'scotty']
export const LIEUTENANT_CLUE_QUEST_INTERVAL = 5
export const LIEUTENANT_CLUE_REVEAL_LEVEL = 2

function getInformantLines(): string[] {
  return i18n.t('informantLines', { ns: 'subBosses', returnObjects: true }) as string[]
}

// Le prochain lieutenant "actif" d'un pilier : le premier non vaincu, dans l'ordre.
export function getNextLieutenant(defeated: Record<string, string[]>, pillar: string): SubBossData | undefined {
  return getSubBossesForPillar(pillar).find(sb => !(defeated[pillar] ?? []).includes(sb.id))
}

// Choisit, parmi tous les piliers actifs, un lieutenant "prochain" dont la
// position n'est pas encore connue — cible pour un nouvel indice.
export function pickLieutenantForClue(defeated: Record<string, string[]>, locationsKnown: string[]): SubBossData | undefined {
  const candidates = CLUE_PILLARS
    .map(p => getNextLieutenant(defeated, p))
    .filter((sb): sb is SubBossData => !!sb && !locationsKnown.includes(sb.id))
  if (candidates.length === 0) return undefined
  return pick(candidates)
}

export function getLieutenantClueText(gs: GameState, sb: SubBossData, level: number): string {
  const resolvedStation = getSubBossStation(gs, sb)
  if (level < LIEUTENANT_CLUE_REVEAL_LEVEL) {
    return getStation(resolvedStation).description
  }
  return i18n.t('clueLocationText', { ns: 'subBosses', name: sb.name, station: translateStationName(resolvedStation) })
}

export interface LieutenantClueEvent {
  subBoss: SubBossData
  level: number
  npcLine: string
  clueText: string
}

// Détermine si l'exploration en cours doit déclencher un indice de lieutenant.
// Se base sur des paliers de quêtes complétées (tous les 5) pour rester
// prévisible plutôt que purement aléatoire.
export function rollLieutenantClueEvent(gs: GameState): { event: LieutenantClueEvent | null; newMilestone: number | null } {
  const completed = gs.completedQuestIds.length
  const milestone = gs.lieutenantClueMilestone ?? 0
  if (completed < milestone + LIEUTENANT_CLUE_QUEST_INTERVAL) return { event: null, newMilestone: null }

  const newMilestone = Math.floor(completed / LIEUTENANT_CLUE_QUEST_INTERVAL) * LIEUTENANT_CLUE_QUEST_INTERVAL
  const defeated = gs.subBossesDefeated ?? {}
  const locationsKnown = gs.lieutenantLocationsKnown ?? []
  const sb = pickLieutenantForClue(defeated, locationsKnown)
  if (!sb) return { event: null, newMilestone }

  const currentLevel = (gs.lieutenantClueLevels ?? {})[sb.id] ?? 0
  const nextLevel = currentLevel + 1
  return {
    event: { subBoss: sb, level: nextLevel, npcLine: pick(getInformantLines()), clueText: getLieutenantClueText(gs, sb, nextLevel) },
    newMilestone,
  }
}

export function getNextSubBoss(defeated: Record<string, string[]>, pillar: string): SubBossData | undefined {
  const subs = getSubBossesForPillar(pillar)
  const pillarDefeated = defeated[pillar] ?? []
  return subs.find(sb => !pillarDefeated.includes(sb.id))
}

export function getSubBossProgress(defeated: Record<string, string[]>, pillar: string): { done: number; total: number } {
  const subs = getSubBossesForPillar(pillar)
  const pillarDefeated = defeated[pillar] ?? []
  return { done: subs.filter(sb => pillarDefeated.includes(sb.id)).length, total: subs.length }
}
