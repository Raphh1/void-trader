import i18n from '../i18n/config'
import type { GameState, JournalEntry, JournalText, JournalParam } from '../types'
import { translateEnemyName, translateFactionName, translateStationName } from './goodsI18n'

let _idCounter = 0

// Les entrées du journal restent dans la sauvegarde : on y garde la CLÉ de
// traduction et les paramètres bruts (noms de station/ennemi/faction en
// français, clés de données) plutôt que le texte rendu, pour que le journal
// suive la langue active au moment où on le lit.
export const jt = (ns: string, key: string, params?: Record<string, JournalParam>): JournalText => ({ ns, key, params })
export const jStation = (name: string): JournalParam => ({ tr: 'station', v: name })
export const jEnemy   = (name: string): JournalParam => ({ tr: 'enemy', v: name })
export const jFaction = (name: string): JournalParam => ({ tr: 'faction', v: name })

function resolveParam(p: JournalParam): string | number {
  if (typeof p !== 'object') return p
  if ('ns' in p) return renderJournalText(p)
  if (p.tr === 'station') return translateStationName(p.v)
  if (p.tr === 'enemy')   return translateEnemyName(p.v)
  return translateFactionName(p.v)
}

export function renderJournalText(text: JournalText): string {
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(text.params ?? {})) params[k] = resolveParam(v)
  return i18n.t(text.key, { ns: text.ns, ...params })
}

/** Texte d'une entrée dans la langue active (les vieilles sauvegardes n'ont que `text`). */
export function journalEntryText(entry: JournalEntry): string {
  return entry.i18n ? renderJournalText(entry.i18n) : entry.text
}

export function addJournal(
  gs: GameState,
  text: JournalText,
  category: JournalEntry['category'] = 'event'
): JournalEntry[] {
  const entry: JournalEntry = {
    id: ++_idCounter + Date.now(),
    day: gs.day,
    station: gs.currentStation,
    text: renderJournalText(text),
    i18n: text,
    category,
  }
  return [...(gs.journal ?? []), entry]
}
