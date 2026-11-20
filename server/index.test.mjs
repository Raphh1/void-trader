// Serveur de salons : deux vrais clients WebSocket contre un serveur lancé sur un port libre.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import WebSocket from 'ws'
import { startServer, originAllowed } from './index.mjs'

const ORIGIN = 'http://localhost:5173'
let server
let url

beforeAll(async () => {
  server = await startServer({ port: 0 })
  url = `ws://127.0.0.1:${server.port}`
})
afterAll(() => server.close())

/** Client de test : garde tous les messages reçus, attend celui qui correspond. */
function client(origin = ORIGIN) {
  const ws = new WebSocket(url, { origin })
  const inbox = []
  const waiters = []
  ws.on('message', data => {
    const msg = JSON.parse(data.toString())
    inbox.push(msg)
    for (const w of [...waiters]) if (w.match(msg)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg) }
  })
  const opened = new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`))) })
  return {
    ws, inbox, opened,
    send: msg => ws.send(JSON.stringify(msg)),
    next(match, timeout = 1500) {
      const found = inbox.find(match)
      if (found) { inbox.splice(inbox.indexOf(found), 1); return Promise.resolve(found) }
      return new Promise((resolve, reject) => {
        const w = { match, resolve: m => { inbox.splice(inbox.indexOf(m), 1); clearTimeout(timer); resolve(m) } }
        const timer = setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); reject(new Error('timeout')) }, timeout)
        waiters.push(w)
      })
    },
    close: () => ws.close(),
  }
}
const is = t => m => m.t === t
const quiet = ms => new Promise(r => setTimeout(r, ms))
const state = (station, day = 1, credits = 1000) => ({ t: 'state', station, day, credits, className: 'Marchand', fragments: 0, status: 'playing' })

async function roomOfTwo({ sync = true } = {}) {
  const a = client(); await a.opened
  a.send({ t: 'create', name: 'Alice', sync })
  const wa = await a.next(is('welcome'))
  const b = client(); await b.opened
  b.send({ t: 'join', code: wa.code.toLowerCase(), name: 'Bob' })
  const wb = await b.next(is('welcome'))
  await a.next(m => m.t === 'room' && m.players.length === 2)
  await b.next(m => m.t === 'room' && m.players.length === 2)
  return { a, b, wa, wb, code: wa.code }
}

describe('origines', () => {
  it('accepte le local et le réseau de la maison, refuse le reste sans liste explicite', () => {
    expect(originAllowed('http://localhost:5173', [])).toBe(true)
    expect(originAllowed('http://192.168.1.20:5173', [])).toBe(true)
    expect(originAllowed('https://evil.example', [])).toBe(false)
    expect(originAllowed(undefined, [])).toBe(false)
    expect(originAllowed('https://jeu.example', ['https://jeu.example'])).toBe(true)
    expect(originAllowed('http://localhost:5173', ['https://jeu.example'])).toBe(false)
  })

  it('refuse la connexion depuis une page étrangère', async () => {
    const c = client('https://evil.example')
    await expect(c.opened).rejects.toThrow('HTTP 401')
  })
})

describe('salons', () => {
  it('crée un salon puis le rejoint par son code', async () => {
    const { a, b, wa, wb } = await roomOfTwo()
    expect(wa.code).toMatch(/^[A-Z0-9]{5}$/)
    expect(wa.you).not.toBe(wb.you)
    expect(await a.next(m => m.t === 'event' && m.e.kind === 'join')).toMatchObject({ e: { name: 'Bob' } })
    a.close(); b.close()
  })

  it('refuse un pseudo invalide, un code inconnu et un pseudo déjà pris', async () => {
    const { a, b, code } = await roomOfTwo()
    const c = client(); await c.opened
    c.send({ t: 'create', name: '<script>' })
    expect(await c.next(is('error'))).toEqual({ t: 'error', code: 'bad_name' })
    c.send({ t: 'join', code: 'ZZZZZ', name: 'Carla' })
    expect(await c.next(is('error'))).toEqual({ t: 'error', code: 'room_not_found' })
    c.send({ t: 'join', code, name: 'alice' })
    expect(await c.next(is('error'))).toEqual({ t: 'error', code: 'name_taken' })
    c.send('pas du json')
    expect(await c.next(is('error'))).toEqual({ t: 'error', code: 'bad_request' })
    a.close(); b.close(); c.close()
  })

  it('jours synchronisés : on ne rejoint plus une partie commencée', async () => {
    const { a, b, code } = await roomOfTwo()
    a.send(state('Port Méridien', 2))
    await b.next(m => m.t === 'room' && m.started)
    const c = client(); await c.opened
    c.send({ t: 'join', code, name: 'Carla' })
    expect(await c.next(is('error'))).toEqual({ t: 'error', code: 'room_started' })
    a.close(); b.close(); c.close()
  })

  it('jours libres : on rejoint même une partie commencée', async () => {
    const { a, b, code } = await roomOfTwo({ sync: false })
    a.send(state('Port Méridien', 5))
    await b.next(m => m.t === 'room' && m.started)
    const c = client(); await c.opened
    c.send({ t: 'join', code, name: 'Carla' })
    await c.next(is('welcome'))
    a.close(); b.close(); c.close()
  })

  it('un joueur reprend sa place avec son jeton, pas avec un faux', async () => {
    const { a, b, code, wb } = await roomOfTwo()
    b.close()
    await a.next(m => m.t === 'room' && m.players.some(p => p.name === 'Bob' && !p.online))
    const b2 = client(); await b2.opened
    b2.send({ t: 'resume', code, token: 'faux-jeton' })
    expect(await b2.next(is('error'))).toEqual({ t: 'error', code: 'room_not_found' })
    b2.send({ t: 'resume', code, token: wb.token })
    expect(await b2.next(is('welcome'))).toMatchObject({ you: wb.you })
    await a.next(m => m.t === 'room' && m.players.every(p => p.online))
    a.close(); b2.close()
  })
})

describe('échanges entre joueurs', () => {
  it('un achat fait monter le prix chez les autres, une seule fois par jour', async () => {
    const { a, b } = await roomOfTwo()
    a.send(state('Port Méridien'))
    a.send({ t: 'trade', station: 'Port Méridien', item: 'Minerai', side: 'buy' })
    const ev = await b.next(m => m.t === 'event' && m.e.kind === 'trade')
    expect(ev.e).toMatchObject({ by: 'Alice', station: 'Port Méridien', item: 'Minerai', side: 'buy', mult: 1.2 })
    a.send({ t: 'trade', station: 'Port Méridien', item: 'Minerai', side: 'buy' })
    await quiet(150)
    expect(b.inbox.some(m => m.t === 'event' && m.e.kind === 'trade')).toBe(false)
    expect(a.inbox.some(m => m.t === 'event' && m.e.kind === 'trade')).toBe(false)
    a.close(); b.close()
  })

  it("refuse un échange dans une station où l'on n'est pas", async () => {
    const { a, b } = await roomOfTwo()
    a.send(state('Port Méridien'))
    a.send({ t: 'trade', station: 'Fort Kharos', item: 'Minerai', side: 'sell' })
    expect(await a.next(is('error'))).toEqual({ t: 'error', code: 'bad_request' })
    a.close(); b.close()
  })

  it('don de crédits entre joueurs à quai dans la même station', async () => {
    const { a, b, wb } = await roomOfTwo()
    a.send(state('Port Méridien', 1, 1000))
    b.send(state('Fort Kharos', 1, 50))
    await a.next(m => m.t === 'room' && m.players.some(p => p.name === 'Bob' && p.station === 'Fort Kharos'))
    a.send({ t: 'gift', to: wb.you, amount: 300 })
    expect(await a.next(is('error'))).toEqual({ t: 'error', code: 'gift_failed' })

    b.send(state('Port Méridien', 1, 50))
    await a.next(m => m.t === 'room' && m.players.some(p => p.name === 'Bob' && p.station === 'Port Méridien'))
    a.send({ t: 'gift', to: wb.you, amount: 5000 })
    expect(await a.next(is('error'))).toEqual({ t: 'error', code: 'bad_request' })
    a.send({ t: 'gift', to: wb.you, amount: 300 })
    expect(await b.next(is('gift'))).toEqual({ t: 'gift', from: 'Alice', amount: 300 })
    expect(await a.next(is('gift-sent'))).toEqual({ t: 'gift-sent', to: 'Bob', amount: 300 })
    a.close(); b.close()
  })

  it('une mort est annoncée et reste définitive', async () => {
    const { a, b } = await roomOfTwo()
    a.send({ ...state('Port Méridien'), status: 'dead' })
    expect(await b.next(m => m.t === 'event' && m.e.kind === 'dead')).toMatchObject({ e: { name: 'Alice' } })
    a.send(state('Port Méridien'))
    const room = await b.next(m => m.t === 'room' && m.players.find(p => p.name === 'Alice').status === 'dead' && m.players.find(p => p.name === 'Alice').station === 'Port Méridien')
    expect(room.players.find(p => p.name === 'Alice').status).toBe('dead')
    a.close(); b.close()
  })
})
