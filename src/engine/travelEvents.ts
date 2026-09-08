import type { GameState } from '../types'
import i18n from '../i18n/config'

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const roll = (chance: number) => Math.random() * 100 < chance
const te = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'travelEvents', ...params })

export interface TravelEvent {
  title: string
  description: string
  effect: (gs: GameState) => Partial<GameState> & { message?: string }
}

function getPositiveEvents(): TravelEvent[] {
  return [
  { title: te('positive.wreck.title'),       description: te('positive.wreck.description'),
    effect: gs => { const amount = rng(150, 500); return { credits: gs.credits + amount, message: te('positive.wreck.message', { amount }) } } },
  { title: te('positive.stowaway.title'),    description: te('positive.stowaway.description'),
    effect: gs => { const amount = rng(200, 600); return { credits: gs.credits + amount, message: te('positive.stowaway.message', { amount }) } } },
  { title: te('positive.distress.title'),       description: te('positive.distress.description'),
    effect: gs => ({ credits: gs.credits + rng(300, 800), reputation: gs.reputation + 10, message: te('positive.distress.message') }) },
  { title: te('positive.shortcut.title'),          description: te('positive.shortcut.description'),
    effect: gs => ({ fuel: Math.min(gs.maxFuel, gs.fuel + 1), message: te('positive.shortcut.message') }) },
  { title: te('positive.smugglerFriend.title'),      description: te('positive.smugglerFriend.description'),
    effect: gs => ({ cargo: { ...gs.cargo, 'Médicaments': (gs.cargo['Médicaments'] ?? 0) + 2 }, message: te('positive.smugglerFriend.message') }) },
  { title: te('positive.tradeData.title'),   description: te('positive.tradeData.description'),
    effect: gs => ({ credits: gs.credits + rng(100, 300), message: te('positive.tradeData.message') }) },
  ]
}

function getNegativeEvents(): TravelEvent[] {
  return [
  { title: te('negative.engineFailure.title'),           description: te('negative.engineFailure.description'),
    effect: gs => ({ fuel: Math.max(0, gs.fuel - 1), shipHp: Math.max(0, gs.shipHp - rng(8, 20)), message: te('negative.engineFailure.message') }) },
  { title: te('negative.ionStorm.title'),        description: te('negative.ionStorm.description'),
    effect: gs => ({ shipHp: Math.max(0, gs.shipHp - rng(10, 25)), message: te('negative.ionStorm.message') }) },
  { title: te('negative.fuelTheft.title'),       description: te('negative.fuelTheft.description'),
    effect: gs => ({ fuel: Math.max(0, gs.fuel - 1), message: te('negative.fuelTheft.message') }) },
  { title: te('negative.wrongTurn.title'),           description: te('negative.wrongTurn.description'),
    effect: gs => ({ day: gs.day + 1, message: te('negative.wrongTurn.message') }) },
  { title: te('negative.cargoHit.title'),        description: te('negative.cargoHit.description'),
    effect: gs => {
      const keys = Object.keys(gs.cargo)
      if (keys.length === 0) return { message: te('negative.cargoHit.messageEmpty') }
      const lost = keys[Math.floor(Math.random() * keys.length)]
      const newCargo = { ...gs.cargo }
      newCargo[lost] = Math.max(0, (newCargo[lost] ?? 0) - 1)
      if (newCargo[lost] === 0) delete newCargo[lost]
      return { cargo: newCargo, message: te('negative.cargoHit.messageLost', { item: lost }) }
    }
  },
  ]
}

function getPirateEvent(): TravelEvent {
  return {
    title: te('pirateAttack.title'),
    description: te('pirateAttack.description'),
    effect: gs => ({ message: "COMBAT_TRIGGER" })
  }
}

function getBountyEvent(): TravelEvent {
  return {
    title: te('bountyHunter.title'),
    description: te('bountyHunter.description'),
    effect: gs => ({ message: "BOUNTY_TRIGGER" })
  }
}

