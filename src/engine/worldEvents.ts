import type { GameState, WorldEvent, StationAlertType } from '../types'
import i18n from '../i18n/config'

type EventTemplate = Omit<WorldEvent, 'startDay'>

const we = (id: string, key: string) => i18n.t(`${id}.${key}`, { ns: 'worldEvents' })

function getEventPool(): EventTemplate[] {
  return [
  {
    id: 'faucon_war',
    title: we('faucon_war', 'title'),
    description: we('faucon_war', 'description'),
    shortDesc: we('faucon_war', 'shortDesc'),
    duration: 7,
    color: 'var(--red)',
    effects: {
      priceItems: ['Armes lourdes', 'Armes illégales', 'Armes artisanales', 'Équipements blindés', "Armures d'élite", 'Armures Faucon', 'Munitions', 'Munitions spéciales'],
      priceMultiplier: 1.5,
      closedStations: ['Fort Kharos', 'La Citadelle Écarlate'],
      combatChanceBonus: 0.15,
    },
  },
  {
    id: 'emporium_blockade',
    title: we('emporium_blockade', 'title'),
    description: we('emporium_blockade', 'description'),
    shortDesc: we('emporium_blockade', 'shortDesc'),
    duration: 5,
    color: 'var(--orange)',
    effects: {
      priceItems: ['Nourriture synthétique', 'Nourriture fraîche', 'Eau purifiée', 'Médicaments', 'Médicaments premium', 'Rations', 'Rations militaires', 'Vivres'],
      priceMultiplier: 1.7,
      fuelCostBonus: 1,
    },
  },
  {
    id: 'epidemic',
    title: we('epidemic', 'title'),
    description: we('epidemic', 'description'),
    shortDesc: we('epidemic', 'shortDesc'),
    duration: 6,
    color: 'var(--green)',
    effects: {
      priceItems: ['Médicaments', 'Médicaments premium', 'Implants'],
      priceMultiplier: 4.0,
      closedStations: ['Station Quarantaine'],
    },
  },
  {
    id: 'cosmic_storm',
    title: we('cosmic_storm', 'title'),
    description: we('cosmic_storm', 'description'),
    shortDesc: we('cosmic_storm', 'shortDesc'),
    duration: 4,
    color: 'var(--cyan)',
    effects: {
      fuelCostBonus: 2,
      combatChanceBonus: 0.10,
    },
  },
  {
    id: 'bounty_hunt',
    title: we('bounty_hunt', 'title'),
    description: we('bounty_hunt', 'description'),
    shortDesc: we('bounty_hunt', 'shortDesc'),
    duration: 5,
    color: 'var(--red)',
    effects: {
      combatChanceBonus: 0.25,
    },
  },
  {
    id: 'colonial_famine',
    title: we('colonial_famine', 'title'),
    description: we('colonial_famine', 'description'),
    shortDesc: we('colonial_famine', 'shortDesc'),
    duration: 6,
    color: 'var(--yellow)',
    effects: {
      priceItems: ['Nourriture synthétique', 'Nourriture fraîche', 'Eau purifiée', 'Vivres', 'Rations', 'Rations militaires'],
      priceMultiplier: 3.0,
    },
  },
  {
    id: 'market_crash',
    title: we('market_crash', 'title'),
    description: we('market_crash', 'description'),
    shortDesc: we('market_crash', 'shortDesc'),
    duration: 4,
    color: 'var(--text-dim)',
    effects: {
      globalPriceMult: 0.65,
    },
  },
  {
    id: 'artifact_rush',
    title: we('artifact_rush', 'title'),
    description: we('artifact_rush', 'description'),
    shortDesc: we('artifact_rush', 'shortDesc'),
    duration: 5,
    color: 'var(--gold)',
    effects: {
      priceItems: ['Artefacts', 'Données classifiées', 'Composants expérimentaux', 'Technologies avancées'],
      priceMultiplier: 3.0,
    },
  },
  {
    id: 'military_coup',
    title: we('military_coup', 'title'),
    description: we('military_coup', 'description'),
    shortDesc: we('military_coup', 'shortDesc'),
    duration: 7,
    color: 'var(--orange)',
    effects: {
      priceItems: ["Armures d'élite", 'Équipements blindés', 'Armures', 'Munitions', 'Munitions spéciales', 'Composants tactiques', 'Équipement tactique'],
      priceMultiplier: 1.6,
      closedStations: ['Fort Ossian', 'Bastion Mineur', 'Poste Vigie'],
    },
  },
  {
    id: 'guild_truce',
    title: we('guild_truce', 'title'),
    description: we('guild_truce', 'description'),
    shortDesc: we('guild_truce', 'shortDesc'),
    duration: 4,
    color: 'var(--green)',
    effects: {
      globalPriceMult: 0.80,
      combatChanceBonus: -0.15,
    },
  },
  {
    id: 'grand_festival',
    title: we('grand_festival', 'title'),
    description: we('grand_festival', 'description'),
    shortDesc: we('grand_festival', 'shortDesc'),
    duration: 5,
    color: 'var(--gold)',
    effects: {
      priceItems: ['Luxe', 'Alcools exotiques', 'Spécialités festives', 'Jetons de casino', 'Divertissement'],
      priceMultiplier: 2.0,
      combatChanceBonus: -0.10,
      festivalStations: ['La Tribosphère', 'Scotty Golden North'],
    },
  },
  ]
}

