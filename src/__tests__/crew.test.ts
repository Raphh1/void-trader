import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n, setLanguage } from '../i18n/config'
import i18n from '../i18n/config'
import { getRecruits, hireCrew, fireCrew, hiringFee, tickCrewDay, crewCasualty, MAX_CREW, CREW_ROLES } from '../engine/crew'
import { getPassiveMods } from '../data/relics'
import { getStations } from '../data/stations'
import type { GameState, CrewMember } from '../types'

// Équipage : effets permanents en échange d'un salaire et d'une loyauté à tenir.

beforeAll(async () => { await initI18n() })

const membre = (o: Partial<CrewMember> = {}): CrewMember =>
  ({ id: 'm1', name: 'Rook Delane', role: 'tireur', trait: 'fidele', salary: 50, loyalty: 60, ...o })

function gs(extra: Partial<GameState> = {}): GameState {
  return { day: 4, credits: 1000, crew: [], crewHired: [], relics: [], currentStation: 'Port Méridien', ...extra } as unknown as GameState
}

describe('équipage', () => {

  it('propose des recrues stables pour une station un jour donné, et pas partout', () => {
    expect(getRecruits('Port Méridien', 7)).toEqual(getRecruits('Port Méridien', 7))
    const avecRecrues = getStations().filter(s => getRecruits(s.name, 3).length > 0).length / getStations().length
    expect(avecRecrues).toBeGreaterThan(0.45)
    expect(avecRecrues).toBeLessThan(0.9)
  })

  it('embauche contre une prime, dans la limite de trois', () => {
    const m = membre()
    const p = hireCrew(gs(), m)!
    expect(p.credits).toBe(1000 - hiringFee(m))
    expect(p.crew).toHaveLength(1)
    expect(hireCrew(gs({ credits: 10 }), m), 'pas assez de crédits').toBeNull()
    const plein = gs({ crew: [membre({ id: 'a' }), membre({ id: 'b' }), membre({ id: 'c' })] })
    expect(plein.crew.length).toBe(MAX_CREW)
    expect(hireCrew(plein, membre({ id: 'd' })), 'équipage complet').toBeNull()
    expect(fireCrew(plein, 'b').crew).toHaveLength(2)
  })

  it('chaque rôle a un effet réel, renforcé chez le vétéran', () => {
    for (const role of CREW_ROLES) {
      const avec = getPassiveMods(gs({ crew: [membre({ role })] }))
      const sans = getPassiveMods(gs())
      expect(JSON.stringify(avec), role).not.toBe(JSON.stringify(sans))
    }
    const normal = getPassiveMods(gs({ crew: [membre({ trait: 'fidele' })] })).dmgMult
    const veteran = getPassiveMods(gs({ crew: [membre({ trait: 'veteran' })] })).dmgMult
    expect(veteran).toBeGreaterThan(normal)
  })

  it('paie les salaires chaque jour et fidélise', () => {
    const { patch, lines } = tickCrewDay(gs({ crew: [membre(), membre({ id: 'm2', name: 'Maï Sorenth' })] }))
    expect(patch.credits).toBe(900)
    expect(patch.crew!.every(m => m.loyalty === 63)).toBe(true)
    expect(lines).toEqual([])
  })

  it('un équipage impayé perd sa loyauté, puis déserte en se servant', () => {
    let etat = gs({ credits: 30, crew: [membre({ trait: 'cupide', loyalty: 40 })] })
    const r1 = tickCrewDay(etat, () => 0.9)
    expect(r1.patch.crew![0].loyalty).toBe(20)
    expect(r1.lines.map(l => l.key)).toContain('unpaid')
    etat = { ...etat, ...r1.patch }
    const r2 = tickCrewDay(etat, () => 0.1)
    expect(r2.patch.crew).toHaveLength(0)
    expect(r2.lines.map(l => l.key)).toContain('deserted')
    expect(r2.patch.credits).toBeLessThan(30)
  })

  it('un combat perdu peut coûter un membre', () => {
    const etat = gs({ crew: [membre()] })
    expect(crewCasualty(etat, () => 0.1).patch.crew).toHaveLength(0)
    expect(crewCasualty(etat, () => 0.9).line).toBeNull()
  })

  it('a ses textes dans les deux langues', async () => {
    for (const lang of ['fr', 'en'] as const) {
      await setLanguage(lang)
      for (const role of CREW_ROLES) {
        expect(i18n.t(`role.${role}`, { ns: 'crew' }), lang + role).not.toContain('role.')
        expect(i18n.t(`effect.${role}`, { ns: 'crew' }), lang + role).not.toContain('effect.')
      }
    }
    await setLanguage('fr')
  })
})