export function rollTravelEvent(gs: GameState): TravelEvent | null {
  // Seigneur de guerre : pirates auto-résolus
  if (gs.class.autoKillsPirates && Math.random() < 0.3) {
    return {
      title: te('pirateIntimidated.title'),
      description: te('pirateIntimidated.description'),
      effect: (gs) => ({ reputation: gs.reputation + 5, message: te('pirateIntimidated.message') })
    }
  }

  // Chasseur de primes si réputation très négative
  if (gs.reputation <= -100 && Math.random() < 0.15) {
    return getBountyEvent()
  }

  // Pirates
  const pirateMult = gs.class.piratesDoubled ? 2 : 1
  if (Math.random() < 0.15 * pirateMult) {
    return getPirateEvent()
  }

  // Événement positif
  if (Math.random() < 0.25) {
    const positiveEvents = getPositiveEvents()
    const ev = positiveEvents[Math.floor(Math.random() * positiveEvents.length)]
    // Classe Maudit : 50% chance que l'événement positif fizzle
    if (gs.class.cursedEvents && Math.random() < 0.5) {
      return { title: ev.title, description: ev.description + te('cursedSuffix'), effect: gs => ({ message: te('cursedMessage') }) }
    }
    return ev
  }

  // Événement négatif
  if (Math.random() < 0.20) {
    const negativeEvents = getNegativeEvents()
    return negativeEvents[Math.floor(Math.random() * negativeEvents.length)]
  }

  return null
}

// Appliquer les effets de classe au voyage
export function applyClassTravelEffects(gs: GameState): Partial<GameState> {
  const changes: Partial<GameState> = {}

  // Accro : -100cr par voyage
  if (gs.class.travelCreditCost && gs.class.travelCreditCost > 0) {
    changes.credits = Math.max(0, gs.credits - gs.class.travelCreditCost)
  }

  // Ferrailleur : 30% chance de perdre un cargo
  if (gs.class.cargoDegrades && Math.random() < 0.30) {
    const keys = Object.keys(gs.cargo)
    if (keys.length > 0) {
      const lost = keys[Math.floor(Math.random() * keys.length)]
      const newCargo = { ...gs.cargo }
      newCargo[lost] = Math.max(0, (newCargo[lost] ?? 0) - 1)
      if (newCargo[lost] === 0) delete newCargo[lost]
      changes.cargo = newCargo
    }
  }

  // Héritier : revenu périodique toutes les 5 jours
  if (gs.class.periodicIncome && gs.class.periodicIncome > 0) {
    if (gs.day % 5 === 0 && gs.day !== gs.lastIncomeDay) {
      changes.credits = (changes.credits ?? gs.credits) + gs.class.periodicIncome
      changes.lastIncomeDay = gs.day
    }
  }

  return changes
}

// Clock : 3 actions terrain = 1 jour
export function spendAction(gs: GameState): Partial<GameState> {
  const newActions = gs.actionsToday + 1

  // Folie — la faim du cannibale monte même hors combat/voyage, à chaque
  // action passée sans se nourrir. Seule la Morsure en combat la fait
  // redescendre : ça pousse le joueur à chercher le conflit plutôt qu'à l'éviter.
  const folieChanges: Partial<GameState> = gs.moralTags.includes('cannibal')
    ? { folieLevel: Math.min(100, (gs.folieLevel ?? 0) + 6) }
    : {}

  if (newActions >= 3) {
    const dayChanges: Partial<GameState> = {
      ...folieChanges,
      actionsToday: 0,
      day: gs.day + 1,
    }
    // Dette quotidienne : classe Endetté, emprunts contractés et modificateurs
    // de run s'y cumulent via debtDailyAmount.
    const dette = gs.debtDailyAmount ?? gs.class.dailyDebt ?? 0
    if (dette > 0) {
      dayChanges.credits = Math.max(0, gs.credits - dette)
    }
    return dayChanges
  }
  return { ...folieChanges, actionsToday: newActions }
}
