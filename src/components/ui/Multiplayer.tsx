// Interface du multijoueur (store/multiStore.ts) et pont avec la partie.
//
// Chaque joueur joue sa propre run ; ce qui passe d'une partie à l'autre :
//  - la position, le jour et la fortune de chacun (carte, classement) ;
//  - les achats et ventes, qui font bouger les prix chez les autres ;
//  - les dons de crédits entre joueurs à quai dans la même station ;
//  - en jours synchronisés, la fin de journée : on attend les retardataires.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import {
  useMultiStore, gameHooks, createRoom, joinRoom, leaveRoom, resumeSession, notifyStateChanged,
  sendGift, getDefaultServer, isFinishedInRoom,
} from '../../store/multiStore'
import { playersToWaitFor, type MpPlayer, type PublicState } from '../../net/protocol'
import { createCompetitors } from '../../engine/competitors'
import { getStations, LOOT_ONLY_ITEMS } from '../../data/stations'
import { translateClassName, translateStationName } from '../../engine/goodsI18n'
import { useNewsText } from './RunExtras'
import i18n from '../../i18n/config'
import type { GameState } from '../../types'

const NAME_KEY = 'vt_mp_name'
const GIFTS = [100, 500, 1000]
const PLAYER_COLORS = ['#ff7ad9', '#7aff9e', '#ffb347', '#7ab8ff', '#ff6b6b', '#d4ff7a']

function publicStateOf(gs: GameState | null): PublicState {
  if (!gs) return { station: null, day: 1, credits: 0, className: null, fragments: 0, status: 'lobby' }
  const status = gs.isDead || gs.screen === 'game-over' ? 'dead'
    : gs.screen === 'victory' || gs.conquestMode ? 'won'
    : 'playing'
  return {
    station: gs.currentStation,
    day: Math.max(1, gs.day),
    credits: Math.max(0, Math.floor(gs.credits)),
    className: gs.class.name,
    fragments: Math.min(20, (gs.nexusFragments ?? []).length),
    status,
  }
}

/** Un autre joueur ne peut faire bouger que les prix d'une vraie station, sur un vrai bien. */
function isKnownTrade(station: string, item: string): boolean {
  const stations = getStations()
  return stations.some(s => s.name === station)
    && (LOOT_ONLY_ITEMS.has(item) || stations.some(s => s.goods.includes(item)))
}

/** Branche le multijoueur sur la partie. À appeler une fois, en haut de l'application. */
export function useMultiplayerBridge() {
  useEffect(() => {
    const game = useGameStore.getState
    gameHooks.getState = () => publicStateOf(game().gs)
    gameHooks.onTrade = e => {
      const gs = game().gs
      if (!gs || gs.isDead || !isKnownTrade(e.station, e.item)) return
      const pressure = (gs.marketPressure ?? []).filter(p => !(p.station === e.station && p.item === e.item))
      game().patch({ marketPressure: [...pressure, { station: e.station, item: e.item, mult: e.mult, untilDay: gs.day + 3, by: e.by }] })
    }
    gameHooks.onGift = (from, amount) => {
      const gs = game().gs
      if (!gs || gs.isDead) return
      game().patch({ credits: gs.credits + amount, pendingMessage: i18n.t('giftReceived', { ns: 'multiplayer', name: from, amount: amount.toLocaleString() }) })
    }
    gameHooks.onGiftSent = (to, amount) => {
      const gs = game().gs
      if (!gs) return
      game().patch({ credits: Math.max(0, gs.credits - amount), pendingMessage: i18n.t('giftSent', { ns: 'multiplayer', name: to, amount: amount.toLocaleString() }) })
    }
    const unsubscribe = useGameStore.subscribe(() => notifyStateChanged())
    resumeSession()
    return () => {
      unsubscribe()
      gameHooks.getState = gameHooks.onTrade = gameHooks.onGift = gameHooks.onGiftSent = undefined
    }
  }, [])
}

