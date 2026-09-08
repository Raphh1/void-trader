import type { PlayerClass } from '../types'
import i18n from '../i18n/config'

const cl = (key: string) => i18n.t(key, { ns: 'classes' })

export function getClasses(): PlayerClass[] {
  return [
  // ── MAUVAISES ────────────────────────────────────────────────────────────
  {
    name: 'Vagabond',
    description: cl('vagabond.description'),
    tier: 'bad',
    startCredits: 500, startFuel: 3, maxFuel: 6, startHp: 85, startStamina: 95,
    startStation: 'La Carcasse',
    bonusDesc: cl('vagabond.bonusDesc'),
    color: '#a040ff', icon: '★',
    combatAttackMult: 1.15, combatDefenseMult: 1.15, combatCritBonus: 15,
  },
  {
    name: 'Ferrailleur',
    description: cl('ferrailleur.description'),
    tier: 'bad',
    startCredits: 800, startFuel: 5, maxFuel: 8, startHp: 95, startStamina: 90,
    startStation: 'La Carcasse',
    bonusDesc: cl('ferrailleur.bonusDesc'),
    color: '#a06020', icon: '🔧',
    cargoDegrades: true,
    combatAttackMult: 0.85, combatDefenseMult: 0.85, combatStaminaRegen: -5,
  },
  {
    name: 'Endetté',
    description: cl('endette.description'),
    tier: 'bad',
    startCredits: 1200, startFuel: 5, maxFuel: 8, startHp: 90, startStamina: 90,
    startStation: 'La Carcasse',
    bonusDesc: cl('endette.bonusDesc'),
    color: '#ff6060', icon: '💸',
    dailyDebt: 50,
  },
  {
    name: 'Accro',
    description: cl('accro.description'),
    tier: 'bad',
    startCredits: 1000, startFuel: 5, maxFuel: 8, startHp: 80, startStamina: 120,
    startStation: 'La Carcasse',
    bonusDesc: cl('accro.bonusDesc'),
    color: '#ff40a0', icon: '💉',
    travelCreditCost: 100,
    combatAttackMult: 1.25, combatDefenseMult: 1.20, combatCritBonus: 5, combatStaminaRegen: 15,
  },
  {
    name: 'Rayane',
    description: cl('rayane.description'),
    tier: 'bad',
    startCredits: 300, startFuel: 3, maxFuel: 5, startHp: 65, startStamina: 80,
    startStation: 'La Carcasse',
    bonusDesc: cl('rayane.bonusDesc'),
    color: '#ffcc00', icon: '🪙',
    combatAttackMult: 0.65, combatDefenseMult: 1.35,
  },
  {
    name: 'Maudit',
    description: cl('maudit.description'),
    tier: 'bad',
    startCredits: 1000, startFuel: 5, maxFuel: 8, startHp: 90, startStamina: 90,
    startStation: 'La Carcasse',
    bonusDesc: cl('maudit.bonusDesc'),
    color: '#8040ff', icon: '☠',
    cursedEvents: true,
    combatAttackMult: 0.90, combatDefenseMult: 1.05,
  },

  // ── ÉQUILIBRÉES ───────────────────────────────────────────────────────────
  {
    name: 'Marchand',
    description: cl('marchand.description'),
    tier: 'balanced',
    startCredits: 1000, startFuel: 5, maxFuel: 8, startHp: 100, startStamina: 100,
    startStation: 'Port Méridien',
    bonusDesc: cl('marchand.bonusDesc'),
    color: '#c0c0c0', icon: '📦',
    // Sa description promettait « Bonus sur les négociations » sans qu'aucune
    // mécanique n'existe : le Marchand était la seule classe sans effet du tout.
    tradeBonusPercent: 15,
  },
  {
    name: 'Mécanicien',
    description: cl('mecanicien.description'),
    tier: 'balanced',
    startCredits: 600, startFuel: 8, maxFuel: 12, startHp: 105, startStamina: 110,
    startStation: 'La Carcasse',
    bonusDesc: cl('mecanicien.bonusDesc'),
    color: '#40a0ff', icon: '⚙',
    combatDefenseMult: 0.90, combatStaminaRegen: 10,
  },
  {
    name: 'Explorateur',
    description: cl('explorateur.description'),
    tier: 'balanced',
    startCredits: 900, startFuel: 6, maxFuel: 9, startHp: 100, startStamina: 105,
    startStation: 'Port Méridien',
    bonusDesc: cl('explorateur.bonusDesc'),
    color: '#40d0ff', icon: '🗺',
    neutralEventsBoost: true,
    combatCritBonus: 8, combatStaminaRegen: 5,
  },
  {
    name: 'Médecin',
    description: cl('medecin.description'),
    tier: 'balanced',
    startCredits: 900, startFuel: 5, maxFuel: 8, startHp: 110, startStamina: 100,
    startStation: 'Port Méridien',
    bonusDesc: cl('medecin.bonusDesc'),
    color: '#40ff80', icon: '✚',
    medicBonus: true,
    combatAttackMult: 0.80, combatDefenseMult: 0.88, combatStaminaRegen: 5,
  },

  // ── BONNES ────────────────────────────────────────────────────────────────
  {
    name: 'Contrebandier',
    description: cl('contrebandier.description'),
    tier: 'good',
    startCredits: 1000, startFuel: 5, maxFuel: 8, startHp: 88, startStamina: 100,
    startStation: 'Les Bas-Fonds de Vega',
    bonusDesc: cl('contrebandier.bonusDesc'),
    color: '#ff8040', icon: '🏃',
    buyDiscountPercent: 20, piratesDoubled: true,
    combatAttackMult: 1.05, combatDefenseMult: 0.95, combatStaminaRegen: 8,
  },
  {
    name: 'Vétéran',
    description: cl('veteran.description'),
    tier: 'good',
    startCredits: 2000, startFuel: 6, maxFuel: 9, startHp: 120, startStamina: 110,
    startStation: 'La Citadelle Écarlate',
    bonusDesc: cl('veteran.bonusDesc'),
    color: '#c0c0c0', icon: '🎖',
    combatAttackMult: 1.30, combatDefenseMult: 0.80, combatCritBonus: 5, combatMomentumStart: 1,
  },
  {
    name: 'Héritier',
    description: cl('heritier.description'),
    tier: 'good',
    startCredits: 1000, startFuel: 5, maxFuel: 8, startHp: 95, startStamina: 90,
    startStation: 'La Citadelle Écarlate',
    bonusDesc: cl('heritier.bonusDesc'),
    color: '#ffd700', icon: '👑',
    cannotBuyWeapons: true, periodicIncome: 300,
    combatAttackMult: 0.70, combatDefenseMult: 1.00,
  },
  {
    name: 'Hackeur',
    description: cl('hackeur.description'),
    tier: 'good',
    startCredits: 900, startFuel: 5, maxFuel: 8, startHp: 80, startStamina: 110,
    startStation: 'La Citadelle Écarlate',
    bonusDesc: cl('hackeur.bonusDesc'),
    color: '#40ffff', icon: '💻',
    seesPrices: true,
    combatAttackMult: 0.82, combatDefenseMult: 1.00, combatStaminaRegen: 12,
  },
  {
    name: 'Seigneur de guerre',
    description: cl('seigneurDeGuerre.description'),
    tier: 'good',
    startCredits: 1500, startFuel: 5, maxFuel: 8, startHp: 140, startStamina: 115,
    startStation: 'Fort Kharos',
    bonusDesc: cl('seigneurDeGuerre.bonusDesc'),
    color: '#ff4040', icon: '⚔',
    autoKillsPirates: true, peacefulBan: true,
    combatAttackMult: 1.50, combatDefenseMult: 0.82, combatCritBonus: 10, combatMomentumStart: 1,
  },
  ]
}

export function getClassesByTier() {
  const classes = getClasses()
  return {
    bad:      classes.filter(c => c.tier === 'bad'),
    balanced: classes.filter(c => c.tier === 'balanced'),
    good:     classes.filter(c => c.tier === 'good'),
  }
}
