// Multijoueur : connexion au serveur de salons et état partagé du salon.
//
// Chaque joueur garde sa partie dans son navigateur (gameStore). Ce store ne
// tient que la couche commune : qui est dans le salon, où, à quel jour, et le
// fil des nouvelles. Il ne connaît pas gameStore — le pont entre les deux
// (components/ui/Multiplayer.tsx) remplit `gameHooks` pour lire l'état public
// du joueur et appliquer ce qui vient des autres (prix, dons).
import { create } from 'zustand'
import type { CompetitorNews } from '../types'
import { parseServerMsg, playersToWaitFor, NAME_RE, CODE_RE, type MpPlayer, type MpEvent, type PublicState, type ServerMsg } from '../net/protocol'

const SESSION_KEY = 'vt_mp_session'
const SERVER_KEY = 'vt_mp_server'
const FEED_MAX = 8
const NEWS_MAX = 4
const RETRY_DELAYS = [1000, 2000, 5000, 10000]
const STATE_DEBOUNCE_MS = 250

export interface MpSession { server: string; code: string; token: string; name: string }
export type MpConn = 'idle' | 'connecting' | 'online' | 'reconnecting'

interface MultiState {
  conn: MpConn
  error: string | null
  session: MpSession | null
  you: string | null
  sync: boolean
  started: boolean
  players: MpPlayer[]
  feed: CompetitorNews[]
}

function loadSession(): MpSession | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Partial<MpSession> | null
    return v && typeof v.server === 'string' && typeof v.code === 'string' && typeof v.token === 'string' && typeof v.name === 'string'
      ? { server: v.server, code: v.code, token: v.token, name: v.name } : null
  } catch { return null }
}

function saveSession(s: MpSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* stockage indisponible : la session ne survivra pas au rechargement */ }
}

export const useMultiStore = create<MultiState>()(() => ({
  conn: 'idle', error: null, session: loadSession(), you: null, sync: true, started: false, players: [], feed: [],
}))

const set = useMultiStore.setState
const get = useMultiStore.getState

export const gameHooks: {
  getState?: () => PublicState
  onTrade?: (e: Extract<MpEvent, { kind: 'trade' }>) => void
  onGift?: (from: string, amount: number) => void
  onGiftSent?: (to: string, amount: number) => void
} = {}

let ws: WebSocket | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retries = 0
let stateTimer: ReturnType<typeof setTimeout> | null = null
let lastSentState = ''
let pendingNews: CompetitorNews[] = []
let tradesDay = 0
const reportedTrades = new Set<string>()

function sendRaw(msg: object) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

/** Ferme la connexion sans déclencher de reconnexion. */
function disconnect() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  const sock = ws
  ws = null
  if (sock && (sock.readyState === WebSocket.CONNECTING || sock.readyState === WebSocket.OPEN)) sock.close()
}

function connect(server: string, hello: object, name: string) {
  disconnect()
  let sock: WebSocket
  try { sock = new WebSocket(server) } catch { set({ conn: 'idle', error: 'bad_server' }); return }
  ws = sock
  sock.onopen = () => sock.send(JSON.stringify(hello))
  sock.onmessage = ev => {
    if (ws !== sock || typeof ev.data !== 'string') return
    const msg = parseServerMsg(ev.data)
    if (msg) onMessage(msg, server, name)
  }
  sock.onclose = ev => {
    if (ws !== sock) return
    ws = null
    onClosed(ev.code)
  }
}

function onClosed(code: number) {
  // Partie rouverte dans un autre onglet : c'est lui qui joue désormais.
  if (code === 4000) { set({ conn: 'idle', error: 'replaced' }); return }
  if (get().session) {
    set({ conn: 'reconnecting' })
    const delay = RETRY_DELAYS[Math.min(retries, RETRY_DELAYS.length - 1)]
    retries++
    retryTimer = setTimeout(() => { retryTimer = null; resumeSession() }, delay)
    return
  }
  set({ conn: 'idle', error: get().error ?? 'unreachable' })
}

function newsOf(e: MpEvent): CompetitorNews {
  switch (e.kind) {
    case 'trade': return { key: e.side === 'buy' ? 'news.bought' : 'news.dumped', params: { name: e.by, item: e.item, station: e.station } }
    case 'gift':  return { key: 'multiplayer:news.gift', params: { name: e.from, to: e.to, amount: e.amount } }
    default:      return { key: `multiplayer:news.${e.kind}`, params: { name: e.name } }
  }
}

