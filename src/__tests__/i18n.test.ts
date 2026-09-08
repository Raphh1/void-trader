import { describe, it, expect, beforeAll } from 'vitest'
import i18n, { initI18n, setLanguage, SUPPORTED_LANGUAGES } from '../i18n/config'
import { loadNarrativeContent } from '../engine/jsonEventLoader'
import { getStations } from '../data/stations'
import { getClasses } from '../data/classes'
import { getTierLow } from '../data/enemies'
import {
  translateGood, translateStationName, translateClassName,
  translateWeaponName, translateEnemyName, translateNpcRole,
} from '../engine/goodsI18n'
import frResources from '../i18n/resources.fr'
import enResources from '../i18n/resources.en'

beforeAll(async () => {
  await initI18n()
})

describe('chargement des langues à la demande', () => {
  it('démarre avec la langue détectée et ses ressources chargées', () => {
    expect(SUPPORTED_LANGUAGES).toContain(i18n.language)
    expect(i18n.hasResourceBundle(i18n.language, 'common')).toBe(true)
  })

  it('charge les ressources de la langue cible AVANT de basculer', async () => {
    await setLanguage('fr')
    expect(i18n.language).toBe('fr')
    expect(i18n.hasResourceBundle('fr', 'stationHub')).toBe(true)

    await setLanguage('en')
    expect(i18n.language).toBe('en')
    expect(i18n.hasResourceBundle('en', 'stationHub')).toBe(true)
  })

  it('expose exactement les mêmes namespaces en FR et EN', () => {
    expect(Object.keys(frResources).sort()).toEqual(Object.keys(enResources).sort())
  })
})

describe('les données traduites suivent le changement de langue', () => {
  // Régression du bug récurrent du projet : une structure de données construite
  // au chargement du module fige son texte dans la langue de démarrage. Tous les
  // getX() doivent renvoyer du texte recalculé à chaque appel.
  it('getStations() renvoie des descriptions dans la langue active', async () => {
    await setLanguage('fr')
    const fr = getStations()[0].description
    await setLanguage('en')
    const en = getStations()[0].description

    expect(fr).toBeTruthy()
    expect(en).toBeTruthy()
    expect(en).not.toBe(fr)
  })

  it('getClasses() renvoie des descriptions dans la langue active', async () => {
    await setLanguage('fr')
    const fr = getClasses()[0].description
    await setLanguage('en')
    const en = getClasses()[0].description

    expect(en).not.toBe(fr)
  })

  // Les données d'ennemis et de stations sont mémoïsées par langue pour éviter
  // de reconstruire 161 ennemis à chaque rencontre. Ces tests garantissent que
  // le cache s'invalide bien au changement de langue — sinon on retomberait
  // exactement sur le bug de texte figé.
  it('invalide le cache des ennemis au changement de langue', async () => {
    await setLanguage('fr')
    const fr = getTierLow()[0].description
    await setLanguage('en')
    const en = getTierLow()[0].description

    expect(fr).toBeTruthy()
    expect(en).not.toBe(fr)
  })

  it('resert la même langue de façon stable (le cache ne se dégrade pas)', async () => {
    await setLanguage('en')
    const first = getTierLow()[0].description
    const second = getTierLow()[0].description
    await setLanguage('fr')
    await setLanguage('en')
    const afterRoundTrip = getTierLow()[0].description

    expect(second).toBe(first)
    expect(afterRoundTrip).toBe(first)
  })
})

describe('couche de traduction à l\'affichage seulement', () => {
  // L'invariant central du jeu : les noms servent de clés de données (cargo,
  // pathfinding, matching de quêtes) et doivent rester en français, seul
  // l'affichage est traduit.
  it('traduit les noms à l\'affichage sans toucher aux clés de données', async () => {
    await setLanguage('en')
    expect(translateGood('Nourriture synthétique')).toBe('Synthetic food')
    expect(translateStationName('La Carcasse')).not.toBe('La Carcasse')
    expect(translateClassName('Marchand')).toBe('Merchant')

    // La donnée source, elle, n'a pas bougé.
    const station = getStations().find(s => s.name === 'La Carcasse')
    expect(station).toBeDefined()
    expect(getClasses().some(c => c.name === 'Marchand')).toBe(true)
  })

  it('rend le nom français tel quel en mode FR', async () => {
    await setLanguage('fr')
    expect(translateGood('Nourriture synthétique')).toBe('Nourriture synthétique')
    expect(translateClassName('Marchand')).toBe('Marchand')
  })

  it('retombe sur la valeur d\'origine pour un nom inconnu', async () => {
    await setLanguage('en')
    // Un objet/PNJ non répertorié ne doit jamais afficher une clé brute.
    expect(translateGood('Objet Inexistant')).toBe('Objet Inexistant')
    expect(translateEnemyName('Ennemi Inexistant')).toBe('Ennemi Inexistant')
    expect(translateWeaponName('Arme Inexistante')).toBe('Arme Inexistante')
    expect(translateNpcRole('Rôle Inexistant')).toBe('Rôle Inexistant')
  })
})

describe('contenu narratif chargé par langue', () => {
  it('charge le contenu des deux langues sans erreur', async () => {
    await expect(loadNarrativeContent('fr')).resolves.toBeUndefined()
    await expect(loadNarrativeContent('en')).resolves.toBeUndefined()
  })
})