/** Quitter le salon en pleine partie : les concurrents IA reprennent leur place. */
function leaveToSolo() {
  leaveRoom()
  const { gs, patch } = useGameStore.getState()
  if (gs && !gs.isDead && (gs.competitors ?? []).length === 0) patch({ competitors: createCompetitors(gs.currentStation) })
}

function ErrorLine({ code }: { code: string | null }) {
  const { t } = useTranslation('multiplayer')
  if (!code) return null
  return <div className="t-xs t-red mt4" style={{ lineHeight: 1.7 }}>{t(`error.${code}`, { defaultValue: t('error.generic') })}</div>
}

/** Classement du salon par fortune, avec où en est chacun. */
function Roster({ players, you }: { players: MpPlayer[]; you: string | null }) {
  const { t } = useTranslation('multiplayer')
  const sorted = [...players].sort((a, b) => b.credits - a.credits)
  return (
    <div className="col gap4">
      {sorted.map((p, i) => {
        const etat = p.status === 'dead' ? t('roster.dead')
          : p.status === 'won' ? t('roster.won')
          : p.status === 'lobby' ? t('roster.lobby')
          : null
        return (
          <div key={p.id} className="t-xs row" style={{ gap: '8px', color: p.id === you ? 'var(--cyan)' : 'var(--text)', opacity: p.online ? 1 : 0.5 }}>
            <span style={{ width: '18px' }}>{i + 1}.</span>
            <span style={{ flex: 1 }}>
              <span style={{ color: PLAYER_COLORS[players.indexOf(p) % PLAYER_COLORS.length] }}>◆ </span>
              {p.name}{p.id === you && <span className="t-dim"> ({t('roster.you')})</span>}
              <span className="t-dim">
                {p.className && ` · ${translateClassName(p.className)}`}
                {p.station && p.status === 'playing' && ` · ${translateStationName(p.station)} · J${p.day}`}
                {p.fragments > 0 && ` · ${t('roster.fragments', { count: p.fragments })}`}
                {etat && ` · ${etat}`}
                {!p.online && ` · ${t('roster.offline')}`}
              </span>
            </span>
            {p.status !== 'lobby' && <span className="t-gold">{p.credits.toLocaleString()} cr</span>}
          </div>
        )
      })}
    </div>
  )
}

function Feed({ max }: { max: number }) {
  const { t } = useTranslation('multiplayer')
  const feed = useMultiStore(s => s.feed)
  const texte = useNewsText()
  if (feed.length === 0) return <div className="t-xs t-dim">{t('dock.noFeed')}</div>
  return <>{feed.slice(0, max).map((n, i) => <div key={i} className="t-xs mt2" style={{ lineHeight: 1.7 }}>{texte(n)}</div>)}</>
}

