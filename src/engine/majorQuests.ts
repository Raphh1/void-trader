import type { GameState, MajorQuest, MajorQuestCondition, MajorQuestStage } from '../types'
import i18n from '../i18n/config'

const mq = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'majorQuests', ...params })

// ── VÉRIFICATION DE CONDITION ─────────────────────────────────────────────────

export function checkCondition(gs: GameState, cond: MajorQuestCondition): boolean {
  switch (cond.type) {
    case 'visitStation':  return gs.visitedStations.includes(cond.station)
    case 'visitStations': return gs.visitedStations.length >= cond.count
    case 'winCombatAt':   return gs.stationBossesBeaten.includes(cond.station)
    case 'meetNpc':       return gs.npcsMet.includes(cond.npcName)
    case 'hasFaction':    return gs.faction === cond.faction
    case 'hasReputation': return gs.reputation >= cond.min
    case 'hasCargo':      return (gs.cargo[cond.item] ?? 0) > 0
    case 'hasTag':        return gs.moralTags.includes(cond.tag)
    case 'bossKill':      return gs.stationBossesBeaten.some(s => {
      const BOSS_STATIONS: Record<string, string> = {
        'Arc Ouest Apocalypse': 'Alanossa', 'Le Nid des Faucons': 'La Faucon',
        'Station Ombre': 'Le Fantôme des Ombres', 'La Tanière': 'La Bête Noire',
        'Repaire Vega-Sud': 'La Veuve de Vega', 'La Forteresse Exilée': "L'Exilé Écarlate",
        'Station Quarantaine': 'Patient Zéro', 'Station Fantôme': "L'Ombre du Vide",
        'Port de Nuit': 'Le Roi de Nuit',
      }
      return BOSS_STATIONS[s] === cond.bossName
    })
  }
}

// ── AVANCEMENT D'ÉTAPE ────────────────────────────────────────────────────────

export function checkMajorQuestAdvancement(gs: GameState): { newGs: Partial<GameState>; messages: string[] } {
  const messages: string[] = []
  let majorQuests = [...gs.majorQuests]
  let credits = gs.credits
  let reputation = gs.reputation

  for (let qi = 0; qi < majorQuests.length; qi++) {
    const q = majorQuests[qi]
    if (q.completed || q.failed) continue
    const stage = q.stages[q.currentStage]
    if (!stage) continue

    if (checkCondition(gs, stage.condition)) {
      const reward = stage.reward
      if (reward?.credits) credits += reward.credits
      if (reward?.rep) reputation += reward.rep

      const nextStage = q.currentStage + 1
      const isComplete = nextStage >= q.stages.length

      majorQuests[qi] = { ...q, currentStage: nextStage, completed: isComplete }

      if (isComplete) {
        messages.push(mq('advancement.completed', { title: localizeMajorQuest(q).title }))
      } else {
        const loc = localizeMajorQuest(q)
        const nextStageDef = loc.stages[nextStage]
        messages.push(mq('advancement.stageProgress', { title: loc.title, current: nextStage, total: q.stages.length, stageTitle: nextStageDef?.title ?? '' }))
        if (reward?.message) messages.push(loc.stages[q.currentStage]?.reward?.message ?? reward.message)
      }
    }
  }

  return { newGs: { majorQuests, credits, reputation }, messages }
}

// ── TEXTES DANS LA LANGUE COURANTE ────────────────────────────────────────────
// Une quête sauvegardée garde les textes de la langue active au moment où elle a
// été acceptée : on les réhydrate depuis les définitions, par id.

export function localizeMajorQuest(q: MajorQuest): MajorQuest {
  const def = getMajorQuestsList().find(d => d.id === q.id)
  if (!def) return q
  return {
    ...q,
    title: def.title,
    lore: def.lore,
    stages: q.stages.map(s => {
      const ds = def.stages.find(x => x.id === s.id)
      if (!ds) return s
      return {
        ...s, title: ds.title, description: ds.description, objective: ds.objective,
        reward: s.reward && { ...s.reward, message: ds.reward?.message ?? s.reward.message },
      }
    }),
  }
}

// ── CANACCÉDER À LA QUÊTE ─────────────────────────────────────────────────────

export function canStartMajorQuest(gs: GameState, quest: MajorQuest): boolean {
  if (gs.majorQuests.some(q => q.id === quest.id)) return false
  if (quest.requiresFaction && gs.faction !== quest.requiresFaction) return false
  if (quest.requiresReputation && gs.reputation < quest.requiresReputation) return false
  if (quest.requiresNpcMet && !gs.npcsMet.includes(quest.requiresNpcMet)) return false
  return true
}