// Mapping event → alertes de stations
const EVENT_STATION_ALERTS: Record<string, { stations: string[]; alert: StationAlertType }> = {
  faucon_war:    { stations: ['Fort Kharos', 'La Citadelle Écarlate', 'Le Nid des Faucons', 'Arc Ouest Apocalypse'], alert: 'siege' },
  epidemic:      { stations: ['Station Quarantaine', 'Les Cendres'], alert: 'epidemic' },
  military_coup: { stations: ['Fort Ossian', 'Bastion Mineur', 'Poste Vigie'], alert: 'lockdown' },
  grand_festival:{ stations: ['La Tribosphère', 'Scotty Golden North'], alert: 'festival' },
}

const EVENT_CHANCE_PER_DAY = 0.22
const MAX_ACTIVE_EVENTS    = 2
const GRACE_PERIOD_DAYS    = 3

export function tickWorldEvents(gs: GameState): { gs: GameState; newWorldEvent: WorldEvent | null } {
  // Expirer les événements terminés
  const active = (gs.activeWorldEvents ?? []).filter(
    e => e.startDay + e.duration > gs.day
  )

  // Tenter de déclencher un nouvel événement
  let newWorldEvent: WorldEvent | null = null
  let newActive = active

  if (
    active.length < MAX_ACTIVE_EVENTS &&
    gs.day > GRACE_PERIOD_DAYS &&
    Math.random() < EVENT_CHANCE_PER_DAY
  ) {
    const activeIds = active.map(e => e.id)
    const pool = getEventPool().filter(e => !activeIds.includes(e.id))
    if (pool.length > 0) {
      const template = pool[Math.floor(Math.random() * pool.length)]
      newWorldEvent = { ...template, startDay: gs.day }
      newActive = [...active, newWorldEvent]
    }
  }

  // Dériver stationAlerts des événements actifs
  const stationAlerts: Record<string, StationAlertType> = {}
  for (const evt of newActive) {
    const mapping = EVENT_STATION_ALERTS[evt.id]
    if (mapping) {
      for (const s of mapping.stations) stationAlerts[s] = mapping.alert
    }
  }

  return { gs: { ...gs, activeWorldEvents: newActive, stationAlerts }, newWorldEvent }
}

// Les événements actifs sont stockés avec leurs textes rendus au déclenchement :
// on les relit dans la langue courante, sinon un événement survenu en français
// reste en français après un changement de langue.
export function getActiveEvents(gs: GameState): WorldEvent[] {
  return (gs.activeWorldEvents ?? [])
    .filter(e => e.startDay + e.duration > gs.day)
    .map(e => i18n.exists(`${e.id}.title`, { ns: 'worldEvents' })
      ? { ...e, title: we(e.id, 'title'), description: we(e.id, 'description'), shortDesc: we(e.id, 'shortDesc') }
      : e)
}

export function tickWorldEventsMultipleDays(gs: GameState, days: number): GameState {
  let current = gs
  for (let i = 0; i < days; i++) {
    const { gs: ticked } = tickWorldEvents(current)
    current = ticked
  }
  return current
}

export function getWorldEventPriceMultiplier(item: string, events: WorldEvent[]): number {
  let mult = 1
  for (const evt of events) {
    if (evt.effects.globalPriceMult) mult *= evt.effects.globalPriceMult
    if (evt.effects.priceItems?.includes(item) && evt.effects.priceMultiplier) {
      mult *= evt.effects.priceMultiplier
    }
  }
  return mult
}

export function getWorldEventFuelBonus(events: WorldEvent[]): number {
  return events.reduce((sum, e) => sum + (e.effects.fuelCostBonus ?? 0), 0)
}

export function getWorldEventCombatBonus(events: WorldEvent[]): number {
  return events.reduce((sum, e) => sum + (e.effects.combatChanceBonus ?? 0), 0)
}

export function getClosedStations(events: WorldEvent[]): Set<string> {
  return new Set(events.flatMap(e => e.effects.closedStations ?? []))
}