function onMessage(msg: ServerMsg, server: string, name: string) {
  switch (msg.t) {
    case 'welcome': {
      const session = { server, code: msg.code, token: msg.token, name }
      saveSession(session)
      retries = 0
      lastSentState = ''
      set({ conn: 'online', error: null, session, you: msg.you, sync: msg.sync })
      pushStateNow()
      break
    }
    case 'room':
      set({ players: msg.players, sync: msg.sync, started: msg.started })
      break
    case 'event': {
      const news = newsOf(msg.e)
      set(s => ({ feed: [news, ...s.feed].slice(0, FEED_MAX) }))
      // Arrivées et départs restent dans le fil du salon ; le briefing ne garde que ce qui compte.
      if (msg.e.kind !== 'join' && msg.e.kind !== 'leave') pendingNews = [...pendingNews, news].slice(-NEWS_MAX)
      if (msg.e.kind === 'trade') gameHooks.onTrade?.(msg.e)
      break
    }
    case 'gift':
      gameHooks.onGift?.(msg.from, msg.amount)
      break
    case 'gift-sent':
      gameHooks.onGiftSent?.(msg.to, msg.amount)
      break
    case 'error':
      if (get().conn === 'online') {
        // Refus ponctuel (don manqué…) : affiché un instant, la partie continue.
        const code = msg.code
        set({ error: code })
        setTimeout(() => { if (get().error === code) set({ error: null }) }, 4000)
        break
      }
      // Refus à l'entrée : on ne réessaie pas, le joueur doit corriger (code, pseudo…).
      disconnect()
      set({ conn: 'idle', error: msg.code === 'room_not_found' && get().session ? 'room_lost' : msg.code })
      break
  }
}

function pushStateNow() {
  const s = gameHooks.getState?.()
  if (!s || get().conn !== 'online') return
  const json = JSON.stringify(s)
  if (json === lastSentState) return
  lastSentState = json
  sendRaw({ t: 'state', ...s })
}

/** Adresse du serveur : dernière utilisée, sinon celle du build, sinon la machine qui sert le jeu. */
export function getDefaultServer(): string {
  try {
    const saved = localStorage.getItem(SERVER_KEY)
    if (saved) return saved
  } catch { /* stockage indisponible */ }
  if (import.meta.env?.VITE_MP_SERVER) return import.meta.env.VITE_MP_SERVER
  const secure = typeof location !== 'undefined' && location.protocol === 'https:'
  const host = typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost'
  return `${secure ? 'wss' : 'ws'}://${host}:8787`
}

export function normalizeServerUrl(raw: string): string | null {
  const s = raw.trim()
  if (s.length === 0 || s.length > 200) return null
  try {
    const u = new URL(s)
    return u.protocol === 'ws:' || u.protocol === 'wss:' ? u.toString().replace(/\/$/, '') : null
  } catch { return null }
}

function startHandshake(rawServer: string, rawName: string, hello: (name: string) => object) {
  const name = rawName.trim()
  const server = normalizeServerUrl(rawServer)
  if (!NAME_RE.test(name)) { set({ error: 'bad_name' }); return }
  if (!server) { set({ error: 'bad_server' }); return }
  try { localStorage.setItem(SERVER_KEY, server) } catch { /* stockage indisponible */ }
  set({ conn: 'connecting', error: null })
  connect(server, hello(name), name)
}

export function createRoom(server: string, name: string, sync: boolean) {
  startHandshake(server, name, n => ({ t: 'create', name: n, sync }))
}

export function joinRoom(server: string, rawCode: string, name: string) {
  const code = rawCode.trim().toUpperCase()
  if (!CODE_RE.test(code)) { set({ error: 'bad_code' }); return }
  startHandshake(server, name, n => ({ t: 'join', code, name: n }))
}

/** Reprend la place du joueur dans son salon (rechargement de page, coupure réseau). */
export function resumeSession() {
  const { session, conn } = get()
  if (!session || conn === 'online' || conn === 'connecting') return
  if (conn !== 'reconnecting') set({ conn: 'connecting', error: null })
  connect(session.server, { t: 'resume', code: session.code, token: session.token }, session.name)
}

export function leaveRoom() {
  sendRaw({ t: 'leave' })
  disconnect()
  saveSession(null)
  pendingNews = []
  reportedTrades.clear()
  set({ conn: 'idle', error: null, session: null, you: null, sync: true, started: false, players: [], feed: [] })
}

export function notifyStateChanged() {
  if (get().conn !== 'online' || stateTimer) return
  stateTimer = setTimeout(() => { stateTimer = null; pushStateNow() }, STATE_DEBOUNCE_MS)
}

/** Un achat ou une vente : les autres joueurs voient le prix bouger dans cette station. */
export function reportTrade(day: number, station: string, item: string, side: 'buy' | 'sell') {
  if (get().conn !== 'online') return
  if (day !== tradesDay) { tradesDay = day; reportedTrades.clear() }
  const key = `${station}|${item}|${side}`
  if (reportedTrades.has(key)) return
  reportedTrades.add(key)
  // L'état part d'abord : le serveur vérifie que l'échange a lieu là où tu es.
  pushStateNow()
  sendRaw({ t: 'trade', station, item, side })
}

export function sendGift(to: string, amount: number) {
  pushStateNow()
  sendRaw({ t: 'gift', to, amount })
}

/** Nouvelles des autres joueurs depuis le dernier voyage, pour le briefing d'arrivée. */
export function drainPendingNews(): CompetitorNews[] {
  const news = pendingNews
  pendingNews = []
  return news
}

export function isInRoom(): boolean {
  return get().session !== null
}

/** Mort ou victoire : la partie de ce joueur est terminée dans ce salon. */
export function isFinishedInRoom(): boolean {
  const { players, you } = get()
  const me = players.find(p => p.id === you)
  return !!me && (me.status === 'dead' || me.status === 'won')
}

export function getWaitingFor(myDay: number): MpPlayer[] {
  const { sync, conn, players, you } = get()
  if (!sync || conn !== 'online') return []
  return playersToWaitFor(players, you, myDay)
}