// ── DÉFINITIONS DES QUÊTES MAJEURES ──────────────────────────────────────────

const stage = (id: string, title: string, description: string, objective: string,
  condition: MajorQuestCondition, reward?: MajorQuestStage['reward']): MajorQuestStage =>
  ({ id, title, description, objective, condition, reward })

function getMajorQuestsList(): MajorQuest[] {
  return [

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. LA FILIÈRE NOIRE (Boro → Faucons Noirs)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'filiere_noire',
    title: mq('filiereNoire.title'),
    giver: 'Boro',
    giverStation: 'Les Bas-Fonds de Vega',
    lore: mq('filiereNoire.lore'),
    currentStage: 0, completed: false, failed: false,
    stages: [
      stage('fn1', mq('filiereNoire.fn1.title'), mq('filiereNoire.fn1.description'), mq('filiereNoire.fn1.objective'), { type: 'visitStation', station: 'Relais Noir' }, { credits: 400, message: mq('filiereNoire.fn1.rewardMsg') }),
      stage('fn2', mq('filiereNoire.fn2.title'), mq('filiereNoire.fn2.description'), mq('filiereNoire.fn2.objective'), { type: 'meetNpc', npcName: 'Setta' }, { message: mq('filiereNoire.fn2.rewardMsg') }),
      stage('fn3', mq('filiereNoire.fn3.title'), mq('filiereNoire.fn3.description'), mq('filiereNoire.fn3.objective'), { type: 'meetNpc', npcName: 'Kross' }, { credits: 800, message: mq('filiereNoire.fn3.rewardMsg') }),
      stage('fn4', mq('filiereNoire.fn4.title'), mq('filiereNoire.fn4.description'), mq('filiereNoire.fn4.objective'), { type: 'winCombatAt', station: 'Station Ombre' }, { rep: 15, message: mq('filiereNoire.fn4.rewardMsg') }),
      stage('fn5', mq('filiereNoire.fn5.title'), mq('filiereNoire.fn5.description'), mq('filiereNoire.fn5.objective'), { type: 'visitStation', station: 'Les Bas-Fonds de Vega' }),
      stage('fn6', mq('filiereNoire.fn6.title'), mq('filiereNoire.fn6.description'), mq('filiereNoire.fn6.objective'), { type: 'hasFaction', faction: 'faucons' }, { credits: 8000, rep: 40, message: mq('filiereNoire.fn6.rewardMsg') }),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. L'HÉRITAGE DE VELKOR (Ysla → enquête archéologique)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'heritage_velkor',
    title: mq('heritageVelkor.title'),
    giver: 'Ysla',
    giverStation: 'Les Abysses de Velkor',
    lore: mq('heritageVelkor.lore'),
    currentStage: 0, completed: false, failed: false,
    requiresReputation: 20,
    stages: [
      stage('hv1', mq('heritageVelkor.hv1.title'), mq('heritageVelkor.hv1.description'), mq('heritageVelkor.hv1.objective'), { type: 'winCombatAt', station: 'Les Abysses de Velkor' }, { credits: 600, message: mq('heritageVelkor.hv1.rewardMsg') }),
      stage('hv2', mq('heritageVelkor.hv2.title'), mq('heritageVelkor.hv2.description'), mq('heritageVelkor.hv2.objective'), { type: 'meetNpc', npcName: 'Archiviste Zal' }, { credits: 1200, message: mq('heritageVelkor.hv2.rewardMsg') }),
      stage('hv3', mq('heritageVelkor.hv3.title'), mq('heritageVelkor.hv3.description'), mq('heritageVelkor.hv3.objective'), { type: 'meetNpc', npcName: 'Lira' }, { message: mq('heritageVelkor.hv3.rewardMsg') }),
      stage('hv4', mq('heritageVelkor.hv4.title'), mq('heritageVelkor.hv4.description'), mq('heritageVelkor.hv4.objective'), { type: 'winCombatAt', station: 'Le Berceau' }, { rep: 20, credits: 2000, message: mq('heritageVelkor.hv4.rewardMsg') }),
      stage('hv5', mq('heritageVelkor.hv5.title'), mq('heritageVelkor.hv5.description'), mq('heritageVelkor.hv5.objective'), { type: 'visitStation', station: 'Les Abysses de Velkor' }),
      stage('hv6', mq('heritageVelkor.hv6.title'), mq('heritageVelkor.hv6.description'), mq('heritageVelkor.hv6.objective'), { type: 'winCombatAt', station: 'Les Abysses de Velkor' }, { credits: 12000, rep: 50, message: mq('heritageVelkor.hv6.rewardMsg') }),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. LA VENGEANCE D'OSSIAN (Torvak → réputation ≥ 30)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'vengeance_ossian',
    title: mq('vengeanceOssian.title'),
    giver: 'Torvak',
    giverStation: 'Fort Kharos',
    lore: mq('vengeanceOssian.lore'),
    currentStage: 0, completed: false, failed: false,
    requiresReputation: 30,
    stages: [
      stage('vo1', mq('vengeanceOssian.vo1.title'), mq('vengeanceOssian.vo1.description'), mq('vengeanceOssian.vo1.objective'), { type: 'visitStation', station: 'Fort Kharos' }, { message: mq('vengeanceOssian.vo1.rewardMsg') }),
      stage('vo2', mq('vengeanceOssian.vo2.title'), mq('vengeanceOssian.vo2.description'), mq('vengeanceOssian.vo2.objective'), { type: 'meetNpc', npcName: 'Orva' }, { credits: 1500, message: mq('vengeanceOssian.vo2.rewardMsg') }),
      stage('vo3', mq('vengeanceOssian.vo3.title'), mq('vengeanceOssian.vo3.description'), mq('vengeanceOssian.vo3.objective'), { type: 'winCombatAt', station: 'Fort Ossian' }, { rep: 20, credits: 2000, message: mq('vengeanceOssian.vo3.rewardMsg') }),
      stage('vo4', mq('vengeanceOssian.vo4.title'), mq('vengeanceOssian.vo4.description'), mq('vengeanceOssian.vo4.objective'), { type: 'meetNpc', npcName: 'Keln' }, { credits: 1000, message: mq('vengeanceOssian.vo4.rewardMsg') }),
      stage('vo5', mq('vengeanceOssian.vo5.title'), mq('vengeanceOssian.vo5.description'), mq('vengeanceOssian.vo5.objective'), { type: 'winCombatAt', station: 'La Forteresse Exilée' }, { rep: 25, credits: 3000, message: mq('vengeanceOssian.vo5.rewardMsg') }),
      stage('vo6', mq('vengeanceOssian.vo6.title'), mq('vengeanceOssian.vo6.description'), mq('vengeanceOssian.vo6.objective'), { type: 'visitStation', station: 'Fort Kharos' }, { credits: 10000, rep: 45, message: mq('vengeanceOssian.vo6.rewardMsg') }),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. LA COURONNE ET LE VIDE (Ulmo → faction Emporium OU rép ≥ 50)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'couronne_vide',
    title: mq('couronneVide.title'),
    giver: 'Ulmo',
    giverStation: "La Couronne d'Eos",
    lore: mq('couronneVide.lore'),
    currentStage: 0, completed: false, failed: false,
    requiresFaction: 'emporium',
    stages: [
      stage('cv1', mq('couronneVide.cv1.title'), mq('couronneVide.cv1.description'), mq('couronneVide.cv1.objective'), { type: 'visitStation', station: "La Couronne d'Eos" }, { message: mq('couronneVide.cv1.rewardMsg') }),
      stage('cv2', mq('couronneVide.cv2.title'), mq('couronneVide.cv2.description'), mq('couronneVide.cv2.objective'), { type: 'meetNpc', npcName: 'Sael' }, { credits: 2000, message: mq('couronneVide.cv2.rewardMsg') }),
      stage('cv3', mq('couronneVide.cv3.title'), mq('couronneVide.cv3.description'), mq('couronneVide.cv3.objective'), { type: 'meetNpc', npcName: 'Lady Sonn' }, { message: mq('couronneVide.cv3.rewardMsg') }),
      stage('cv4', mq('couronneVide.cv4.title'), mq('couronneVide.cv4.description'), mq('couronneVide.cv4.objective'), { type: 'winCombatAt', station: "La Couronne d'Eos" }, { rep: 25, credits: 3000, message: mq('couronneVide.cv4.rewardMsg') }),
      stage('cv5', mq('couronneVide.cv5.title'), mq('couronneVide.cv5.description'), mq('couronneVide.cv5.objective'), { type: 'winCombatAt', station: 'Scotty Golden North' }, { message: mq('couronneVide.cv5.rewardMsg') }),
      stage('cv6', mq('couronneVide.cv6.title'), mq('couronneVide.cv6.description'), mq('couronneVide.cv6.objective'), { type: 'visitStation', station: "La Couronne d'Eos" }, { credits: 15000, rep: 60, message: mq('couronneVide.cv6.rewardMsg') }),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. LA ROUTE DES CENDRES (Murn → 8+ stations visitées)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'route_cendres',
    title: mq('routeCendres.title'),
    giver: 'Murn',
    giverStation: 'Les Cendres',
    lore: mq('routeCendres.lore'),
    currentStage: 0, completed: false, failed: false,
    requiresReputation: 0,
    stages: [
      stage('rc1', mq('routeCendres.rc1.title'), mq('routeCendres.rc1.description'), mq('routeCendres.rc1.objective'), { type: 'meetNpc', npcName: 'Murn' }, { message: mq('routeCendres.rc1.rewardMsg') }),
      stage('rc2', mq('routeCendres.rc2.title'), mq('routeCendres.rc2.description'), mq('routeCendres.rc2.objective'), { type: 'meetNpc', npcName: 'Docta' }, { credits: 800, message: mq('routeCendres.rc2.rewardMsg') }),
      stage('rc3', mq('routeCendres.rc3.title'), mq('routeCendres.rc3.description'), mq('routeCendres.rc3.objective'), { type: 'meetNpc', npcName: 'Brenn' }, { message: mq('routeCendres.rc3.rewardMsg') }),
      stage('rc4', mq('routeCendres.rc4.title'), mq('routeCendres.rc4.description'), mq('routeCendres.rc4.objective'), { type: 'winCombatAt', station: "L'Épave Vivante" }, { rep: 20, credits: 2500, message: mq('routeCendres.rc4.rewardMsg') }),
      stage('rc5', mq('routeCendres.rc5.title'), mq('routeCendres.rc5.description'), mq('routeCendres.rc5.objective'), { type: 'winCombatAt', station: 'Port de Nuit' }, { credits: 4000, message: mq('routeCendres.rc5.rewardMsg') }),
      stage('rc6', mq('routeCendres.rc6.title'), mq('routeCendres.rc6.description'), mq('routeCendres.rc6.objective'), { type: 'visitStation', station: 'Les Cendres' }, { credits: 9000, rep: 40, message: mq('routeCendres.rc6.rewardMsg') }),
    ],
  },
  // ─────────────────────────────────────────────────────────────────────────────
  // 6. CARNAGE CONTRÔLÉ (Vix → bossesDefeated ≥ 1, rép ≥ 0)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'carnage_controle',
    title: mq('carnageControle.title'),
    giver: 'Vix',
    giverStation: 'La Carcasse',
    lore: mq('carnageControle.lore'),
    currentStage: 0, completed: false, failed: false,
    requiresReputation: 0,
    stages: [
      stage('cc1', mq('carnageControle.cc1.title'), mq('carnageControle.cc1.description'), mq('carnageControle.cc1.objective'),
        { type: 'visitStation', station: 'La Carcasse' },
        { credits: 2000, message: mq('carnageControle.cc1.rewardMsg') }),

      stage('cc2', mq('carnageControle.cc2.title'), mq('carnageControle.cc2.description'), mq('carnageControle.cc2.objective'),
        { type: 'winCombatAt', station: 'Arc Ouest Apocalypse' },
        { credits: 5000, rep: 20, message: mq('carnageControle.cc2.rewardMsg') }),

      stage('cc3', mq('carnageControle.cc3.title'), mq('carnageControle.cc3.description'), mq('carnageControle.cc3.objective'),
        { type: 'winCombatAt', station: 'La Citadelle Écarlate' },
        { credits: 5000, rep: 20, message: mq('carnageControle.cc3.rewardMsg') }),

      stage('cc4', mq('carnageControle.cc4.title'), mq('carnageControle.cc4.description'), mq('carnageControle.cc4.objective'),
        { type: 'winCombatAt', station: 'Emporium Requiem' },
        { credits: 6000, rep: 25, message: mq('carnageControle.cc4.rewardMsg') }),

      stage('cc5', mq('carnageControle.cc5.title'), mq('carnageControle.cc5.description'), mq('carnageControle.cc5.objective'),
        { type: 'winCombatAt', station: 'Les Abysses de Velkor' },
        { credits: 6000, rep: 25, message: mq('carnageControle.cc5.rewardMsg') }),

      stage('cc6', mq('carnageControle.cc6.title'), mq('carnageControle.cc6.description'), mq('carnageControle.cc6.objective'),
        { type: 'visitStation', station: 'La Carcasse' },
        { credits: 30000, rep: 100, message: mq('carnageControle.cc6.rewardMsg') }),
    ],
  },

  ]
}

// Récupère les quêtes majeures disponibles pour un NPC donné
export function getMajorQuestForNpc(gs: GameState, npcName: string): MajorQuest | null {
  const quest = getMajorQuestsList().find(q => q.giver === npcName)
  if (!quest) return null
  if (!canStartMajorQuest(gs, quest)) return null
  return quest
}
