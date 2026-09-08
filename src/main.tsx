import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n, detectInitialLanguage } from './i18n/config'
import { loadNarrativeContent } from './engine/jsonEventLoader'
import App from './App.tsx'

// Traductions et contenu narratif sont chargés dynamiquement pour la seule
// langue active. On attend qu'ils soient prêts avant le premier rendu, sinon
// l'UI s'afficherait brièvement avec des clés brutes et sans événements.
async function bootstrap() {
  await Promise.all([initI18n(), loadNarrativeContent(detectInitialLanguage())])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
