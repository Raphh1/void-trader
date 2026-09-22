/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from 'vitest'
import i18n, { initI18n, setLanguage } from '../i18n/config'
import { buildTutorialQuest, generateFactionMission, generateNpcQuest } from '../engine/quests'
import { questTitle, questDescription, questGiver } from '../engine/questI18n'
import { localizeMajorQuest, getMajorQuestForNpc } from '../engine/majorQuests'
import { getActiveEvents } from '../engine/worldEvents'
import { translateFactionName } from '../engine/goodsI18n'
import { addJournal, jt, jStation, journalEntryText } from '../engine/journal'
import type { GameState, WorldEvent } from '../types'

// Deux fuites de traduction observées en jeu, sur une capture d'écran :
//  1. une quête générée en français restait en français après un passage en
//     anglais — son texte était rendu à la génération puis persisté tel quel ;
//  2. des noms de stations français traînaient dans la prose anglaise
//     (« A blacksmith from La Carcasse… »), alors que l'interface affichait
//     « The Wreckyard » pour la même station.

beforeAll(async () => { await initI18n() })

describe('fuites de traduction', () => {

  it('retraduit le texte des quêtes quand la langue change', async () => {
    await setLanguage('fr')
    const quete = buildTutorialQuest('La Carcasse')
    const titreFr = questTitle(quete)
    const descFr = questDescription(quete)

    await setLanguage('en')
    const titreEn = questTitle(quete)
    const descEn = questDescription(quete)

    // Le même objet de quête, sans régénération, doit changer de langue.
    expect(titreEn, 'le titre reste figé dans la langue de génération').not.toBe(titreFr)
    expect(descEn, 'la description reste figée dans la langue de génération').not.toBe(descFr)

    // Et les noms interpolés doivent suivre : la station de départ est
    // « La Carcasse » en français, « The Wreckyard » en anglais.
    expect(descFr).toContain('La Carcasse')
    expect(descEn).toContain('The Wreckyard')
    expect(descEn, 'nom de station français dans le texte anglais').not.toContain('La Carcasse')

    await setLanguage('fr')
  })

  it('ne laisse aucun nom de station français dans le contenu anglais', async () => {
    await setLanguage('en')

    // Table FR → EN telle que l'interface l'utilise réellement.
    const stationsEn = i18n.getResourceBundle('en', 'stations') as { names?: Record<string, string> }
    const stationsFr = i18n.getResourceBundle('fr', 'stations') as { names?: Record<string, string> }
    const aTraduire: [string, string][] = []
    for (const [cle, nomFr] of Object.entries(stationsFr?.names ?? {})) {
      const nomEn = stationsEn?.names?.[cle]
      // Seuls comptent les noms qui DIFFÈRENT : beaucoup restent identiques
      // (Fort Kharos, Sanctum Machina…) et ne sont donc pas des fuites.
      if (nomEn && nomEn !== nomFr && nomFr.length >= 5) aTraduire.push([nomFr, nomEn])
    }
    expect(aTraduire.length, 'table de stations introuvable').toBeGreaterThan(10)

    const modules = import.meta.glob('../i18n/locales/en/*.json', { import: 'default', eager: true }) as Record<string, unknown>
    const fuites: string[] = []

    for (const [chemin, contenu] of Object.entries(modules)) {
      if (chemin.endsWith('stations.json')) continue // c'est la table elle-même
      // On n'inspecte que les VALEURS : les clés d'objet sont des identifiants
      // de données, volontairement restés en français.
      const valeurs: string[] = []
      const parcourir = (n: unknown): void => {
        if (typeof n === 'string') valeurs.push(n)
        else if (Array.isArray(n)) n.forEach(parcourir)
        else if (n && typeof n === 'object') Object.values(n).forEach(parcourir)
      }
      parcourir(contenu)
      const texte = valeurs.join('\n')
      for (const [fr] of aTraduire) {
        const re = new RegExp('(?<![\\w-])' + fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])')
        if (re.test(texte)) fuites.push(chemin.split('/').pop() + ' : ' + fr)
      }
    }

    await setLanguage('fr')
    expect(fuites, 'nom(s) de station français dans le contenu anglais :\n' + fuites.join('\n'))
      .toEqual([])
  })

  // Même défaut que le tutoriel, sur les autres familles de quêtes : texte rendu
  // à la génération et persisté. Chaque famille doit changer de langue à l'affichage.
  it('retraduit les missions de faction, quêtes de PNJ et donneurs génériques', async () => {
    const gs = { currentStation: 'Port Méridien', activeQuests: [], day: 5, majorQuests: [], npcsMet: [], reputation: 100, faction: null } as unknown as GameState
    await setLanguage('fr')
    const mission = generateFactionMission(gs, 'emporium')!
    const pnj = generateNpcQuest(gs, 'Marek', 'Ferrailleur', 'La Carcasse')!
    expect(mission && pnj, 'génération impossible').toBeTruthy()
    const fr = [questTitle(mission), questDescription(mission), questGiver(mission), questDescription(pnj)]

    await setLanguage('en')
    const en = [questTitle(mission), questDescription(mission), questGiver(mission), questDescription(pnj)]
    fr.forEach((texte, i) => expect(en[i], 'resté figé : ' + texte).not.toBe(texte))
    expect(questGiver(mission)).toBe('Emporium Agent')
    await setLanguage('fr')
  })

  it("met le vrai boss de la station dans les contrats d'élimination", async () => {
    await setLanguage('en')
    const gs = { currentStation: 'Arc Ouest Apocalypse', activeQuests: [], day: 5 } as unknown as GameState
    // Les Faucons ciblent notamment La Citadelle Écarlate, dont le boss est Commandante Zara Sable.
    for (let i = 0; i < 200; i++) {
      const q = generateFactionMission(gs, 'faucons')
      if (q?.type === 'kill' && q.targetStation === 'La Citadelle Écarlate') {
        expect(questTitle(q)).toContain('Commander Zara Sable')
        await setLanguage('fr')
        return
      }
    }
    await setLanguage('fr')
    throw new Error("aucun contrat d'élimination sur La Citadelle Écarlate en 200 tirages")
  })

  it('retraduit les missions majeures, événements mondiaux et autorités', async () => {
    await setLanguage('fr')
    const gsQuete = { majorQuests: [], npcsMet: [], reputation: 999, faction: null } as unknown as GameState
    const majeure = getMajorQuestForNpc(gsQuete, 'Murn')!
    const evt = { id: 'epidemic', title: 'Épidémie (figé)', description: 'x', shortDesc: 'x', startDay: 1, duration: 5, color: '', effects: {} } as WorldEvent
    const gs = { activeWorldEvents: [evt], day: 2 } as unknown as GameState

    await setLanguage('en')
    expect(localizeMajorQuest(majeure).title).toBe('The Ash Road')
    expect(getActiveEvents(gs)[0].title).not.toBe('Épidémie (figé)')
    expect(translateFactionName('Soldats de Raphazarus')).toBe("Raphazarus's soldiers")
    expect(translateFactionName('Autorités locales')).toBe('Local authorities')
    await setLanguage('fr')
  })

  // Le journal de bord est persisté : l'entrée garde sa clé et ses paramètres
  // bruts, et doit se relire dans la langue active.
  it('retraduit le journal de bord quand la langue change', async () => {
    await setLanguage('fr')
    const gs = { day: 3, currentStation: 'La Carcasse', journal: [] } as unknown as GameState
    const [entree] = addJournal(gs, jt('gameStore', 'travelJournal', { from: jStation('La Carcasse'), to: jStation('Fort Kharos') }), 'travel')
    const texteFr = journalEntryText(entree)
    expect(texteFr).toContain('La Carcasse')

    await setLanguage('en')
    const texteEn = journalEntryText(entree)
    expect(texteEn, 'entrée figée dans la langue de création').not.toBe(texteFr)
    expect(texteEn).toContain('The Wreckyard')
    await setLanguage('fr')
  })
})
