import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { useGameStore } from '../store/gameStore'
import { getClasses } from '../data/classes'

// La statistique « total gagné » est calculée par une enveloppe autour du `set`
// du store : ce genre d'interception peut silencieusement ne rien faire, donc on
// vérifie qu'elle compte les gains et ignore les dépenses.

beforeAll(async () => { await initI18n() })

describe('total des crédits gagnés', () => {
  it('accumule les gains et ignore les dépenses', () => {
    useGameStore.getState().selectClass(getClasses().find(c => c.name === 'Marchand')!)

    const depart = useGameStore.getState().gs!.credits
    const totalDepart = useGameStore.getState().gs!.totalCreditsEarned ?? 0

    useGameStore.getState().patch({ credits: depart + 1000 })
    expect(useGameStore.getState().gs!.totalCreditsEarned).toBe(totalDepart + 1000)

    // Une dépense ne doit pas faire reculer le total gagné.
    useGameStore.getState().patch({ credits: depart + 400 })
    expect(useGameStore.getState().gs!.totalCreditsEarned).toBe(totalDepart + 1000)

    // Un nouveau gain reprend l'accumulation.
    useGameStore.getState().patch({ credits: depart + 900 })
    expect(useGameStore.getState().gs!.totalCreditsEarned).toBe(totalDepart + 1500)
  })
})
