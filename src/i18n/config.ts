import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const STORAGE_KEY = 'vt_language'

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

export function detectInitialLanguage(): SupportedLanguage {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'fr' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

// Les ressources de chaque langue sont dans un module dédié importé
// dynamiquement : Vite en fait un chunk séparé, donc on ne télécharge que la
// langue réellement utilisée (~600 Ko économisés sur le chargement initial).
async function loadLanguageResources(lang: SupportedLanguage) {
  if (i18n.hasResourceBundle(lang, 'common')) return
  const mod = lang === 'fr'
    ? await import('./resources.fr')
    : await import('./resources.en')
  const bundles = mod.default as Record<string, Record<string, unknown>>
  for (const [ns, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lang, ns, resources, true, true)
  }
}

// À appeler (et attendre) avant le premier rendu React — sinon les écrans
// s'afficheraient avec des clés brutes le temps du chargement.
export async function initI18n(): Promise<void> {
  const lng = detectInitialLanguage()
  await i18n.use(initReactI18next).init({
    resources: {},
    lng,
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  })
  await loadLanguageResources(lng)
}

// Charge la langue cible AVANT de basculer, pour éviter tout rendu intermédiaire
// avec des clés manquantes.
export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  await loadLanguageResources(lang)
  await i18n.changeLanguage(lang)
  localStorage.setItem(STORAGE_KEY, lang)
}

export default i18n
