/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from 'vitest'
import i18n, { initI18n, setLanguage } from '../i18n/config'
import { buildTutorialQuest } from '../engine/quests'
import { questTitle, questDescription } from '../engine/questI18n'

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
})
