// Serveur multijoueur de Void Trader : des salons entre amis.
//
// Il ne fait tourner aucune logique de jeu : chaque joueur garde sa partie
// dans son navigateur. Le serveur tient seulement la couche commune d'un
// salon (qui est où, à quel jour, avec quelle fortune) et relaie ce qui touche
// les autres : achats et ventes qui font bouger les prix, dons de crédits,
// morts et victoires. Tout vit en mémoire : un redémarrage efface les salons.
//
// Données : un pseudo choisi par le joueur, rien d'autre. Les journaux ne
// contiennent ni pseudos ni jetons, seulement des compteurs.
//
//   node index.mjs                     (port 8787)
//   PORT=9000 ALLOWED_ORIGINS=https://mon-jeu.example node index.mjs
import http from 'node:http'
import { randomInt, randomUUID, randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { WebSocketServer } from 'ws'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sans 0/O, 1/I/L : se dicte sans ambiguïté
const CODE_LEN = 5
const MAX_ROOMS = 200
const MAX_PLAYERS = 6
const MAX_PAYLOAD = 2048
const EMPTY_ROOM_TTL_MS = 2 * 60 * 60 * 1000 // un salon vide survit 2 h : on peut revenir après une pause
const HEARTBEAT_MS = 30_000
const RATE_WINDOW_MS = 10_000
const RATE_MAX = 80
const MAX_GIFT = 1_000_000
// Un achat d'un autre joueur fait monter le prix, une vente le fait baisser.
// L'effet est fixé ici et pas par le client : personne ne peut envoyer un ×10.
const TRADE_MULT = { buy: 1.2, sell: 0.85 }

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _'.-]{0,15}$/u
const TEXT_RE = /^[^\p{Cc}]{1,60}$/u
const CODE_RE = /^[A-Z0-9]{5}$/
const STATUSES = new Set(['lobby', 'playing', 'dead', 'won'])

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
const isText = v => typeof v === 'string' && TEXT_RE.test(v)

function isPrivateHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
    || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
}

/**
 * Sans liste explicite, seules les pages servies en local ou sur le réseau
 * de la maison peuvent se connecter (partie entre potes sur le même wifi).
 * En ligne, ALLOWED_ORIGINS doit lister l'adresse exacte du jeu.
 */
export function originAllowed(origin, allowed) {
  if (typeof origin !== 'string' || origin.length === 0) return false
  if (allowed.length > 0) return allowed.includes(origin)
  try { return isPrivateHost(new URL(origin).hostname) } catch { return false }
}

