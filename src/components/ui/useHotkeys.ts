// Raccourcis clavier globaux.
//
//  - Hub : chaque bouton de navigation porte sa touche (data-hotkey : M marché,
//    V voyage, C carte, I inventaire, Q quêtes, J journal). Le raccourci
//    clique le vrai bouton : désactivé, il ne fait rien.
//  - Combat : 1 à 9 déclenchent les actions dans l'ordre d'affichage
//    (conteneur data-hotkeys="numbered").
//  - Espace : passe ce qui peut l'être (texte défilant, vol, pile ou
//    face — éléments data-skip).
//  - Échap : retour au hub depuis les écrans secondaires.
//
// Rien ne se déclenche quand on tape dans un champ, ni avec un modificateur.
import { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'

const ECRANS_RETOUR = new Set(['market', 'travel', 'inventory', 'quests', 'map', 'journal', 'factions', 'objectives', 'lore', 'crafting', 'ship-workshop', 'nexus'])

function cliquer(el: Element | null): boolean {
  if (el instanceof HTMLElement && !(el as HTMLButtonElement).disabled) { el.click(); return true }
  return false
}

export function useHotkeys() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable)) return
      const { gs, goTo } = useGameStore.getState()
      if (!gs) return

      // Passer : la scène au premier plan d'abord (pile ou face), puis le reste.
      if (e.key === ' ') {
        const aPasser = document.querySelector('.coinflip-backdrop[data-skip="true"]') ?? document.querySelector('[data-skip="true"]')
        if (aPasser && cliquer(aPasser)) { e.preventDefault(); return }
        return
      }
      // Un pile ou face ou un choix de relique en cours bloque les autres touches.
      if (document.querySelector('.coinflip-backdrop') || gs.pendingRelicChoice) return

      if (e.key === 'Escape' && ECRANS_RETOUR.has(gs.screen)) { goTo('station-hub'); return }

      if (/^[1-9]$/.test(e.key)) {
        const zone = document.querySelector('[data-hotkeys="numbered"]')
        if (!zone) return
        const boutons = Array.from(zone.querySelectorAll('button')).filter(b => !b.disabled)
        if (cliquer(boutons[Number(e.key) - 1] ?? null)) e.preventDefault()
        return
      }

      if (gs.screen === 'station-hub' && /^[a-z]$/i.test(e.key)) {
        if (cliquer(document.querySelector(`[data-hotkey="${e.key.toLowerCase()}"]`))) e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
