import type { GameState, NarrativeArc, ArcId } from '../types'
import { arePillarSubBossesCleared } from '../data/subBosses'
import i18n from '../i18n/config'

const st = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'narrativeArcs', ...params })

export interface ArcStep {
  title: string
  description: string
  condition?: (gs: GameState) => boolean
  conditionHint?: string
  choices: ArcChoice[]
}

export interface ArcChoice {
  label: string
  available?: (gs: GameState) => boolean
  // triggerCombat : déclenche un vrai combat via un flag explicite plutôt qu'en
  // devinant depuis le texte du message (fragile — un message parlant de "combat"
  // sans le vouloir déclenchait un affrontement par accident).
  effect: (gs: GameState) => Partial<GameState> & { message: string; advancesArc?: boolean; failsArc?: boolean; triggerCombat?: boolean }
}

export interface ArcDefinition {
  id: ArcId
  title: string
  intro: string
  triggerCondition: (gs: GameState) => boolean
  steps: ArcStep[]
  completionReward: (gs: GameState) => Partial<GameState>
  completionMessage: string
}

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// ── ARC 1 : ALANOSSA ─────────────────────────────────────────────────────────
// Construits via des fonctions (pas des const figées) car `st()` doit se
// ré-évaluer à chaque appel pour suivre la langue active — un objet construit
// une seule fois au chargement du module resterait figé dans la langue de
// démarrage, même après un changement de langue en cours de partie.
function buildArcAlanossa(): ArcDefinition { return {
  id: 'alanossa',
  title: st('alanossa.title'),
  intro: st('alanossa.intro'),
  triggerCondition: gs => gs.day >= 5 && gs.visitedStations.includes('Arc Ouest Apocalypse'),
  completionMessage: st('alanossa.completionMessage'),
  completionReward: gs => ({
    credits: gs.credits + 8000,
    reputation: gs.reputation + 150,
    bossesDefeated: gs.bossesDefeated + 1,
    stationBossesBeaten: [...gs.stationBossesBeaten, 'Arc Ouest Apocalypse'],
  }),
  steps: [
    {
      title: st('alanossa.steps.0.title'),
      description: st('alanossa.steps.0.desc'),
      choices: [
        {
          label: st('alanossa.steps.0.c0'),
          effect: gs => ({ message: st('alanossa.steps.0.c0msg'), advancesArc: true }),
        },
        {
          label: st('alanossa.steps.0.c1'),
          effect: gs => ({
            reputation: gs.reputation + 10,
            message: st('alanossa.steps.0.c1msg'),
            advancesArc: true,
          }),
        },
      ]
    },
    {
      title: st('alanossa.steps.1.title'),
      description: st('alanossa.steps.1.desc'),
      choices: [
        {
          label: st('alanossa.steps.1.c0'),
          effect: gs => ({
            message: st('alanossa.steps.1.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('alanossa.steps.1.c1'),
          available: gs => gs.reputation >= 50,
          effect: gs => ({
            reputation: gs.reputation + 15,
            message: st('alanossa.steps.1.c1msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('alanossa.steps.1.c2'),
          effect: gs => ({
            message: st('alanossa.steps.1.c2msg'),
            failsArc: true,
          }),
        },
      ]
    },
    {
      title: st('alanossa.steps.2.title'),
      // Alanossa ne reçoit personne qui n'a pas fait ses preuves — les quatre
      // lieutenants gardent l'accès à sa personne. Sans ça, pas de négociation
      // possible : ce serait juste te laisser tuer pour rien.
      condition: gs => arePillarSubBossesCleared(gs.subBossesDefeated ?? {}, 'alanossa'),
      conditionHint: st('alanossa.steps.2.conditionHint'),
      description: st('alanossa.steps.2.desc'),
      choices: [
        {
          label: st('alanossa.steps.2.c0'),
          available: gs => gs.credits >= 3000,
          effect: gs => ({
            credits: gs.credits - 3000,
            reputation: gs.reputation + 30,
            message: st('alanossa.steps.2.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('alanossa.steps.2.c1'),
          effect: gs => ({
            message: st('alanossa.steps.2.c1msg'),
            advancesArc: true,
            triggerCombat: true,
          }),
        },
        {
          label: st('alanossa.steps.2.c2'),
          available: gs => gs.completedQuestIds.length >= 3,
          effect: gs => ({
            reputation: gs.reputation + 50,
            message: st('alanossa.steps.2.c2msg'),
            advancesArc: true,
          }),
        },
      ]
    },
  ]
} }

// ── ARC 2 : RAPHAZARUS ────────────────────────────────────────────────────────
// Cet arc ne se déclenche qu'après la découverte de L'Arc Perdu par le système
// d'indices (nexus.ts, ARC_PERDU_CLUES — 6 pistes disséminées dans le secteur).
// Avant ça, Raphazarus n'est qu'une rumeur : personne ne confirme qu'il existe
// vraiment. L'arc raconte l'approche finale et la rencontre, pas la découverte —
// celle-ci a déjà eu lieu, indice par indice, avant que ce texte n'apparaisse.
function buildArcRaphazarus(): ArcDefinition { return {
  id: 'raphazarus',
  title: st('raphazarus.title'),
  intro: st('raphazarus.intro'),
  triggerCondition: gs => !!gs.arcPerduUnlocked,
  completionMessage: st('raphazarus.completionMessage'),
  completionReward: gs => ({
    credits: gs.credits + (gs.pastDecisions?.includes('raphazarus_joined') ? 4000 : 1500),
    reputation: gs.reputation + (gs.pastDecisions?.includes('raphazarus_joined') ? 80 : 20),
  }),
  steps: [
    {
      title: st('raphazarus.steps.0.title'),
      description: st('raphazarus.steps.0.desc'),
      choices: [
        {
          label: st('raphazarus.steps.0.c0'),
          effect: gs => ({
            reputation: gs.reputation + 8,
            message: st('raphazarus.steps.0.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('raphazarus.steps.0.c1'),
          effect: gs => ({
            message: st('raphazarus.steps.0.c1msg'),
            advancesArc: true,
          }),
        },
      ]
    },
    {
      title: st('raphazarus.steps.1.title'),
      description: st('raphazarus.steps.1.desc'),
      choices: [
        {
          label: st('raphazarus.steps.1.c0'),
          effect: gs => ({
            message: st('raphazarus.steps.1.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('raphazarus.steps.1.c1'),
          effect: gs => ({
            reputation: gs.reputation + 5,
            message: st('raphazarus.steps.1.c1msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('raphazarus.steps.1.c2'),
          effect: gs => ({
            message: st('raphazarus.steps.1.c2msg'),
            advancesArc: true,
          }),
        },
      ]
    },
    {
      title: st('raphazarus.steps.2.title'),
      condition: gs => gs.currentStation === "L'Arc Perdu",
      conditionHint: st('raphazarus.steps.2.conditionHint'),
      description: st('raphazarus.steps.2.desc'),
      choices: [
        {
          label: st('raphazarus.steps.2.c0'),
          available: gs => gs.faction === 'none',
          effect: gs => ({
            reputation: gs.reputation + 60,
            faction: 'culte' as const,
            pastDecisions: [...(gs.pastDecisions ?? []), 'raphazarus_joined'],
            message: st('raphazarus.steps.2.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('raphazarus.steps.2.c1'),
          available: gs => gs.faction !== 'none' && gs.faction !== 'culte',
          effect: gs => ({
            reputation: gs.reputation + 30,
            isDoubleAgent: true,
            pastDecisions: [...(gs.pastDecisions ?? []), 'raphazarus_joined'],
            message: st('raphazarus.steps.2.c1msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('raphazarus.steps.2.c2'),
          effect: gs => ({
            pastDecisions: [...(gs.pastDecisions ?? []), 'raphazarus_refused'],
            message: st('raphazarus.steps.2.c2msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('raphazarus.steps.2.c3'),
          available: gs => gs.completedQuestIds.length >= 5,
          effect: gs => ({
            reputation: gs.reputation + 40,
            credits: gs.credits + 2000,
            pastDecisions: [...(gs.pastDecisions ?? []), 'raphazarus_deal'],
            message: st('raphazarus.steps.2.c3msg'),
            advancesArc: true,
          }),
        },
      ]
    },
  ]
} }

// ── ARC 3 : ENQUÊTE VAEL ─────────────────────────────────────────────────────
function buildArcVael(): ArcDefinition { return {
  id: 'vael',
  title: st('vael.title'),
  intro: st('vael.intro'),
  triggerCondition: gs => gs.visitedStations.includes('Les Abysses de Velkor'),
  completionMessage: st('vael.completionMessage'),
  completionReward: gs => ({
    credits: gs.credits + 5000,
    reputation: gs.reputation + 80,
  }),
  steps: [
    {
      title: st('vael.steps.0.title'),
      description: st('vael.steps.0.desc'),
      choices: [
        {
          label: st('vael.steps.0.c0'),
          effect: gs => ({
            message: st('vael.steps.0.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('vael.steps.0.c1'),
          effect: gs => ({
            credits: gs.credits + 500,
            message: st('vael.steps.0.c1msg'),
            advancesArc: true,
          }),
        },
      ]
    },
    {
      title: st('vael.steps.1.title'),
      description: st('vael.steps.1.desc'),
      choices: [
        {
          label: st('vael.steps.1.c0'),
          available: gs => gs.class.name === 'Hackeur',
          effect: gs => ({
            reputation: gs.reputation + 20,
            message: st('vael.steps.1.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('vael.steps.1.c1'),
          effect: gs => ({
            credits: gs.credits - 400,
            message: gs.credits >= 400 ? st('vael.steps.1.c1msgWin') : st('vael.steps.1.c1msgFail'),
            advancesArc: gs.credits >= 400,
          }),
        },
        {
          label: st('vael.steps.1.c2'),
          effect: gs => ({
            reputation: gs.reputation + 10,
            message: st('vael.steps.1.c2msg'),
            advancesArc: true,
          }),
        },
      ]
    },
    {
      title: st('vael.steps.2.title'),
      description: st('vael.steps.2.desc'),
      choices: [
        {
          label: st('vael.steps.2.c0'),
          effect: gs => ({
            reputation: gs.reputation + 50,
            message: st('vael.steps.2.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('vael.steps.2.c1'),
          effect: gs => ({
            reputation: gs.reputation + 20,
            credits: gs.credits + 1500,
            message: st('vael.steps.2.c1msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('vael.steps.2.c2'),
          effect: gs => ({
            credits: gs.credits + 4000,
            reputation: gs.reputation - 20,
            message: st('vael.steps.2.c2msg'),
            advancesArc: true,
          }),
        },
      ]
    },
  ]
} }

// ── ARC 4 : GUERRE DE FACTIONS ────────────────────────────────────────────────
function buildArcFactionwar(): ArcDefinition { return {
  id: 'factionwar',
  title: st('factionwar.title'),
  intro: st('factionwar.intro'),
  triggerCondition: gs => gs.day >= 20 || gs.bossesDefeated >= 1,
  completionMessage: st('factionwar.completionMessage'),
  completionReward: gs => ({
    credits: gs.credits + 3000,
    reputation: gs.reputation + 80,
    isFactionLeader: true,
  }),
  steps: [
    {
      title: st('factionwar.steps.0.title'),
      description: st('factionwar.steps.0.desc'),
      choices: [
        {
          label: st('factionwar.steps.0.c0'),
          effect: gs => ({
            faction: 'faucons',
            message: st('factionwar.steps.0.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('factionwar.steps.0.c1'),
          effect: gs => ({
            faction: 'gardiens',
            message: st('factionwar.steps.0.c1msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('factionwar.steps.0.c2'),
          effect: gs => ({
            credits: gs.credits + rng(500, 1500),
            message: st('factionwar.steps.0.c2msg'),
            advancesArc: true,
          }),
        },
      ]
    },
    {
      title: st('factionwar.steps.1.title'),
      description: st('factionwar.steps.1.desc'),
      choices: [
        {
          label: st('factionwar.steps.1.c0'),
          effect: gs => ({
            reputation: gs.reputation + 60,
            factionMissions: gs.factionMissions + 1,
            message: st('factionwar.steps.1.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('factionwar.steps.1.c1'),
          effect: gs => ({
            credits: gs.credits + 3000,
            reputation: gs.reputation - 40,
            isDoubleAgent: true,
            message: st('factionwar.steps.1.c1msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('factionwar.steps.1.c2'),
          available: gs => gs.reputation >= 100,
          effect: gs => ({
            reputation: gs.reputation + 100,
            message: st('factionwar.steps.1.c2msg'),
            advancesArc: true,
          }),
        },
      ]
    },
    {
      title: st('factionwar.steps.2.title'),
      description: st('factionwar.steps.2.desc'),
      choices: [
        {
          label: st('factionwar.steps.2.c0'),
          effect: gs => ({
            reputation: gs.reputation + 100,
            credits: gs.credits + 2000,
            message: st('factionwar.steps.2.c0msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('factionwar.steps.2.c1'),
          available: gs => gs.reputation >= 150,
          effect: gs => ({
            reputation: gs.reputation + 150,
            isFactionLeader: true,
            message: st('factionwar.steps.2.c1msg'),
            advancesArc: true,
          }),
        },
        {
          label: st('factionwar.steps.2.c2'),
          available: gs => gs.bossesDefeated >= 2,
          effect: gs => ({
            reputation: gs.reputation + 80,
            isFactionLeader: true,
            credits: gs.credits + 3000,
            message: st('factionwar.steps.2.c2msg'),
            advancesArc: true,
          }),
        },
      ]
    },
  ]
} }

export function getArcDefinitions(): ArcDefinition[] {
  return [
    buildArcAlanossa(),
    buildArcRaphazarus(),
    buildArcVael(),
    buildArcFactionwar(),
  ]
}

export function checkArcTriggers(gs: GameState): NarrativeArc[] {
  const newArcs: NarrativeArc[] = []
  const activeIds = new Set(gs.activeArcs.map(a => a.id))
  const completedIds = new Set(gs.completedArcs)

  for (const def of getArcDefinitions()) {
    if (activeIds.has(def.id) || completedIds.has(def.id)) continue
    if (def.triggerCondition(gs)) {
      newArcs.push({
        id: def.id,
        title: def.title,
        step: 0,
        maxSteps: def.steps.length,
        completed: false,
        failed: false,
      })
    }
  }
  return newArcs
}

export function getCurrentStep(arc: NarrativeArc, gs?: GameState): ArcStep | null {
  const def = getArcDefinitions().find(d => d.id === arc.id)
  if (!def || arc.step >= def.steps.length) return null
  const step = def.steps[arc.step]
  if (step.condition && gs && !step.condition(gs)) return null
  return step
}

export function getCurrentStepBlocked(arc: NarrativeArc, gs: GameState): string | null {
  const def = getArcDefinitions().find(d => d.id === arc.id)
  if (!def || arc.step >= def.steps.length) return null
  const step = def.steps[arc.step]
  if (step.condition && !step.condition(gs)) return step.conditionHint ?? i18n.t('stepBlockedFallback', { ns: 'narrativeArcs' })
  return null
}

export function advanceArc(arc: NarrativeArc, gs: GameState): { arc: NarrativeArc; rewardGs?: Partial<GameState>; completed: boolean } {
  const def = getArcDefinitions().find(d => d.id === arc.id)!
  const nextStep = arc.step + 1

  if (nextStep >= def.steps.length) {
    const reward = def.completionReward(gs)
    return {
      arc: { ...arc, step: nextStep, completed: true },
      rewardGs: reward,
      completed: true,
    }
  }
  return { arc: { ...arc, step: nextStep }, completed: false }
}
