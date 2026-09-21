// Butin des lieutenants des piliers (cf. subBosses.ts, champ `reward`).
// Ces récompenses étaient déclarées mais jamais données : seules les récompenses
// en crédits ou en réputation étaient appliquées, et les armes, armures et
// objets nommés n'existaient nulle part dans les données.
//
// Armes et armures sont UNIQUES : elles ne figurent pas dans getWeapons() /
// getArmors(), donc ne tombent jamais en butin aléatoire. Leur puissance suit
// l'ordre du lieutenant (1-2 : tier 3, 3-4 : tier 4) — on les affronte en
// milieu et fin de run.
//
// Les objets nommés (dossiers, carnets…) sont du renseignement : ils se
// convertissent en marchandises d'information qui ont déjà un usage au hub
// (revente, réputation), plutôt que d'inventer un objet de cargo sans emploi.
import type { WeaponData, ArmorData, GameState, SubBossData, Cargo } from '../types'
import i18n from '../i18n/config'
import { grantArmor } from './armors'

const lr = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'subBosses', ...params })

const w = (
  name: string, key: string, tier: number, dMin: number, dMax: number, crit: number,
  effect: WeaponData['effect'], effectChance: number, affinities: WeaponData['affinities'] = {},
): WeaponData => ({
  name, tier, damageMin: dMin, damageMax: dMax, critChance: crit,
  effect, effectChance, effectDesc: lr(`rewards.weapons.${key}`),
  selfDmgChance: 0, selfDmgMax: 0, affinities,
})

const a = (
  name: string, key: string, tier: number, defense: number, hpBonus: number,
  effect: ArmorData['effect'], effectValue: number, sellValue: number,
): ArmorData => ({ name, tier, defense, hpBonus, effect, effectValue, description: lr(`rewards.armors.${key}`), sellValue })

function getRewardWeapons(): WeaponData[] {
  return [
    w('Lunette du Vigie',           'lunetteVigie',     3, 24, 48, 28, 'silence',     40, { Vétéran: 1.2, Explorateur: 1.15 }),
    w('Dague empoisonnée de Morte', 'dagueMorte',       3, 16, 34, 18, 'poison',      60, { Vagabond: 1.2, Contrebandier: 1.2 }),
    w('Dague de la Nuit',           'dagueNuit',        3, 18, 36, 24, 'blind',       35, { Contrebandier: 1.2, Hackeur: 1.1 }),
    w('Lame de la Faucon',          'lameFaucon',       4, 32, 64, 26, 'double_strike', 0, { 'Seigneur de guerre': 1.2, Vétéran: 1.15 }),
    w('Lame Fantôme du 7e',         'lameFantome7e',    4, 28, 56, 30, 'armorPierce',  0, { Vétéran: 1.2, Vagabond: 1.1 }),
    w('Le Poing du Maréchal',       'poingMarechal',    4, 30, 60, 18, 'stun',        40, { 'Seigneur de guerre': 1.2 }),
    w('Scalpel de Velkor',          'scalpelVelkor',    4, 22, 46, 30, 'lifesteal',    0, { Médecin: 1.25, Hackeur: 1.1 }),
  ]
}

function getRewardArmors(): ArmorData[] {
  return [
    a('Armure de la Veuve',     'armureVeuve',       3, 30, 15, 'thorns',       35,  850),
    a('Cape des Ombres',        'capeOmbres',        4, 30, 15, 'staminaBoost', 25, 1500),
    a('Uniforme Diplomatique',  'uniformeDiplo',     4, 30, 25, 'regen',        10, 1600),
    a('Armure Prédictive',      'armurePredictive',  4, 36, 20, 'immunity',      1, 2000),
  ]
}

// Objet nommé → marchandise d'information déjà exploitable au hub.
const ITEM_CARGO: Record<string, { good: string; qty: number; key: string }> = {
  'Carte des routes Faucon':              { good: 'Renseignements',           qty: 2, key: 'carteFaucon' },
  'Dossier Cesarion':                     { good: 'Informations VIP',         qty: 2, key: 'dossierCesarion' },
  "Plaque d'identification 3e Bataillon": { good: 'Intel faction',            qty: 2, key: 'plaque3eBataillon' },
  'Carnet de Chantage':                   { good: 'Informations monnayables', qty: 3, key: 'carnetChantage' },
}

export function getLieutenantRewardWeapon(name: string): WeaponData | undefined {
  return getRewardWeapons().find(x => x.name === name)
}

export function getLieutenantRewardArmor(name: string): ArmorData | undefined {
  return getRewardArmors().find(x => x.name === name)
}

/** Libellé court du butin, pour l'afficher avant le combat. */
export function describeLieutenantReward(sb: SubBossData, names: {
  weapon: (n: string) => string; armor: (n: string) => string; good: (n: string) => string
}): string {
  const { type, value } = sb.reward
  switch (type) {
    case 'credits': return lr('rewards.label.credits', { amount: (value as number).toLocaleString() })
    case 'rep':     return lr('rewards.label.rep', { amount: value })
    case 'weapon':  return lr('rewards.label.weapon', { name: names.weapon(value as string) })
    case 'armor':   return lr('rewards.label.armor', { name: names.armor(value as string) })
    case 'item': {
      const it = ITEM_CARGO[value as string]
      return it ? lr('rewards.label.item', { name: lr(`rewards.items.${it.key}`), qty: it.qty, good: names.good(it.good) }) : ''
    }
  }
}

/** Applique le butin d'un lieutenant vaincu au combat. */
export function grantLieutenantReward(gs: GameState, sb: SubBossData, names: {
  weapon: (n: string) => string; armor: (n: string) => string; good: (n: string) => string
}): { patch: Partial<GameState>; message: string | null } {
  const { type, value } = sb.reward
  switch (type) {
    case 'credits':
      return { patch: { credits: gs.credits + (value as number) }, message: lr('rewards.granted.credits', { amount: (value as number).toLocaleString() }) }
    case 'rep':
      return { patch: { reputation: gs.reputation + (value as number) }, message: lr('rewards.granted.rep', { amount: value }) }
    case 'weapon': {
      const weapon = getLieutenantRewardWeapon(value as string)
      if (!weapon) return { patch: {}, message: null }
      return { patch: { weapons: [...gs.weapons, weapon] }, message: lr('rewards.granted.weapon', { name: names.weapon(weapon.name) }) }
    }
    case 'armor': {
      const armor = getLieutenantRewardArmor(value as string)
      if (!armor) return { patch: {}, message: null }
      const patch = grantArmor(gs, armor)
      // grantArmor revend l'armure si elle est déjà possédée : le dire au joueur.
      const message = patch.armors
        ? lr('rewards.granted.armor', { name: names.armor(armor.name) })
        : lr('rewards.granted.armorSold', { name: names.armor(armor.name), amount: armor.sellValue.toLocaleString() })
      return { patch, message }
    }
    case 'item': {
      const it = ITEM_CARGO[value as string]
      if (!it) return { patch: {}, message: null }
      const cargo: Cargo = { ...gs.cargo, [it.good]: (gs.cargo[it.good] ?? 0) + it.qty }
      return { patch: { cargo }, message: lr('rewards.granted.item', { name: lr(`rewards.items.${it.key}`), qty: it.qty, good: names.good(it.good) }) }
    }
  }
}