export function startServer({ port = 8787, allowedOrigins = [], log = () => {} } = {}) {
  /** @type {Map<string, any>} */
  const rooms = new Map()
  const conns = new Set()

  const httpServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok')
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
  })

  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: MAX_PAYLOAD,
    verifyClient: ({ origin }) => originAllowed(origin, allowedOrigins),
  })

  const send = (ws, msg) => { if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)) }
  const fail = (conn, code) => send(conn.ws, { t: 'error', code })

  const publicPlayer = p => ({
    id: p.id, name: p.name, online: !!p.ws, station: p.station, day: p.day,
    credits: p.credits, className: p.className, fragments: p.fragments, status: p.status,
  })
  const isStarted = room => [...room.players.values()].some(p => p.day > 1)

  function broadcastRoom(room) {
    const msg = { t: 'room', code: room.code, sync: room.sync, started: isStarted(room), players: [...room.players.values()].map(publicPlayer) }
    for (const p of room.players.values()) send(p.ws, msg)
  }
  function broadcastEvent(room, e, exceptId = null) {
    for (const p of room.players.values()) if (p.id !== exceptId) send(p.ws, { t: 'event', e })
  }

  function newCode() {
    for (;;) {
      let code = ''
      for (let i = 0; i < CODE_LEN; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
      if (!rooms.has(code)) return code
    }
  }

  function sweep() {
    const now = Date.now()
    for (const [code, room] of rooms) {
      if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) rooms.delete(code)
    }
  }

  function bind(conn, room, player) {
    player.ws = conn.ws
    conn.room = room
    conn.player = player
    room.emptySince = null
    send(conn.ws, { t: 'welcome', code: room.code, you: player.id, token: player.token, sync: room.sync })
  }

  function addPlayer(conn, room, name) {
    const player = {
      id: randomBytes(6).toString('hex'), token: randomUUID(), name, ws: null,
      station: null, day: 1, credits: 0, className: null, fragments: 0, status: 'lobby', finished: false,
      tradeDay: 0, trades: new Set(),
    }
    room.players.set(player.id, player)
    bind(conn, room, player)
    broadcastEvent(room, { kind: 'join', name }, player.id)
    broadcastRoom(room)
  }

  function nameTaken(room, name) {
    const n = name.toLowerCase()
    return [...room.players.values()].some(p => p.name.toLowerCase() === n)
  }

  function detach(conn) {
    const { room, player } = conn
    conn.room = null
    conn.player = null
    if (!room || !player) return
    if (player.ws === conn.ws) player.ws = null
    if (![...room.players.values()].some(p => p.ws)) room.emptySince = Date.now()
    broadcastRoom(room)
  }

  const handlers = {
    create(conn, msg) {
      if (conn.player) return fail(conn, 'bad_request')
      if (typeof msg.name !== 'string' || !NAME_RE.test(msg.name)) return fail(conn, 'bad_name')
      if (rooms.size >= MAX_ROOMS) sweep()
      if (rooms.size >= MAX_ROOMS) return fail(conn, 'server_full')
      const room = { code: newCode(), sync: msg.sync !== false, players: new Map(), emptySince: null }
      rooms.set(room.code, room)
      log(`salon créé (${rooms.size} actifs)`)
      addPlayer(conn, room, msg.name)
    },

    join(conn, msg) {
      if (conn.player) return fail(conn, 'bad_request')
      if (typeof msg.name !== 'string' || !NAME_RE.test(msg.name)) return fail(conn, 'bad_name')
      const code = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : ''
      const room = CODE_RE.test(code) ? rooms.get(code) : undefined
      if (!room) return fail(conn, 'room_not_found')
      if (room.players.size >= MAX_PLAYERS) return fail(conn, 'room_full')
      if (nameTaken(room, msg.name)) return fail(conn, 'name_taken')
      // Jours synchronisés : un nouveau venu au jour 1 bloquerait tous les autres.
      if (room.sync && isStarted(room)) return fail(conn, 'room_started')
      addPlayer(conn, room, msg.name)
    },

    resume(conn, msg) {
      if (conn.player) return fail(conn, 'bad_request')
      const code = typeof msg.code === 'string' ? msg.code.toUpperCase() : ''
      const room = CODE_RE.test(code) ? rooms.get(code) : undefined
      const token = typeof msg.token === 'string' && msg.token.length <= 64 ? msg.token : null
      const player = room && token ? [...room.players.values()].find(p => p.token === token) : undefined
      // Même réponse pour un salon disparu et un jeton inconnu : rien à deviner.
      if (!room || !player) return fail(conn, 'room_not_found')
      // Partie rouverte dans un autre onglet : l'ancien cède la place.
      if (player.ws && player.ws !== conn.ws) {
        const old = player.ws
        player.ws = null
        old.close(4000, 'replaced')
      }
      bind(conn, room, player)
      broadcastRoom(room)
    },

    state(conn, msg) {
      const { player, room } = conn
      if (!player) return fail(conn, 'bad_request')
      const ok = (msg.station === null || isText(msg.station))
        && isInt(msg.day, 1, 100_000)
        && isInt(msg.credits, 0, 1e12)
        && (msg.className === null || isText(msg.className))
        && isInt(msg.fragments, 0, 20)
        && STATUSES.has(msg.status)
      if (!ok) return fail(conn, 'bad_request')
      Object.assign(player, { station: msg.station, day: msg.day, credits: msg.credits, className: msg.className, fragments: msg.fragments })
      // Une mort ou une victoire est définitive dans ce salon.
      if (!player.finished) {
        player.status = msg.status
        if (msg.status === 'dead' || msg.status === 'won') {
          player.finished = true
          broadcastEvent(room, { kind: msg.status, name: player.name })
        }
      }
      broadcastRoom(room)
    },

    trade(conn, msg) {
      const { player, room } = conn
      if (!player || player.status !== 'playing') return fail(conn, 'bad_request')
      if (msg.station !== player.station || !isText(msg.item) || !(msg.side in TRADE_MULT)) return fail(conn, 'bad_request')
      // Un seul effet par bien, station, sens et jour : vendre 20 caisses une par une ne crée pas 20 nouvelles.
      if (player.tradeDay !== player.day) { player.tradeDay = player.day; player.trades.clear() }
      const key = `${msg.station}|${msg.item}|${msg.side}`
      if (player.trades.has(key)) return
      player.trades.add(key)
      broadcastEvent(room, { kind: 'trade', by: player.name, byId: player.id, station: msg.station, item: msg.item, side: msg.side, mult: TRADE_MULT[msg.side] }, player.id)
    },

    gift(conn, msg) {
      const { player, room } = conn
      if (!player || player.status !== 'playing') return fail(conn, 'bad_request')
      const target = typeof msg.to === 'string' ? room.players.get(msg.to) : undefined
      if (!isInt(msg.amount, 1, MAX_GIFT) || msg.amount > player.credits) return fail(conn, 'bad_request')
      if (!target || target === player || !target.ws || target.status !== 'playing' || target.station !== player.station) {
        return fail(conn, 'gift_failed')
      }
      player.credits -= msg.amount
      target.credits += msg.amount
      send(conn.ws, { t: 'gift-sent', to: target.name, amount: msg.amount })
      send(target.ws, { t: 'gift', from: player.name, amount: msg.amount })
      broadcastEvent(room, { kind: 'gift', from: player.name, to: target.name, amount: msg.amount }, player.id)
      broadcastRoom(room)
    },

    leave(conn) {
      const { player, room } = conn
      if (!player) return
      room.players.delete(player.id)
      conn.room = null
      conn.player = null
      if (room.players.size === 0) {
        rooms.delete(room.code)
        log(`salon fermé (${rooms.size} actifs)`)
        return
      }
      if (![...room.players.values()].some(p => p.ws)) room.emptySince = Date.now()
      broadcastEvent(room, { kind: 'leave', name: player.name })
      broadcastRoom(room)
    },
  }

  wss.on('connection', ws => {
    const conn = { ws, room: null, player: null, hits: [], alive: true }
    ws.on('pong', () => { conn.alive = true })
    ws.on('message', (data, isBinary) => {
      const now = Date.now()
      conn.hits = conn.hits.filter(t => now - t < RATE_WINDOW_MS)
      conn.hits.push(now)
      if (conn.hits.length > RATE_MAX) { ws.close(1008, 'rate_limited'); return }
      if (isBinary) return fail(conn, 'bad_request')
      let msg
      try { msg = JSON.parse(data.toString()) } catch { return fail(conn, 'bad_request') }
      const handler = msg && typeof msg.t === 'string' && Object.hasOwn(handlers, msg.t) ? handlers[msg.t] : null
      if (!handler) return fail(conn, 'bad_request')
      handler(conn, msg)
    })
    ws.on('close', () => { conns.delete(conn); detach(conn) })
    ws.on('error', () => {})
    conns.add(conn)
  })

  // Connexions mortes (wifi coupé, onglet tué) : sans ce battement, le joueur
  // resterait « en ligne » et bloquerait les jours synchronisés des autres.
  const heartbeat = setInterval(() => {
    for (const conn of conns) {
      if (!conn.alive) { conn.ws.terminate(); continue }
      conn.alive = false
      conn.ws.ping()
    }
    sweep()
  }, HEARTBEAT_MS)
  heartbeat.unref()

  return new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(port, () => {
      resolve({
        port: httpServer.address().port,
        close: () => new Promise(done => {
          clearInterval(heartbeat)
          for (const conn of conns) conn.ws.terminate()
          wss.close(() => httpServer.close(() => done()))
        }),
      })
    })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 8787
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const { port: actual } = await startServer({ port, allowedOrigins, log: m => console.log(`[void-trader] ${m}`) })
  console.log(`[void-trader] serveur multijoueur à l'écoute sur le port ${actual}`)
  console.log(allowedOrigins.length > 0
    ? `[void-trader] origines autorisées : ${allowedOrigins.join(', ')}`
    : '[void-trader] origines autorisées : localhost et réseau local uniquement (définir ALLOWED_ORIGINS pour une mise en ligne)')
}
