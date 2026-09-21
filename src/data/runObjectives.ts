import type { GameState } from '../types'
import i18n from '../i18n/config'

const ro = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'runObjectives', ...params })

export interface RunObjective {
  id: string
  name: string
  desc: string
  check: (gs: GameState) => boolean
  progress: (gs: GameState) => string
  metaPointReward: number
}

function getRunObjectivesList(): RunObjective[] {
  return [
  {
    id: 'magnat', name: ro('magnat.name'),
    desc: ro('magnat.desc'),
    check: gs => gs.credits >= 12000,
    progress: gs => ro('magnat.progress', { credits: gs.credits.toLocaleString() }),
    metaPointReward: 3,
  },
  {
    id: 'machine_guerre', name: ro('machineGuerre.name'),
    desc: ro('machineGuerre.desc'),
    check: gs => gs.explorationFightsDone >= 12,
    progress: gs => ro('machineGuerre.progress', { count: gs.explorationFightsDone }),
    metaPointReward: 2,
  },
  {
    id: 'nomade', name: ro('nomade.name'),
    desc: ro('nomade.desc'),
    check: gs => gs.day >= 20,
    progress: gs => ro('nomade.progress', { day: gs.day }),
    metaPointReward: 2,
  },
  {
    id: 'diplomate', name: ro('diplomate.name'),
    desc: ro('diplomate.desc'),
    check: gs => gs.npcsMet.length >= 10,
    progress: gs => ro('diplomate.progress', { count: gs.npcsMet.length }),
    metaPointReward: 2,
  },
  {
    id: 'soldat_faction', name: ro('soldatFaction.name'),
    desc: ro('soldatFaction.desc'),
    check: gs => gs.factionMissions >= 6,
    progress: gs => ro('soldatFaction.progress', { count: gs.factionMissions }),
    metaPointReward: 3,
  },
  {
    id: 'artisan', name: ro('artisan.name'),
    desc: ro('artisan.desc'),
    check: gs => (gs.craftsPerformed ?? 0) >= 6,
    progress: gs => ro('artisan.progress', { count: gs.craftsPerformed ?? 0 }),
    metaPointReward: 2,
  },
  {
    id: 'contractuel', name: ro('contractuel.name'),
    desc: ro('contractuel.desc'),
    check: gs => gs.completedQuestIds.length >= 8,
    progress: gs => ro('contractuel.progress', { count: gs.completedQuestIds.length }),
    metaPointReward: 2,
  },
  {
    id: 'legendaire', name: ro('legendaire.name'),
    desc: ro('legendaire.desc'),
    check: gs => gs.reputation >= 60,
    progress: gs => ro('legendaire.progress', { rep: gs.reputation }),
    metaPointReward: 3,
  },
  {
    id: 'chasseur_boss', name: ro('chasseurBoss.name'),
    desc: ro('chasseurBoss.desc'),
    check: gs => gs.bossesDefeated >= 3,
    progress: gs => ro('chasseurBoss.progress', { count: gs.bossesDefeated }),
    metaPointReward: 3,
  },
  {
    id: 'collectionneur', name: ro('collectionneur.name'),
    desc: ro('collectionneur.desc'),
    check: gs => Object.keys(gs.cargo).length >= 5,
    progress: gs => ro('collectionneur.progress', { count: Object.keys(gs.cargo).length }),
    metaPointReward: 2,
  },
  ]
}

export function drawRunObjective(rng: () => number = Math.random): RunObjective {
  const list = getRunObjectivesList()
  return list[Math.floor(rng() * list.length)]
}

export function getRunObjective(id: string): RunObjective | undefined {
  return getRunObjectivesList().find(o => o.id === id)
}
