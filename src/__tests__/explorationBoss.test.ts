import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { useGameStore } from '../store/gameStore'
import { getClasses } from '../data/classes'
import { rollExplorationEvent } from '../engine/exploration'
import type { GameState } from '../types'

let base: GameState
beforeAll(async () => {
  await initI18n()
  useGameStore.getState().selectClass(getClasses().find(c => c.name === 'Vétéran')!)
  base = useGameStore.getState().gs!
})

function deepIn(station: string, depth: number, beaten: string[] = []): GameState {
  return { ...base, currentStation: station, zoneDepth: depth, explorationFightsDone: 3, lastExploreWasCombat: true, stationBossesBeaten: beaten }
}

describe("boss d'exploration", () => {
  it('se montre à coup sûr à la profondeur 9 tant que le chef est debout', () => {
    for (let i = 0; i < 300; i++) {
      expect(rollExplorationEvent(deepIn('Station Ombre', 9)).type).toBe('boss')
    }
  })

  it("ne laisse plus passer la profondeur 13 sans boss (le cas qui t'est arrivé)", () => {
    let sansBoss = 0
    for (let run = 0; run < 2000; run++) {
      let vu = false
      for (let depth = 7; depth <= 13 && !vu; depth++) {
        vu = rollExplorationEvent(deepIn('Station Ombre', depth)).type === 'boss'
      }
      if (!vu) sansBoss++
    }
    expect(sansBoss).toBe(0)
  })

  it("reste une rencontre aléatoire une fois le chef battu (on peut le refarmer, sans qu'il bloque l'exploration)", () => {
    let boss = 0
    for (let i = 0; i < 2000; i++) {
      if (rollExplorationEvent(deepIn('Station Ombre', 11, ['Station Ombre'])).type === 'boss') boss++
    }
    expect(boss / 2000).toBeGreaterThan(0.2)
    expect(boss / 2000).toBeLessThan(0.4)
  })
})
