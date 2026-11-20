import { describe, it, expect } from 'vitest'
import { parseServerMsg, playersToWaitFor, type MpPlayer } from '../net/protocol'

const joueur = (id: string, day: number, extra: Partial<MpPlayer> = {}): MpPlayer => ({
  id, name: id, online: true, station: 'Port Méridien', day, credits: 1000, className: 'Marchand', fragments: 0, status: 'playing', ...extra,
})

describe('jours synchronisés', () => {
  it("attend ceux qui n'ont pas fini la veille", () => {
    const players = [joueur('moi', 3), joueur('bob', 2), joueur('carla', 3)]
    expect(playersToWaitFor(players, 'moi', 3).map(p => p.id)).toEqual(['bob'])
  })

  it("n'attend personne quand tout le monde est au même jour ou devant", () => {
    const players = [joueur('moi', 3), joueur('bob', 3), joueur('carla', 4)]
    expect(playersToWaitFor(players, 'moi', 3)).toEqual([])
  })

  it("n'attend ni les absents, ni les morts, ni les vainqueurs", () => {
    const players = [joueur('moi', 5), joueur('bob', 2, { online: false }), joueur('carla', 2, { status: 'dead' }), joueur('dan', 2, { status: 'won' })]
    expect(playersToWaitFor(players, 'moi', 5)).toEqual([])
  })

  it('un joueur encore au salon compte comme étant au jour 1', () => {
    const players = [joueur('moi', 1), joueur('bob', 1, { status: 'lobby', station: null })]
    expect(playersToWaitFor(players, 'moi', 1)).toEqual([])
    expect(playersToWaitFor(players, 'moi', 2).map(p => p.id)).toEqual(['bob'])
  })

  it("un joueur dont la partie est finie n'attend plus personne", () => {
    const players = [joueur('moi', 9, { status: 'dead' }), joueur('bob', 2)]
    expect(playersToWaitFor(players, 'moi', 9)).toEqual([])
  })
})

describe('messages du serveur', () => {
  it('accepte un message bien formé', () => {
    const raw = JSON.stringify({ t: 'event', e: { kind: 'trade', by: 'Bob', byId: 'abc', station: 'Port Méridien', item: 'Minerai', side: 'buy', mult: 1.2 } })
    expect(parseServerMsg(raw)).toEqual(JSON.parse(raw))
  })

  it('ignore ce qui ne colle pas au format attendu', () => {
    expect(parseServerMsg('pas du json')).toBeNull()
    expect(parseServerMsg(JSON.stringify({ t: 'inconnu' }))).toBeNull()
    // Effet de prix hors bornes : un ×10 ne passe pas.
    expect(parseServerMsg(JSON.stringify({ t: 'event', e: { kind: 'trade', by: 'Bob', byId: 'abc', station: 'X', item: 'Y', side: 'buy', mult: 10 } }))).toBeNull()
    // Montant négatif.
    expect(parseServerMsg(JSON.stringify({ t: 'gift', from: 'Bob', amount: -500 }))).toBeNull()
    // Un seul joueur mal formé invalide tout l'instantané du salon.
    expect(parseServerMsg(JSON.stringify({ t: 'room', code: 'ABCDE', sync: true, started: false, players: [{ id: 'x' }] }))).toBeNull()
  })
})
