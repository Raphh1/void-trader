// Messages échangés avec le serveur de salons (server/index.mjs).
//
// Le serveur relaie des textes écrits par d'autres joueurs (pseudos, noms de
// station) : tout message reçu est vérifié avant d'entrer dans le jeu, et ce
// qui ne colle pas au format attendu est ignoré.

export type MpStatus = 'lobby' | 'playing' | 'dead' | 'won'

export interface MpPlayer {
  id: string
  name: string
  online: boolean
  station: string | null
  day: number
  credits: number
  className: string | null
  fragments: number
  status: MpStatus
}

export type MpEvent =
  | { kind: 'trade'; by: string; byId: string; station: string; item: string; side: 'buy' | 'sell'; mult: number }
  | { kind: 'join' | 'leave' | 'dead' | 'won'; name: string }
  | { kind: 'gift'; from: string; to: string; amount: number }

export type ServerMsg =
  | { t: 'welcome'; code: string; you: string; token: string; sync: boolean }
  | { t: 'room'; code: string; sync: boolean; started: boolean; players: MpPlayer[] }
  | { t: 'event'; e: MpEvent }
  | { t: 'gift'; from: string; amount: number }
  | { t: 'gift-sent'; to: string; amount: number }
  | { t: 'error'; code: string }

/** Ce que les autres voient de ta partie. */
export interface PublicState {
  station: string | null
  day: number
  credits: number
  className: string | null
  fragments: number
  status: MpStatus
}

export const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _'.-]{0,15}$/u
export const CODE_RE = /^[A-Z0-9]{5}$/

const STATUSES: readonly string[] = ['lobby', 'playing', 'dead', 'won']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = 60): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const int = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

function parsePlayer(v: unknown): MpPlayer | null {
  if (!isObj(v)) return null
  const { id, name, online, station, day, credits, className, fragments, status } = v
  if (!str(id, 32) || !str(name, 16) || typeof online !== 'boolean') return null
  if (!(station === null || str(station)) || !(className === null || str(className))) return null
  if (!int(day) || !int(credits) || !int(fragments) || typeof status !== 'string' || !STATUSES.includes(status)) return null
  return { id, name, online, station, day, credits, className, fragments, status: status as MpStatus }
}

function parseEvent(v: unknown): MpEvent | null {
  if (!isObj(v)) return null
  switch (v.kind) {
    case 'trade': {
      const { by, byId, station, item, side, mult } = v
      if (!str(by, 16) || !str(byId, 32) || !str(station) || !str(item) || (side !== 'buy' && side !== 'sell')) return null
      if (typeof mult !== 'number' || !(mult >= 0.5 && mult <= 1.5)) return null
      return { kind: 'trade', by, byId, station, item, side, mult }
    }
    case 'join': case 'leave': case 'dead': case 'won':
      return str(v.name, 16) ? { kind: v.kind, name: v.name } : null
    case 'gift':
      return str(v.from, 16) && str(v.to, 16) && int(v.amount) ? { kind: 'gift', from: v.from, to: v.to, amount: v.amount } : null
    default:
      return null
  }
}

export function parseServerMsg(raw: string): ServerMsg | null {
  let v: unknown
  try { v = JSON.parse(raw) } catch { return null }
  if (!isObj(v)) return null
  switch (v.t) {
    case 'welcome':
      return str(v.code, 5) && str(v.you, 32) && str(v.token, 64) && typeof v.sync === 'boolean'
        ? { t: 'welcome', code: v.code, you: v.you, token: v.token, sync: v.sync } : null
    case 'room': {
      if (!str(v.code, 5) || typeof v.sync !== 'boolean' || typeof v.started !== 'boolean' || !Array.isArray(v.players)) return null
      const players = v.players.map(parsePlayer)
      return players.every((p): p is MpPlayer => p !== null) ? { t: 'room', code: v.code, sync: v.sync, started: v.started, players } : null
    }
    case 'event': {
      const e = parseEvent(v.e)
      return e ? { t: 'event', e } : null
    }
    case 'gift':
      return str(v.from, 16) && int(v.amount) ? { t: 'gift', from: v.from, amount: v.amount } : null
    case 'gift-sent':
      return str(v.to, 16) && int(v.amount) ? { t: 'gift-sent', to: v.to, amount: v.amount } : null
    case 'error':
      return str(v.code, 32) ? { t: 'error', code: v.code } : null
    default:
      return null
  }
}

/**
 * Joueurs que tu attends avant de commencer ta journée : ceux, en ligne et
 * encore en course, qui n'ont pas fini la journée précédente. Un joueur qui
 * n'a pas encore lancé sa partie compte comme étant au jour 1.
 */
export function playersToWaitFor(players: MpPlayer[], you: string | null, myDay: number): MpPlayer[] {
  const me = players.find(p => p.id === you)
  if (!me || me.status === 'dead' || me.status === 'won') return []
  return players.filter(p =>
    p.id !== you && p.online && (p.status === 'lobby' || p.status === 'playing')
    && (p.status === 'lobby' ? 1 : p.day) < myDay)
}