/** Menu de départ : créer ou rejoindre un salon, puis voir qui est là. */
export function MultiplayerLobby() {
  const { t } = useTranslation('multiplayer')
  const session = useMultiStore(s => s.session)
  const conn    = useMultiStore(s => s.conn)
  const error   = useMultiStore(s => s.error)
  const players = useMultiStore(s => s.players)
  const you     = useMultiStore(s => s.you)
  const sync    = useMultiStore(s => s.sync)
  const [open, setOpen]         = useState(false)
  const [name, setName]         = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } })
  const [code, setCode]         = useState('')
  const [server, setServer]     = useState(getDefaultServer)
  const [syncDays, setSyncDays] = useState(true)

  const rememberName = () => { try { localStorage.setItem(NAME_KEY, name.trim()) } catch { /* stockage indisponible */ } }
  const busy = conn === 'connecting'
  const box = { borderColor: 'var(--cyan)', background: 'rgba(0,200,255,0.04)' }

  if (session) {
    return (
      <div className="px-box mt12" style={box}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div className="t-sm" style={{ color: 'var(--cyan)', letterSpacing: '3px' }}>{t('lobby.room', { code: session.code })}</div>
          <div className="t-xs t-dim">{sync ? t('lobby.syncOn') : t('lobby.syncOff')}</div>
        </div>
        {conn !== 'online' && <div className="t-xs t-dim mb4">{t('lobby.connecting')}</div>}
        <ErrorLine code={error} />
        {conn === 'online' && <>
          <div className="t-xs t-dim mb8" style={{ lineHeight: 1.8 }}>{sync ? t('lobby.shareSync') : t('lobby.shareFree')}</div>
          <Roster players={players} you={you} />
          <div className="t-xs mt8" style={{ lineHeight: 1.8, color: isFinishedInRoom() ? 'var(--orange)' : 'var(--text)' }}>
            {isFinishedInRoom() ? t('lobby.finished') : t('lobby.chooseClass')}
          </div>
        </>}
        <div className="row gap4 mt8">
          {conn === 'idle' && <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={resumeSession}>{t('lobby.retry')}</button>}
          <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={leaveRoom}>{t('lobby.leave')}</button>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="px-box mt12" style={box}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div>
            <div className="t-xs" style={{ color: 'var(--cyan)', letterSpacing: '2px' }}>{t('lobby.title')}</div>
            <div className="t-xs t-dim mt4" style={{ lineHeight: 1.8 }}>{t('lobby.pitch')}</div>
          </div>
          <button className="px-btn px-btn--sm" style={{ width: 'auto', flexShrink: 0, borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
            onClick={() => setOpen(true)}>{t('lobby.open')}</button>
        </div>
      </div>
    )
  }

  const input = { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', fontFamily: 'inherit', fontSize: '11px' }
  return (
    <div className="px-box mt12" style={box}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="t-xs" style={{ color: 'var(--cyan)', letterSpacing: '2px' }}>{t('lobby.title')}</div>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => setOpen(false)}>{t('lobby.close')}</button>
      </div>
      <label className="t-xs t-dim">{t('lobby.name')}</label>
      <input style={input} value={name} maxLength={16} onChange={e => setName(e.target.value)} />

      <label className="t-xs mt8 row" style={{ gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={syncDays} onChange={e => setSyncDays(e.target.checked)} />
        <span>{t('lobby.sync')}</span>
      </label>
      <button className="px-btn mt4" disabled={busy} style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
        onClick={() => { rememberName(); createRoom(server, name, syncDays) }}>{t('lobby.create')}</button>

      <div className="row gap4 mt8" style={{ alignItems: 'center' }}>
        <input style={{ ...input, textTransform: 'uppercase', letterSpacing: '3px' }} value={code} maxLength={5}
          placeholder={t('lobby.code')} onChange={e => setCode(e.target.value)} />
        <button className="px-btn" style={{ width: 'auto' }} disabled={busy}
          onClick={() => { rememberName(); joinRoom(server, code, name) }}>{t('lobby.join')}</button>
      </div>

      {busy && <div className="t-xs t-dim mt4">{t('lobby.connecting')}</div>}
      <ErrorLine code={error} />

      <details className="mt8">
        <summary className="t-xs t-dim" style={{ cursor: 'pointer' }}>{t('lobby.server')}</summary>
        <input style={{ ...input, marginTop: '4px' }} value={server} maxLength={200} onChange={e => setServer(e.target.value)} />
        <div className="t-xs t-dim mt4" style={{ lineHeight: 1.7 }}>{t('lobby.serverHint')}</div>
      </details>
    </div>
  )
}

/** Hub : le salon en une ligne, et les joueurs à quai avec toi. */
export function MultiplayerDock({ gs }: { gs: GameState }) {
  const { t } = useTranslation('multiplayer')
  const session = useMultiStore(s => s.session)
  const players = useMultiStore(s => s.players)
  const you     = useMultiStore(s => s.you)
  const error   = useMultiStore(s => s.error)
  const [open, setOpen]       = useState(false)
  const [confirm, setConfirm] = useState(false)
  if (!session) return null

  const ranking = [...players].sort((a, b) => b.credits - a.credits)
  const rank = ranking.findIndex(p => p.id === you) + 1
  const here = players.filter(p => p.id !== you && p.online && p.status === 'playing' && p.station === gs.currentStation)

  return (
    <div className="px-box" style={{ padding: '6px 8px', borderColor: 'var(--cyan)' }}>
      <div className="row" style={{ gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto', padding: '4px 10px', borderColor: open ? 'var(--gold)' : 'var(--cyan)', color: rank === 1 ? 'var(--gold)' : 'var(--text)' }}
          onClick={() => setOpen(o => !o)}>
          👥 {t('dock.chip', { code: session.code, rank: rank || '?', total: players.length })}
        </button>
        <span className="t-xs t-dim">{t('dock.online', { count: players.filter(p => p.online).length })}</span>
      </div>

      {here.length > 0 && (
        <div className="mt8" style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '6px' }}>
          <div className="t-xs mb4" style={{ color: 'var(--cyan)', letterSpacing: '1px' }}>{t('dock.here')}</div>
          {here.map(p => (
            <div key={p.id} className="row mt4" style={{ gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="t-xs t-bright" style={{ minWidth: '110px' }}>
                {p.name}{p.className && <span className="t-dim"> · {translateClassName(p.className)}</span>}
              </span>
              {GIFTS.map(a => (
                <button key={a} className="px-btn px-btn--sm" style={{ width: 'auto' }} disabled={gs.credits < a}
                  onClick={() => sendGift(p.id, a)}>{t('dock.gift', { amount: a.toLocaleString() })}</button>
              ))}
            </div>
          ))}
        </div>
      )}
      {error === 'gift_failed' && <ErrorLine code={error} />}

      {open && (
        <div className="mt8" style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '8px' }}>
          <Roster players={players} you={you} />
          <div className="t-xs mt8 mb4" style={{ color: 'var(--orange)', letterSpacing: '1px' }}>{t('dock.feed')}</div>
          <Feed max={5} />
          <button className="px-btn px-btn--sm mt8" style={{ width: 'auto', color: confirm ? 'var(--red)' : undefined }}
            onClick={() => { if (confirm) leaveToSolo(); else setConfirm(true) }}>
            {confirm ? t('dock.leaveConfirm') : t('lobby.leave')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Jours synchronisés : quand ta journée est finie et qu'un autre joueur en
 * est encore à la veille, tu l'attends. L'écran couvre tout, clavier compris,
 * et se lève de lui-même dès que le dernier a fini.
 */
export function DaySyncOverlay() {
  const { t } = useTranslation('multiplayer')
  const gs      = useGameStore(s => s.gs)
  const players = useMultiStore(s => s.players)
  const you     = useMultiStore(s => s.you)
  const sync    = useMultiStore(s => s.sync)
  const conn    = useMultiStore(s => s.conn)
  const [confirm, setConfirm] = useState(false)

  const waiting = gs && sync && conn === 'online' && !gs.isDead ? playersToWaitFor(players, you, gs.day) : []
  const blocked = waiting.length > 0

  useEffect(() => {
    if (!blocked) { setConfirm(false); return }
    const stop = (e: KeyboardEvent) => e.stopImmediatePropagation()
    window.addEventListener('keydown', stop, true)
    return () => window.removeEventListener('keydown', stop, true)
  }, [blocked])

  if (!blocked || !gs) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(4,6,14,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="px-box scanlines" style={{ maxWidth: '460px', width: '100%', borderColor: 'var(--cyan)' }}>
        <div className="t-sm t-center" style={{ color: 'var(--cyan)', letterSpacing: '4px' }}>{t('wait.title')}</div>
        <div className="t-xs t-center t-dim mt8" style={{ lineHeight: 1.8 }}>{t('wait.text', { day: gs.day })}</div>
        <div className="t-xs mt12 mb4 t-dim">{t('wait.waitingFor')}</div>
        {waiting.map(p => (
          <div key={p.id} className="t-xs mt2"><span className="blink">▶</span> {p.status === 'lobby' ? t('wait.notStarted', { name: p.name }) : t('wait.player', { name: p.name, day: p.day })}</div>
        ))}
        <div className="t-xs mt12 mb4" style={{ color: 'var(--orange)', letterSpacing: '1px' }}>{t('wait.feed')}</div>
        <Feed max={5} />
        <button className="px-btn px-btn--sm mt12" style={{ width: 'auto', color: confirm ? 'var(--red)' : 'var(--text-dim)' }}
          onClick={() => { if (confirm) leaveToSolo(); else setConfirm(true) }}>
          {confirm ? t('wait.leaveConfirm') : t('wait.leave')}
        </button>
      </div>
    </div>
  )
}

/** Partie multijoueur sans connexion : on le dit, et on laisse le choix de continuer seul. */
export function MultiplayerConnectionBanner() {
  const { t } = useTranslation('multiplayer')
  const gs      = useGameStore(s => s.gs)
  const session = useMultiStore(s => s.session)
  const conn    = useMultiStore(s => s.conn)
  const error   = useMultiStore(s => s.error)
  if (!gs || !session || conn === 'online') return null
  const texte = conn === 'reconnecting' ? t('banner.reconnecting')
    : conn === 'connecting' ? t('banner.connecting')
    : t(`error.${error ?? 'generic'}`, { defaultValue: t('error.generic') })
  return (
    <div style={{ position: 'fixed', bottom: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 600, maxWidth: 'calc(100% - 16px)' }}>
      <div className="px-box row" style={{ padding: '6px 10px', gap: '8px', alignItems: 'center', borderColor: 'var(--orange)', background: 'var(--bg-panel2)' }}>
        <span className="t-xs" style={{ color: 'var(--orange)' }}>{texte}</span>
        {conn === 'idle' && <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={resumeSession}>{t('lobby.retry')}</button>}
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={leaveToSolo}>{t('banner.solo')}</button>
      </div>
    </div>
  )
}

/** Nom des autres joueurs présents dans chaque station (écran de voyage). */
export function useFriendsByStation(): Map<string, string[]> {
  const players = useMultiStore(s => s.players)
  const you     = useMultiStore(s => s.you)
  const map = new Map<string, string[]>()
  for (const p of players) {
    if (p.id === you || p.status !== 'playing' || !p.station) continue
    map.set(p.station, [...(map.get(p.station) ?? []), p.name])
  }
  return map
}

/** Les autres joueurs sur la carte (à placer dans le <svg> de MapScreen). */
export function FriendMarkers({ positions }: { positions: Record<string, { x: number; y: number }> }) {
  const players = useMultiStore(s => s.players)
  const you     = useMultiStore(s => s.you)
  const parStation = new Map<string, number>()
  return (
    <g style={{ pointerEvents: 'none' }}>
      {players.map((p, i) => {
        if (p.id === you || p.status !== 'playing' || !p.station) return null
        const pos = positions[p.station]
        if (!pos) return null
        const rang = parStation.get(p.station) ?? 0
        parStation.set(p.station, rang + 1)
        const x = pos.x + 13
        const y = pos.y - 10 - rang * 11
        const col = PLAYER_COLORS[i % PLAYER_COLORS.length]
        return (
          <g key={p.id} opacity={p.online ? 1 : 0.45}>
            <polygon points={`${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`} fill={col} stroke="#000" strokeWidth="0.8" />
            <text x={x + 7} y={y + 3} fontSize="8" fill={col} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{p.name}</text>
          </g>
        )
      })}
    </g>
  )
}
