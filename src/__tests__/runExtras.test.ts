import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n, setLanguage } from '../i18n/config'
import { ALL_RELIC_IDS, getRelic, getPassiveMods, drawRelicChoices, grantRelic } from '../data/relics'
import { createCompetitors, tickCompetitors, getCompetitorPriceMult, settleCompetitorDuel, tradeTip, getPlayerRank } from '../engine/competitors'
import type { GameState } from '../types'

// Reliques et concurrents : les deux systèmes censés rendre chaque run
// différente et faire vivre le secteur au quotidien.

beforeAll(async () => { await initI18n() })

function gs(extra: Partial<GameState> = {}): GameState {
  return {
    day: 5, credits: 1000, playerHp: 60, playerMaxHp: 90, fuel: 3, maxFuel: 8,
    currentStation: 'Port Méridien', relics: [], pendingRelicChoice: null,
    competitors: [], marketPressure: [], competitorNews: [], pendingCompetitorId: null,
    ...extra,
  } as unknown as GameState
}

describe('reliques', () => {

  it('ont toutes un nom et une description dans les deux langues', async () => {
    for (const lang of ['fr', 'en'] as const) {
      await setLanguage(lang)
      for (const id of ALL_RELIC_IDS) {
        const r = getRelic(id)!
        expect(r.name, `${lang}/${id}`).not.toContain('relics.')
        expect(r.description.length, `${lang}/${id}`).toBeGreaterThan(10)
      }
    }
    await setLanguage('fr')
  })

  it('cumulent leurs effets et respectent les planchers', () => {
    expect(getPassiveMods(gs()).dmgMult).toBe(1)
    const m = getPassiveMods(gs({ relics: ['coeurInstable', 'poingFerraille'] }))
    expect(m.dmgMult).toBeCloseTo(1.3 * 1.15)
    expect(m.travelHp).toBe(-4)
    // Deux réductions de dégâts ne rendent pas invulnérable.
    expect(getPassiveMods(gs({ relics: ['plaqueBlindee', 'plaqueBlindee', 'plaqueBlindee', 'plaqueBlindee', 'plaqueBlindee'] })).dmgTakenMult).toBeGreaterThanOrEqual(0.5)
  })

  it('proposent trois choix distincts, jamais une relique déjà possédée', () => {
    for (let i = 0; i < 200; i++) {
      const owned = ALL_RELIC_IDS.slice(0, 5)
      const choix = drawRelicChoices(gs({ relics: owned }))
      expect(new Set(choix).size).toBe(3)
      for (const id of choix) expect(owned).not.toContain(id)
    }
  })

  it('appliquent leurs bonus permanents à l\'obtention', () => {
    const base = gs()
    const p = grantRelic(base, 'carcasseVivante')
    expect(p.relics).toEqual(['carcasseVivante'])
    expect(p.playerMaxHp).toBe(115)
    expect(p.pendingRelicChoice).toBeNull()
    expect(grantRelic({ ...base, relics: ['carcasseVivante'] }, 'carcasseVivante')).toEqual({})
  })
})

describe('concurrents', () => {

  it('démarrent à trois, un de chaque style, loin du joueur', () => {
    const cs = createCompetitors('Port Méridien')
    expect(cs.map(c => c.style).sort()).toEqual(['chasseur', 'marchand', 'pillard'])
    for (const c of cs) expect(c.station).not.toBe('Port Méridien')
  })

  it('agissent chaque jour : ils s\'enrichissent, font bouger les prix, et font l\'actualité', () => {
    let etat = gs({ competitors: createCompetitors('Port Méridien') })
    const depart = etat.competitors.reduce((n, c) => n + c.credits, 0)
    let nouvelles = 0, pressions = 0
    for (let jour = 5; jour < 35; jour++) {
      etat = { ...etat, day: jour, ...tickCompetitors({ ...etat, day: jour }) }
      expect(etat.competitorNews.length).toBeLessThanOrEqual(2)
      nouvelles += etat.competitorNews.length
      pressions = Math.max(pressions, etat.marketPressure.length)
    }
    expect(etat.competitors.reduce((n, c) => n + c.credits, 0)).toBeGreaterThan(depart)
    expect(nouvelles, 'le briefing reste vide').toBeGreaterThan(15)
    expect(pressions, 'aucun effet sur les marchés').toBeGreaterThan(0)
    // Les pressions expirées disparaissent.
    for (const p of etat.marketPressure) expect(p.untilDay).toBeGreaterThanOrEqual(etat.day)
  })

  it('modifient le prix des biens concernés, et d\'eux seuls', () => {
    const etat = gs({ marketPressure: [
      { station: 'Port Méridien', item: 'Médicaments', mult: 1.25, untilDay: 7, by: 'Vex' },
      { station: 'Port Méridien', item: '*', mult: 1.15, untilDay: 7, by: 'Kira' },
      { station: 'La Carcasse', item: 'Outils', mult: 0.8, untilDay: 3, by: 'Vex' },
    ] })
    expect(getCompetitorPriceMult(etat, 'Port Méridien', 'Médicaments')).toBeCloseTo(1.25 * 1.15)
    expect(getCompetitorPriceMult(etat, 'Port Méridien', 'Outils')).toBeCloseTo(1.15)
    expect(getCompetitorPriceMult(etat, 'La Carcasse', 'Outils'), 'pression expirée').toBe(1)
  })

  it('un duel gagné rapporte une part de leur fortune et les met hors-jeu', () => {
    const etat = gs({ competitors: [{ id: 'x', name: 'Vex', style: 'marchand', station: 'Port Méridien', credits: 4000, mood: 0, outUntilDay: 0 }] })
    const { patch, amount } = settleCompetitorDuel(etat, 'x')
    expect(amount).toBe(1000)
    expect(patch.credits).toBe(2000)
    expect(patch.competitors[0].outUntilDay).toBeGreaterThan(etat.day)
    expect(patch.competitors[0].mood).toBeLessThan(0)
  })

  it('un tuyau crée vraiment la hausse annoncée', () => {
    const etat = gs({ competitors: [{ id: 'x', name: 'Vex', style: 'marchand', station: 'Port Méridien', credits: 1000, mood: 0, outUntilDay: 0 }] })
    const r = tradeTip(etat, 'x')
    const { station, item } = r.tip.params as { station: string; item: string }
    expect(getCompetitorPriceMult({ ...etat, marketPressure: r.marketPressure }, station, item)).toBeGreaterThan(1.3)
    expect(r.competitors[0].mood).toBeGreaterThan(0)
  })

  it('classe le joueur parmi eux par fortune', () => {
    const etat = gs({ credits: 5000, competitors: createCompetitors('Port Méridien') })
    expect(getPlayerRank(etat)).toBe(1)
    expect(getPlayerRank({ ...etat, credits: 0 })).toBe(4)
  })
})
