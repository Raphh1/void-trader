import type { GameState } from '../types'
import { interpretOutcome } from './outcomeInterpreter'
import type { WanderEvent, ExploreChoice, ExploreResult } from './exploration'

import i18n from '../i18n/config'
import type { SupportedLanguage } from '../i18n/config'

// ── Types JSON ───────────────────────────────────────────────────────────────

interface JsonChoice { label: string; flavor: string; outcome: string }
interface JsonEvent  { setup: string; choices: JsonChoice[] }

// Le contenu narratif (~340 Ko) est chargé dynamiquement pour la seule langue
// active : Vite en fait des chunks séparés, un joueur ne télécharge donc pas les
// deux versions. `loadNarrativeContent()` doit être attendu avant le premier
// rendu (voir main.tsx) et à chaque changement de langue.
let wander: Record<string, JsonEvent[]> = {}
let exploration: Record<string, JsonEvent[]> = {}
let ambiance: Record<string, string[]> = {}

export async function loadNarrativeContent(lang: SupportedLanguage): Promise<void> {
  const [w, e, a] = lang === 'en'
    ? await Promise.all([
        import('../Content/wander.en.json'),
        import('../Content/exploration.en.json'),
        import('../Content/ambiance.en.json'),
      ])
    : await Promise.all([
        import('../Content/wander.fr.json'),
        import('../Content/exploration.fr.json'),
        import('../Content/ambiance.fr.json'),
      ])
  wander      = w.default as unknown as Record<string, JsonEvent[]>
  exploration = e.default as unknown as Record<string, JsonEvent[]>
  ambiance    = a.default as unknown as Record<string, string[]>
}

function getWander(): Record<string, JsonEvent[]> {
  return wander
}

function getExploration(): Record<string, JsonEvent[]> {
  return exploration
}

// ── Ambiance ─────────────────────────────────────────────────────────────────

export function getAmbiance(stationName: string): string | null {
  const lines = ambiance[stationName]
  if (!lines || lines.length === 0) return null
  return lines[Math.floor(Math.random() * lines.length)]
}

// ── Convertisseur ─────────────────────────────────────────────────────────────

function titleFromSetup(setup: string): string {
  const first = setup.split(/[.!?]/)[0].trim()
  return first.length > 55 ? first.slice(0, 55) + '…' : first
}

function convertJsonChoices(choices: JsonChoice[]): WanderEvent['choices'] {
  return choices.map(c => ({
    label: c.label,
    result: (gs?: GameState) => {
      if (!gs) return { gs: {}, message: c.flavor }
      const r = interpretOutcome(c.outcome, gs)
      const suffix = r.message ? ` [${r.message}]` : ''
      return { gs: r.gs, message: c.flavor + suffix, type: r.type }
    },
  }))
}

function convertToWander(events: JsonEvent[]): Array<(gs: GameState) => WanderEvent> {
  return events.map(ev => (_gs: GameState) => ({
    title:       titleFromSetup(ev.setup),
    description: ev.setup,
    choices:     convertJsonChoices(ev.choices),
  }))
}

// ── Wander pools par danger ────────────────────────────────────────────────────
// danger 0 → low + generic
// danger 1 → low + mid + generic
// danger 2 → mid + high + generic
// danger 3 → high + generic

export function getJsonWanderLow(): Array<(gs: GameState) => WanderEvent> {
  const wander = getWander()
  return convertToWander([...(wander.low ?? []), ...(wander.generic ?? [])])
}
export function getJsonWanderMid(): Array<(gs: GameState) => WanderEvent> {
  const wander = getWander()
  return convertToWander([...(wander.low ?? []), ...(wander.mid ?? []), ...(wander.generic ?? [])])
}
export function getJsonWanderHigh(): Array<(gs: GameState) => WanderEvent> {
  const wander = getWander()
  return convertToWander([...(wander.mid ?? []), ...(wander.high ?? []), ...(wander.generic ?? [])])
}
export function getJsonWanderExtreme(): Array<(gs: GameState) => WanderEvent> {
  const wander = getWander()
  return convertToWander([...(wander.high ?? []), ...(wander.generic ?? [])])
}

// ── Exploration events → ExploreResult type 'event' ──────────────────────────

function convertToExploreChoices(jsonChoices: JsonChoice[]): ExploreChoice[] {
  return jsonChoices.map(c => ({
    label: c.label,
    result: (gs: GameState) => {
      const r = interpretOutcome(c.outcome, gs)
      const suffix = r.message ? ` [${r.message}]` : ''
      return { gs: r.gs, message: c.flavor + suffix, type: r.type as 'combat' | undefined }
    },
  }))
}

function convertToExploreScene(events: JsonEvent[]): Array<() => ExploreResult> {
  return events.map(ev => (): ExploreResult => ({
    type:        'event',
    description: ev.setup,
    choices:     convertToExploreChoices(ev.choices),
  }))
}

// Pools par type de station — utilisables dans les SCENES_* de exploration.ts
export function getJsonExploreDangerous():  Array<() => ExploreResult> { return convertToExploreScene(getExploration().dangerous  ?? []) }
export function getJsonExplorePeaceful():   Array<() => ExploreResult> { return convertToExploreScene(getExploration().peaceful   ?? []) }
export function getJsonExploreIndustrial(): Array<() => ExploreResult> { return convertToExploreScene(getExploration().industrial ?? []) }
export function getJsonExploreScientific(): Array<() => ExploreResult> { return convertToExploreScene(getExploration().scientific ?? []) }
export function getJsonExploreRuins():      Array<() => ExploreResult> { return convertToExploreScene(getExploration().ruins      ?? []) }
export function getJsonExploreMilitary():   Array<() => ExploreResult> { return convertToExploreScene(getExploration().military   ?? []) }
export function getJsonExploreLuxury():     Array<() => ExploreResult> { return convertToExploreScene(getExploration().luxury     ?? []) }
export function getJsonExploreGeneric():    Array<() => ExploreResult> { return convertToExploreScene(getExploration().generic    ?? []) }
