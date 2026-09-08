import type { CombatState, CombatLogEntry, Enemy, GameState, WeaponData, CombatOutcome, CombatStance, EnemyIntent, PlayerClassName } from '../types'
import { rollWeaponForTier } from '../data/weapons'
import { rollArmorForTier, grantArmor } from '../data/armors'
import i18n from '../i18n/config'
import { translateEnemyName } from './goodsI18n'

const ct = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'combat', ...params })

let logId = 0
function log(text: string, type: CombatLogEntry['type']): CombatLogEntry {
  return { id: logId++, text, type }
}

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const roll = (chance: number) => Math.random() * 100 < chance

// Rayane — sursis de mort à pile ou face, une seule fois par run. Face = pas
// de miracle, la résolution normale (mort/capture/assommé) suit son cours.
function tryDeathFlip(gs: GameState, addLog: (t: string, type: CombatLogEntry['type']) => void):
  { survived: boolean; flag?: 'rayaneDeathFlipUsed' | 'cursedSurvivalUsed' } {
  // Rayane joue sa vie à pile ou face, une fois par run.
  if (gs.class.name === 'Rayane' && !gs.rayaneDeathFlipUsed) {
    const heads = roll(50)
    addLog(heads ? ct('deathFlipHeads') : ct('deathFlipTails'), heads ? 'crit' : 'warning')
    // Le pile ou face est dépensé qu'il réussisse ou non.
    return { survived: heads, flag: 'rayaneDeathFlipUsed' }
  }
  // Le Maudit ne peut pas mourir tant que sa malédiction n'a pas été dépensée :
  // une fois par run, elle le ramène à 1 PV. C'est sa compétence non combattante.
  if (gs.class.name === 'Maudit' && !gs.cursedSurvivalUsed) {
    addLog(ct('cursedSurvival'), 'crit')
    return { survived: true, flag: 'cursedSurvivalUsed' }
  }
  return { survived: false }
}

export function initCombat(enemy: Enemy): CombatState {
  return {
    enemyHp: enemy.maxHp,
    enemyStunTurns: 0,
    enemyBurnDmg: 0,
    enemyBurnTurns: 0,
    enemyBlinded: false,
    playerFled: false,  
    immunityUsed: false,
    playerStance: 'normal',
    momentum: 0,
    classActionUsed: false,
    currentIntent: 'normal',
    enemyCharging: false,
    enemyWeaponDisabledTurns: 0,
    lastPlayerDmg: 0,
    playerWeakenedTurns: 0,
    playerStunnedTurns: 0,
    playerBurnDmg: 0,
    playerBurnTurns: 0,
    enemyWeakenedTurns: 0,
    enemyConfusedTurns: 0,
    enemySilencedTurns: 0,
    playerExposedTurns: 0,
    medicUses: 0,
    turnCount: 0,
    subBossShadowHits: 0,
    subBossDefenseStacks: 0,
    fleeAttempts: 0,
    escortHits: 0,
    log: [],
  }
}

function generateIntent(enemy: Enemy, cs: CombatState): EnemyIntent {
  // Silence — l'ennemi ne peut qu'attaquer normalement ou se défendre
  if (cs.enemySilencedTurns > 0) {
    const rs = rng(0, 99)
    return rs < 65 ? 'normal' : 'defend'
  }

  const r = rng(0, 99)
  const lowHp = cs.enemyHp < enemy.maxHp * 0.35

  // Personnages piliers — capacité unique (30 % de chance, 40 % si PV bas)
  if (enemy.pillarAbility) {
    const threshold = lowHp ? 40 : 30
    if (r < threshold) return enemy.pillarAbility
    if (r < threshold + 12) return 'blood_rage'
    if (r < threshold + 22) return 'execution'
    if (lowHp) return r < threshold + 32 ? 'heavy' : 'charge'
    if (r < threshold + 30) return 'heavy'
    if (r < threshold + 42) return 'charge'
    if (r < threshold + 52) return 'defend'
    if (r < threshold + 62) return 'disarm'
    return 'normal'
  }

  // Tous les boss puissants — attaques spéciales génériques
  if (enemy.isBoss) {
    if (lowHp) return r < 45 ? 'heavy' : r < 60 ? 'charge' : r < 72 ? 'blood_rage' : r < 82 ? 'execution' : 'normal'
    if (r < 20) return 'normal'
    if (r < 34) return 'heavy'
    if (r < 46) return 'defend'
    if (r < 58) return 'charge'
    if (r < 68) return 'disarm' 
    if (r < 78) return 'blood_rage'
    if (r < 88) return 'execution'
    return 'weaken'
  }

  // Ennemis normaux
  if (lowHp) return r < 50 ? 'heavy' : r < 70 ? 'charge' : 'normal'
  if (r < 50) return 'normal'
  if (r < 65) return 'heavy'
  if (r < 75) return 'defend'
  if (r < 87) return 'charge'
  return 'disarm'
}

// Bonus de combat propres aux classes guerrières. Exprimés en multiplicateur
// (et non en bonus plat) pour rester proportionnés du tier 1 au tier 5 : un
// "+8-20" plat doublerait un couteau de rue mais serait négligeable sur une
// arme de fin de jeu. Ces valeurs reproduisent l'intention d'origine (~+25 % pour
// le Seigneur de guerre, ~+15 % pour le Vétéran) à l'échelle d'une arme équipée.
const CLASS_WEAPON_MULT: Partial<Record<PlayerClassName, number>> = {
  'Seigneur de guerre': 1.25,
  'Vétéran': 1.15,
  'Vagabond': 0.92,
}

// Plafond de dégâts par coup contre un sous-boss. Par défaut 20 % de ses PV
// max ; relevé au cas par cas (voir data/subBosses.ts) pour les lieutenants qui
// annulent ou absorbent déjà une partie des coups, sinon les deux effets se
// cumulent et le combat devient ingagnable même en équipement maximal.
function subBossHitCap(enemy: Enemy): number {
  return Math.ceil(enemy.maxHp * (enemy.damageCapPct ?? 0.20))
}

function calcWeaponDamage(weapon: WeaponData, className: PlayerClassName, special: boolean, critBonus = 0): { dmg: number; crit: boolean } {
  let dmg = rng(weapon.damageMin, weapon.damageMax)
  const affinity = weapon.affinities[className] ?? 1.0
  dmg = Math.floor(dmg * affinity)
  // Le bonus de classe s'appliquait uniquement à mains nues : les classes de
  // combat perdaient donc toute identité offensive dès qu'elles s'équipaient,
  // c'est-à-dire exactement quand ça compte (boss de fin de jeu).
  dmg = Math.floor(dmg * (CLASS_WEAPON_MULT[className] ?? 1.0))
  if (weapon.effect === 'armorPierce') dmg = Math.floor(dmg * 1.3)
  const critChance = (special ? weapon.critChance + 10 : weapon.critChance) + critBonus
  const crit = roll(critChance)
  if (crit) dmg = Math.floor(dmg * 2)
  return { dmg: Math.max(1, dmg), crit }
}

function calcBareDamage(className: PlayerClassName, critBonus = 0): { dmg: number; crit: boolean } {
  let base = rng(5, 18)
  if (className === 'Seigneur de guerre') base += rng(8, 20)
  else if (className === 'Vétéran') base += rng(5, 12)
  else if (className === 'Vagabond') base -= rng(0, 5)
  const crit = roll(10 + critBonus)
  if (crit) base = Math.floor(base * 2)
  return { dmg: Math.max(1, base), crit }
}

// precisionMult : multiplicateur de dégâts injecté par le mini-jeu de coup ciblé
// contre un sous-boss (StopTheBar / HackSequence). Absent = 1 (combat normal).
export type CombatAction =
  | { type: 'attack';    precisionMult?: number }
  | { type: 'offensive'; precisionMult?: number }
  | { type: 'defensive'; precisionMult?: number }
  | { type: 'dodge';     precisionMult?: number }
  | { type: 'focused';   precisionMult?: number }
  | { type: 'special';   precisionMult?: number }
  | { type: 'finisher';  precisionMult?: number }
  | { type: 'class' }
  | { type: 'flee' }
  | { type: 'negotiate' }
  | { type: 'negotiate-accept' }
  | { type: 'intimidate' }
  | { type: 'heal' }
  | { type: 'bite' }
  | { type: 'drug' }
  | { type: 'rest' }
  | { type: 'water' }
  | { type: 'food' }
  | { type: 'herb' }
  | { type: 'alcohol' }
  | { type: 'premium_med' }

export interface CombatResult {
  newGs: Partial<GameState>
  newCs: CombatState
  outcome?: CombatOutcome
  reward?: { loot: number; weaponName?: string; armorName?: string; isBossKill: boolean }
}

export function processCombatAction(
  gs: GameState,
  cs: CombatState,
  enemy: Enemy,
  action: CombatAction
): CombatResult {
  const newCs: CombatState = { ...cs, log: [] }
  // PV réels de l'ennemi, NON clampés à 0. newCs.enemyHp est clampé pour
  // l'affichage, ce qui fait disparaître le surplus d'un coup fatal ; les
  // mécaniques de mitigation des sous-boss « remboursaient » ensuite un
  // pourcentage des dégâts bruts sur cette valeur déjà remise à zéro, et
  // ressuscitaient l'ennemi. La Veuve de Fer, qui absorbe 40 % sans aucune
  // condition, en devenait strictement immortelle (0 % de victoire quel que
  // soit le plafond). On rembourse donc sur la valeur vraie.
  let enemyHpTrue = cs.enemyHp

  /** Rend des PV à l'ennemi sans jamais le ramener d'entre les morts. */
  function mitigate(amount: number) {
    enemyHpTrue += amount
    newCs.enemyHp = Math.max(0, Math.min(enemy.maxHp, enemyHpTrue))
  }
  newCs.turnCount = (cs.turnCount ?? 0) + 1
  const newGs: Partial<GameState> = {}
  let playerHp = gs.playerHp
  let stamina  = gs.stamina
  let credits  = gs.credits
  let reputation = gs.reputation
  let equippedWeapon = gs.equippedWeapon
  let cargo = { ...gs.cargo }

  const weapon = equippedWeapon
  const isSubBoss = !!enemy.isSubBoss
  const sbTurn = newCs.turnCount

  function addLog(text: string, type: CombatLogEntry['type'] = 'info') {
    newCs.log.push(log(text, type))
  }

  // ── FOLIE — la faim monte à chaque tour si le cannibale ne se nourrit pas.
  // Seule la Morsure fait redescendre la jauge : ignorer la faim en combat
  // a un coût, même si mordre ne fait presque plus de dégâts.
  if (gs.moralTags.includes('cannibal') && action.type !== 'bite') {
    newGs.folieLevel = Math.min(100, (gs.folieLevel ?? 0) + 10)
  }

  // ── SUB-BOSS PRE-ATTACK — Le Vigie Immortel attaque en premier ────────
  if (isSubBoss && enemy.name === 'Le Vigie Immortel') {
    const preStrikeDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 0.4)
    playerHp = Math.max(0, playerHp - preStrikeDmg)
    addLog(ct('preemptiveStrike', { dmg: preStrikeDmg, hp: playerHp, max: gs.playerMaxHp }), 'enemy')
    if (playerHp <= 0) {
      const flip = tryDeathFlip(gs, addLog)
      if (flip.survived) {
        playerHp = 1
        if (flip.flag) newGs[flip.flag] = true
      } else {
        const r2 = Math.random() * 100
        let outcome2: CombatOutcome = 'stunned'
        if (r2 < enemy.killChance) outcome2 = 'dead'
        else if (r2 < enemy.killChance + enemy.captureChance) outcome2 = 'captured'
        return {
          newGs: { ...newGs, ...(flip.flag ? { [flip.flag]: true } : {}), playerHp: outcome2 === 'captured' ? Math.floor(gs.playerMaxHp / 2) : 0, stamina, credits, reputation, equippedWeapon, cargo },
          newCs, outcome: outcome2,
        }
      }
    }
  }

  // ── PLAYER ACTION ──────────────────────────────────────────────────────

  // Stun joueur (attaque spéciale Eliotis — party_over)
  if (newCs.playerStunnedTurns > 0) {
    newCs.playerStunnedTurns--
    addLog(ct('playerStunned', { n: newCs.playerStunnedTurns, s: newCs.playerStunnedTurns !== 1 ? 's' : '' }), 'warning')
    // Passe directement au tour ennemi — sans traiter l'action
    newCs.currentIntent = newCs.enemyCharging ? 'heavy' : generateIntent(enemy, newCs)
    if (newCs.enemyStunTurns > 0) {
      newCs.enemyStunTurns--
      newCs.enemyCharging = false
      addLog(ct('enemyStunnedSkip', { enemy: translateEnemyName(enemy.name) }), 'info')
    } else {
      const enemyDmg2 = Math.floor(rng(enemy.damageMin, enemy.damageMax) * (gs.class.combatDefenseMult ?? 1.0))
      const armor2 = gs.equippedArmor
      const reduced2 = armor2 ? Math.floor(enemyDmg2 * armor2.defense / 100) : 0
      const finalDmg2 = Math.max(0, enemyDmg2 - reduced2)
      if (finalDmg2 > 0) {
        playerHp = Math.max(0, playerHp - finalDmg2)
        addLog(ct('vulnerableHit', { enemy: translateEnemyName(enemy.name), dmg: finalDmg2, hp: playerHp, max: gs.playerMaxHp }), 'enemy')
      }
    }
    if (playerHp <= 0) {
      const flip = tryDeathFlip(gs, addLog)
      if (flip.survived) {
        playerHp = 1
        if (flip.flag) newGs[flip.flag] = true
      } else {
        addLog(ct('youFall', { enemy: translateEnemyName(enemy.name) }), 'enemy')
        const r2 = Math.random() * 100
        let outcome2: CombatOutcome = 'stunned'
        if (r2 < enemy.killChance) outcome2 = 'dead'
        else if (r2 < enemy.killChance + enemy.captureChance) outcome2 = 'captured'
        const survivedHp = outcome2 === 'captured' ? Math.floor(gs.playerMaxHp / 2) : 0
        return {
          newGs: { ...newGs, ...(flip.flag ? { [flip.flag]: true } : {}), playerHp: survivedHp, stamina, credits, reputation, equippedWeapon, cargo },
          newCs, outcome: outcome2,
        }
      }
    }
    return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
  }

  if (newCs.playerWeakenedTurns > 0) newCs.playerWeakenedTurns--

  newCs.lastPlayerDmg = 0
  newCs.playerStance = 'normal'

  // Coup ciblé sous-boss : le mini-jeu module les dégâts du coup (1 = neutre).
  const precisionMult = (action as { precisionMult?: number }).precisionMult ?? 1

  function dealPlayerDamage(mult = 1.0, useSpecial = false, ignoreArmor = false, stance: CombatStance = 'normal') {
    const critBonus = gs.class.combatCritBonus ?? 0
    const attackMult = gs.class.combatAttackMult ?? 1.0
    let result: { dmg: number; crit: boolean }
    if (weapon) {
      result = calcWeaponDamage(weapon, gs.class.name, useSpecial, critBonus)
    } else {
      result = calcBareDamage(gs.class.name, critBonus)
    }
    const folie = gs.folieLevel ?? 0
    const isCannibal = gs.moralTags.includes('cannibal')
    const folieMult = folie >= 90 ? 0.60 : folie >= 70 ? 0.78 : folie >= 40 ? 0.90 : (isCannibal ? 1.15 : 1.0)
    const weakenMult = newCs.playerWeakenedTurns > 0 ? 0.65 : 1.0
    const coupDeGrace = (gs.class.coupDeGraceBonus ?? 0) > 0 && newCs.enemyHp < enemy.maxHp * 0.25
      ? 1 + (gs.class.coupDeGraceBonus ?? 0) / 100
      : 1.0
    let dmg = Math.floor(result.dmg * mult * attackMult * folieMult * weakenMult * coupDeGrace * precisionMult)
    // Plafond anti-farm des sous-boss, appliqué AVANT de retirer les PV.
    // Auparavant on retirait les dégâts bruts (clampés à 0 par Math.max) puis on
    // « remboursait » le surplus : quand un gros coup dépassait les PV restants,
    // le surplus perdu au clamp était rendu quand même et le sous-boss REMONTAIT
    // en PV. Plus l'arme était puissante, plus elle le soignait — Le Vigie
    // Immortel en devenait invincible (0 % de victoire en équipement maximal).
    if (isSubBoss) dmg = Math.min(dmg, subBossHitCap(enemy))
    if (precisionMult >= 1.5) addLog(ct('perfectHit'), 'crit')
    else if (precisionMult <= 0.6) addLog(ct('badHit'), 'warning')
    if (result.crit) addLog(ct('critHit'), 'crit')
    enemyHpTrue -= dmg
    newCs.enemyHp = Math.max(0, enemyHpTrue)
    newCs.lastPlayerDmg = dmg
    newCs.playerStance = stance
    addLog(ct('dealDamage', { dmg, enemy: translateEnemyName(enemy.name), hp: newCs.enemyHp, max: enemy.maxHp }), 'player')

    // Self damage
    if (weapon && weapon.selfDmgChance > 0 && roll(weapon.selfDmgChance)) {
      const self = rng(Math.floor(weapon.selfDmgMax / 2), weapon.selfDmgMax)
      playerHp = Math.max(1, playerHp - self)
      addLog(ct('weaponBackfire', { dmg: self }), 'warning')
    }
  }

  switch (action.type) {
    case 'attack': {
      if (stamina < 20) {
        const weak = rng(3, 10)
        newCs.enemyHp = Math.max(0, newCs.enemyHp - weak)
        newCs.lastPlayerDmg = weak
        addLog(ct('weakAttack', { dmg: weak }), 'warning')
      } else {
        stamina -= 20
        dealPlayerDamage(1.0, false, false, 'normal')
      }
      break
    }
    case 'offensive': {
      stamina -= 30
      dealPlayerDamage(1.3, false, false, 'offensive')
      addLog(ct('exposedSelf'), 'warning')
      break
    }
    case 'defensive': {
      stamina -= 15
      stamina = Math.min(gs.maxStamina, stamina + 10)
      dealPlayerDamage(1.0, false, false, 'defensive')
      addLog(ct('defensiveStance'), 'info')
      break
    }
    case 'dodge': {
      stamina -= 10
      dealPlayerDamage(0.6, false, false, 'dodge')
      addLog(ct('dodgeReposition'), 'info')
      break
    }
    case 'focused': {
      stamina -= 50
      dealPlayerDamage(1.6, false, false, 'normal')
      newCs.playerExposedTurns = 1
      addLog(ct('focusedStrike'), 'warning')
      break
    }
    case 'special': {
      if (!weapon) break
      stamina -= 35

      switch (weapon.effect) {

        // ── EFFETS INSTANTANÉS COMPLEXES (gèrent leur propre dealPlayerDamage) ─

        case 'double_strike': {
          addLog(ct('doubleStrike'), 'crit')
          dealPlayerDamage(0.85, true, false, 'offensive')
          const first = newCs.lastPlayerDmg
          dealPlayerDamage(0.85, true, false, 'offensive')
          addLog(ct('doubleStrikeResult', { first, second: newCs.lastPlayerDmg }), 'player')
          break
        }

        case 'sacrifice': {
          const cost = Math.floor(gs.playerMaxHp * 0.25)
          if (playerHp <= cost + 5) {
            addLog(ct('sacrificeTooLow'), 'warning')
            dealPlayerDamage(0.8, false, false, 'normal')
          } else {
            playerHp -= cost
            addLog(ct('sacrificeUsed', { cost }), 'warning')
            dealPlayerDamage(2.5, true, false, 'offensive')
          }
          break
        }

        case 'unstable': {
          if (roll(50)) {
            addLog(ct('unstableCrit'), 'crit')
            dealPlayerDamage(3.5, true, false, 'offensive')
          } else {
            const selfDmg = rng(100, 300)
            playerHp = Math.max(1, playerHp - selfDmg)
            newCs.playerStunnedTurns = 1
            addLog(ct('unstableFail', { dmg: selfDmg }), 'warning')
            dealPlayerDamage(0.2, false, false, 'normal')
          }
          break
        }

        case 'nuclear': {
          addLog(ct('nuclearHit'), 'crit')
          dealPlayerDamage(4.5, true, false, 'offensive')
          if (roll(65)) {
            const selfDmg = rng(80, 200)
            playerHp = Math.max(1, playerHp - selfDmg)
            newCs.playerWeakenedTurns = Math.max(newCs.playerWeakenedTurns, 2)
            addLog(ct('nuclearBackfire', { dmg: selfDmg }), 'warning')
          } else {
            addLog(ct('nuclearControlled'), 'info')
          }
          break
        }

        case 'berserker': {
          const missing = 1 - (playerHp / gs.playerMaxHp)
          const bMult = Math.min(2.5, 1.0 + missing * 1.5)
          const bPct = Math.round(bMult * 100)
          addLog(ct('berserkerRage', { pct: bPct, missing: Math.round(missing * 100) }), bMult > 1.7 ? 'crit' : 'info')
          dealPlayerDamage(bMult, true, false, 'offensive')
          break
        }

        case 'lifesteal': {
          dealPlayerDamage(1.2, true, false, 'offensive')
          const stolen = Math.floor(newCs.lastPlayerDmg * 0.35)
          playerHp = Math.min(gs.playerMaxHp, playerHp + stolen)
          addLog(ct('lifesteal', { amount: stolen, hp: playerHp, max: gs.playerMaxHp }), 'player')
          break
        }

        case 'momentum_surge': {
          dealPlayerDamage(1.1, true, false, 'offensive')
          newCs.momentum = 3
          addLog(ct('momentumSurge'), 'crit')
          break
        }

        // ── EFFETS À CHANCE (passent par applyWeaponEffect) ──────────────────

        default: {
          dealPlayerDamage(1.0, true, false, 'offensive')
          if (weapon.effectChance > 0 && roll(weapon.effectChance)) {
            applyWeaponEffect(weapon.effect, newCs, addLog)
          } else if (weapon.effectChance > 0) {
            addLog(ct('specialEffectFizzled'), 'info')
          }
        }
      }
      break
    }
    case 'finisher': {
      stamina -= 0
      dealPlayerDamage(3.0, false, false, 'offensive')
      newCs.momentum = 0
      addLog(ct('finisher'), 'crit')
      break
    }
    case 'class': {
      newCs.classActionUsed = true
      switch (gs.class.name) {
        case 'Seigneur de guerre': {
          const rawCh = 40 + Math.max(0, Math.floor(reputation / 5))
          const cappedCh = Math.min(80, rawCh)
          if (roll(cappedCh)) {
            newCs.enemyStunTurns = 1
            addLog(ct('warlordAura'), 'player')
          } else addLog(ct('warlordFail'), 'info')
          break
        }
        case 'Médecin': {
          stamina -= 20
          const healed = Math.min(30, gs.playerMaxHp - playerHp)
          playerHp = Math.min(gs.playerMaxHp, playerHp + 30)
          addLog(ct('medicHeal', { amount: healed, hp: playerHp, max: gs.playerMaxHp }), 'player')
          break
        }
        case 'Hackeur': {
          stamina -= 30
          newCs.enemyWeaponDisabledTurns = 2
          // Le silence neutralise aussi les mitigations des lieutenants
          // (absorption, invisibilité, phase) : c’est là que son intrusion
          // vaut mieux qu’un coup d’épée.
          newCs.enemySilencedTurns = 3
          addLog(ct('hackSuccess', { enemy: translateEnemyName(enemy.name) }), 'player')
          break
        }
        case 'Contrebandier': {
          if (gs.fuel > 0) {
            newGs.fuel = gs.fuel - 1
            newCs.playerFled = true
            addLog(ct('smugglerFlee'), 'info')
          }
          break
        }
        case 'Vagabond': {
          const dmg = rng(15, 35) + (weapon ? rng(weapon.damageMin, weapon.damageMax) : rng(5, 15))
          newCs.enemyHp = Math.max(0, newCs.enemyHp - dmg)
          newCs.lastPlayerDmg = dmg
          reputation -= 10
          addLog(ct('vagabondCheapShot', { dmg }), 'player')
          break
        }
        // ── Compétences non combattantes ───────────────────────────────
        // Ces classes n'avaient aucune action de classe : elles subissaient
        // le combat sans jamais pouvoir y appliquer leur propre identité.
        case 'Marchand': {
          // Il achète la retraite de l'adversaire plutôt que de le vaincre.
          const prix = 200 * Math.max(1, gs.day)
          if (credits >= prix) {
            credits -= prix
            newCs.enemyWeakenedTurns = 3
            addLog(ct('merchantBuyOff', { cost: prix }), 'player')
          } else addLog(ct('merchantNoFunds', { cost: prix }), 'warning')
          break
        }
        case 'Mécanicien': {
          // Bricolage de fortune : il sabote l'arme adverse et rafistole la sienne.
          stamina -= 15
          newCs.enemyWeaponDisabledTurns = 3
          const repaired = Math.min(20, gs.playerMaxHp - playerHp)
          playerHp = Math.min(gs.playerMaxHp, playerHp + 20)
          addLog(ct('mechanicRig', { amount: repaired }), 'player')
          break
        }
        case 'Explorateur': {
          // Lecture du terrain : il repère la faille et aveugle l'adversaire.
          stamina -= 15
          newCs.enemyBlinded = true
          newCs.playerStance = 'offensive'
          addLog(ct('explorerReadTerrain', { enemy: translateEnemyName(enemy.name) }), 'player')
          break
        }
        case 'Ferrailleur': {
          // Bombe de ferraille : dégâts bruts qui ignorent le plafond et les
          // mitigations des lieutenants — sa seule vraie réponse à un mur.
          const boom = rng(40, 70)
          enemyHpTrue -= boom
          newCs.enemyHp = Math.max(0, enemyHpTrue)
          newCs.lastPlayerDmg = 0 // hors mitigations : ne déclenche pas les absorptions
          addLog(ct('scrapperBomb', { dmg: boom, hp: newCs.enemyHp, max: enemy.maxHp }), 'crit')
          break
        }
        case 'Héritier': {
          // Escorte payée : sa fortune encaisse les coups à sa place.
          const cout = 1500
          if (credits >= cout) {
            credits -= cout
            newCs.escortHits = 3
            addLog(ct('heirEscort', { cost: cout }), 'player')
          } else addLog(ct('heirNoFunds', { cost: cout }), 'warning')
          break
        }
        case 'Rayane': {
          if (roll(50)) {
            const critDmg = weapon
              ? Math.floor(rng(weapon.damageMin, weapon.damageMax) * 4)
              : Math.floor(rng(5, 18) * 4)
            newCs.enemyHp = Math.max(0, newCs.enemyHp - critDmg)
            newCs.lastPlayerDmg = critDmg
            newCs.playerStance = 'offensive'
            addLog(ct('rayaneClassHeads', { dmg: critDmg, enemy: translateEnemyName(enemy.name), hp: newCs.enemyHp, max: enemy.maxHp }), 'crit')
          } else {
            const selfDmg = Math.floor(gs.playerMaxHp * 0.3)
            playerHp = Math.max(1, playerHp - selfDmg)
            newCs.playerStunnedTurns = Math.max(newCs.playerStunnedTurns, 1)
            addLog(ct('rayaneClassTails', { dmg: selfDmg }), 'warning')
          }
          break
        }
      }
      break
    }
    case 'flee': {
      if (cs.fleeAttempts >= 2) {
        addLog(ct('fleeBlocked'), 'warning')
        break
      }
      const isRayane = gs.class.name === 'Rayane'
      const chance = isRayane ? 50 : 50 + (gs.fuel > 2 ? 15 : 0) + (gs.class.name === 'Contrebandier' ? 20 : 0)
      if (roll(chance)) {
        if (!isRayane) newGs.fuel = Math.max(0, gs.fuel - 1)
        newCs.playerFled = true
        addLog(isRayane ? ct('rayaneFleeHeads') : ct('normalFlee'), 'info')
      } else if (isRayane) {
        newCs.fleeAttempts = cs.fleeAttempts + 1
        const freeDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 0.6)
        playerHp = Math.max(0, playerHp - freeDmg)
        addLog(ct('rayaneFleeTails', { enemy: translateEnemyName(enemy.name), dmg: freeDmg, hp: playerHp, max: gs.playerMaxHp }), 'warning')
      } else {
        newCs.fleeAttempts = cs.fleeAttempts + 1
        addLog(ct('fleeBlockedByEnemy', { enemy: translateEnemyName(enemy.name), n: 2 - newCs.fleeAttempts, s: 2 - newCs.fleeAttempts > 1 ? 's' : '' }), 'enemy')
      }
      break
    }
    case 'negotiate': {
      addLog(ct('negotiateRefused', { enemy: translateEnemyName(enemy.name) }), 'enemy')
      break
    }
    case 'negotiate-accept': {
      newCs.enemyHp = 0
      reputation += 3
      addLog(ct('negotiateAccepted', { enemy: translateEnemyName(enemy.name) }), 'victory')
      break
    }
    case 'intimidate': {
      // L'intimidation ne gagne JAMAIS le combat : elle affaiblit l'adversaire
      // ou lui fait louper un tour. Les boss et sous-boss y résistent davantage.
      const rawChance = Math.floor(reputation / 5) + (gs.class.name === 'Seigneur de guerre' ? 30 : 0)
      const bossResist = enemy.isBoss ? 0.5 : 1
      const chance = Math.min(enemy.isBoss ? 45 : 80, Math.floor((15 + rawChance) * bossResist))
      if (roll(chance)) {
        if (roll(50)) {
          newCs.enemyStunTurns = Math.max(newCs.enemyStunTurns, 1)
          addLog(ct('intimidateStun', { enemy: translateEnemyName(enemy.name) }), 'victory')
        } else {
          const dur = enemy.isBoss ? 2 : 3
          newCs.enemyWeakenedTurns = Math.max(newCs.enemyWeakenedTurns, dur)
          addLog(ct('intimidateWeaken', { enemy: translateEnemyName(enemy.name), dur }), 'victory')
        }
      } else addLog(ct('intimidateFail', { enemy: translateEnemyName(enemy.name) }), 'enemy')
      break
    }
    case 'heal': {
      if (newCs.medicUses >= 3) {
        addLog(ct('healLimitReached'), 'warning')
        return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
      }
      if ((cargo['Médicaments'] ?? 0) > 0) {
        cargo['Médicaments']--
        if (cargo['Médicaments'] <= 0) delete cargo['Médicaments']
        playerHp = Math.min(gs.playerMaxHp, playerHp + 30)
        newCs.medicUses++
        addLog(ct('healed', { hp: playerHp, max: gs.playerMaxHp, n: newCs.medicUses }), 'player')
      }
      return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
    }
    case 'bite': {
      stamina -= 25
      // Morsure = presque pas d'offensif. Elle sert à se nourrir : la faim
      // redescend et le joueur régénère un peu de PV — pas à gagner le combat.
      const biteDmg = rng(4, 12)
      newCs.enemyHp = Math.max(0, newCs.enemyHp - biteDmg)
      newCs.lastPlayerDmg = biteDmg
      newCs.playerStance = 'offensive'
      const biteHeal = Math.min(gs.playerMaxHp - playerHp, rng(15, 28))
      playerHp += biteHeal
      addLog(ct('bite', { dmg: biteDmg, heal: biteHeal, enemy: translateEnemyName(enemy.name), hp: newCs.enemyHp, max: enemy.maxHp }), 'crit')
      // Réduit la folie — nette, car elle écrase la hausse déjà appliquée ce tour
      newGs.folieLevel = Math.max(0, (gs.folieLevel ?? 0) - 20)
      newGs.folieConsumedThisTurn = true
      break
    }
    case 'drug': {
      if ((cargo['Drogues de synthèse'] ?? 0) > 0) {
        cargo['Drogues de synthèse']--
        if (cargo['Drogues de synthèse'] <= 0) delete cargo['Drogues de synthèse']
        const addicted = (gs.addictionLevel ?? 0) > 0
        if (addicted) {
          const dmg = rng(15, 35)
          playerHp = Math.max(1, playerHp - dmg)
          newCs.playerWeakenedTurns = newCs.playerWeakenedTurns + 2
          newGs.addictionLevel = (gs.addictionLevel ?? 0) + 1
          addLog(ct('overdose', { dmg }), 'warning')
        } else {
          playerHp = Math.min(gs.playerMaxHp, playerHp + 20)
          stamina = Math.min(gs.maxStamina, stamina + 25)
          const hooked = Math.random() < 0.5
          if (hooked) newGs.addictionLevel = 1
          addLog(ct('drugEffect', { hooked: hooked ? ct('drugHooked') : '' }), 'player')
        }
      } else {
        addLog(ct('noMoreDrugs'), 'info')
      }
      break
    }
    case 'rest': {
      const gain = 40
      stamina = Math.min(gs.maxStamina, stamina + gain)
      addLog(ct('rest', { gain }), 'info')
      break
    }
    case 'water': {
      if ((cargo['Eau purifiée'] ?? 0) > 0) {
        cargo['Eau purifiée']--
        if (cargo['Eau purifiée'] <= 0) delete cargo['Eau purifiée']
        stamina = gs.maxStamina
        addLog(ct('waterRestored'), 'player')
      } else {
        addLog(ct('noMoreWater'), 'info')
      }
      return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
    }
    case 'food': {
      if (newCs.medicUses >= 3) {
        addLog(ct('healLimitReached'), 'warning')
        return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
      }
      const FOOD_ORDER = ['Rations militaires', 'Rations', 'Vivres', 'Nourriture fraîche', 'Nourriture synthétique']
      const key = FOOD_ORDER.find(k => (cargo[k] ?? 0) > 0)
      if (key) {
        cargo[key]--
        if (cargo[key] <= 0) delete cargo[key]
        playerHp = Math.min(gs.playerMaxHp, playerHp + 15)
        newCs.medicUses++
        addLog(ct('foodEaten', { item: key, hp: playerHp, max: gs.playerMaxHp, n: newCs.medicUses }), 'player')
      }
      return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
    }
    case 'herb': {
      if (newCs.medicUses >= 3) {
        addLog(ct('healLimitReached'), 'warning')
        return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
      }
      if ((cargo['Plantes médicinales'] ?? 0) > 0) {
        cargo['Plantes médicinales']--
        if (cargo['Plantes médicinales'] <= 0) delete cargo['Plantes médicinales']
        playerHp = Math.min(gs.playerMaxHp, playerHp + 25)
        newCs.medicUses++
        addLog(ct('herbApplied', { hp: playerHp, max: gs.playerMaxHp, n: newCs.medicUses }), 'player')
      }
      return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
    }
    case 'alcohol': {
      if ((cargo['Alcools exotiques'] ?? 0) > 0) {
        cargo['Alcools exotiques']--
        if (cargo['Alcools exotiques'] <= 0) delete cargo['Alcools exotiques']
        stamina = Math.min(gs.maxStamina, stamina + 60)
        newCs.playerExposedTurns = (newCs.playerExposedTurns ?? 0) + 1
        addLog(ct('alcoholDrunk'), 'warning')
      }
      break
    }
    case 'premium_med': {
      if (newCs.medicUses >= 3) {
        addLog(ct('healLimitReached'), 'warning')
        return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
      }
      if ((cargo['Médicaments premium'] ?? 0) > 0) {
        cargo['Médicaments premium']--
        if (cargo['Médicaments premium'] <= 0) delete cargo['Médicaments premium']
        playerHp = Math.min(gs.playerMaxHp, playerHp + 60)
        newCs.medicUses++
        addLog(ct('premiumMedUsed', { hp: playerHp, max: gs.playerMaxHp, n: newCs.medicUses }), 'player')
      }
      return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
    }
  }

  // ── SUB-BOSS DAMAGE MODIFIERS (after player deals damage) ──────────────
  const mitigationsSilenced = newCs.enemySilencedTurns > 0
  if (isSubBoss && newCs.lastPlayerDmg > 0 && !mitigationsSilenced) {
    // Le plafond anti-farm (20 % des PV max par coup par défaut) est appliqué
    // dans dealPlayerDamage(), avant de retirer les PV — voir le commentaire
    // là-bas. On se contente ici d'informer le joueur quand il a plafonné.
    const perHitCap = subBossHitCap(enemy)
    if (newCs.lastPlayerDmg >= perHitCap) {
      addLog(ct('subBossDamageCap', { enemy: translateEnemyName(enemy.name), cap: perHitCap }), 'info')
    }
    const dmgDealt = newCs.lastPlayerDmg

    // Le Vigie Immortel — esquive auto tous les 3 tours
    if (enemy.name === 'Le Vigie Immortel' && sbTurn % 3 === 0) {
      mitigate(dmgDealt)
      newCs.lastPlayerDmg = 0
      addLog(ct('vigieDodge'), 'enemy')
    }

    // Le Fantôme des Ombres — invisible les tours impairs
    if (enemy.name === 'Le Fantôme des Ombres' && sbTurn % 2 === 1) {
      mitigate(dmgDealt)
      newCs.lastPlayerDmg = 0
      const counterDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 0.5)
      playerHp = Math.max(0, playerHp - counterDmg)
      addLog(ct('fantomeInvisible', { dmg: counterDmg, hp: playerHp, max: gs.playerMaxHp }), 'enemy')
    }

    // Le Passeur Sanguinaire — mode défensif tous les 2 tours pairs, réduit dégâts de 50%
    if (enemy.name === 'Le Passeur Sanguinaire' && sbTurn % 4 < 2) {
      const reduced = Math.floor(dmgDealt * 0.5)
      mitigate(reduced)
      newCs.lastPlayerDmg = dmgDealt - reduced
      addLog(ct('passeurDefensive', { amount: reduced }), 'enemy')
    }

    // Le Directeur Fantôme — redirige 30% des dégâts vers le joueur
    if (enemy.name === 'Le Directeur Fantôme' && roll(30)) {
      const redirected = Math.floor(dmgDealt * 0.3)
      playerHp = Math.max(0, playerHp - redirected)
      addLog(ct('directeurRedirect', { amount: redirected, hp: playerHp, max: gs.playerMaxHp }), 'warning')
    }

    // La Veuve de Fer — réduit 40% des dégâts physiques (armes burn/shock ignorent)
    if (enemy.name === 'La Veuve de Fer') {
      const weaponEffect = gs.equippedWeapon?.effect
      const ignoresArmor = weaponEffect === 'burn' || weaponEffect === 'shock'
      if (!ignoresArmor) {
        const absorbed = Math.floor(dmgDealt * 0.4)
        mitigate(absorbed)
        newCs.lastPlayerDmg = dmgDealt - absorbed
        addLog(ct('veuveAbsorb', { amount: absorbed }), 'enemy')
      }
    }

    // Le Spectre du 7e — immunisé aux attaques directes tous les 2 tours
    if (enemy.name === 'Le Spectre du 7e' && sbTurn % 2 === 0) {
      mitigate(dmgDealt)
      newCs.lastPlayerDmg = 0
      addLog(ct('spectrePhase'), 'enemy')
    }

    // Le Maréchal Osseux — réduit les critiques de 60%, rage croissante
    if (enemy.name === 'Le Maréchal Osseux') {
      const hpPct = 1 - (newCs.enemyHp / enemy.maxHp)
      const rageBonus = Math.floor(hpPct / 0.25) * 15
      if (rageBonus > 0) {
        newCs.subBossDefenseStacks = rageBonus
        addLog(ct('marechalRage', { amount: rageBonus }), 'enemy')
      }
    }

    // Le Roi de Nuit — ténèbres, 25% chance de rater complètement
    if (enemy.name === 'Le Roi de Nuit' && roll(25)) {
      mitigate(dmgDealt)
      newCs.lastPlayerDmg = 0
      addLog(ct('roiDeNuitDodge'), 'enemy')
    }

    // Le Maître des Ombres — ombre absorbe 30% des dégâts, se brise après 3 coups
    if (enemy.name === 'Le Maître des Ombres' && (cs.subBossShadowHits ?? 0) < 3) {
      const absorbed = Math.floor(dmgDealt * 0.3)
      mitigate(absorbed)
      newCs.lastPlayerDmg = dmgDealt - absorbed
      newCs.subBossShadowHits = (cs.subBossShadowHits ?? 0) + 1
      if (newCs.subBossShadowHits >= 3) {
        addLog(ct('maitreOmbresAbsorb', { amount: absorbed }), 'player')
      } else {
        addLog(ct('maitreOmbresAbsorbPartial', { amount: absorbed, n: newCs.subBossShadowHits }), 'enemy')
      }
    }

    // L'Archiviste sans Visage — copie les dégâts du joueur
    if (enemy.name === "L'Archiviste sans Visage") {
      const copyDmg = Math.floor(dmgDealt * 0.6)
      playerHp = Math.max(0, playerHp - copyDmg)
      addLog(ct('archivisteMirror', { amount: copyDmg, hp: playerHp, max: gs.playerMaxHp }), 'warning')
    }
  }

  // Oracle de la Singularité — inverse les soins (si le joueur s'est soigné ce tour)
  if (isSubBoss && enemy.name === 'Oracle de la Singularité') {
    const healedThisTurn = playerHp - gs.playerHp
    if (healedThisTurn > 0) {
      newCs.enemyHp = Math.min(enemy.maxHp, newCs.enemyHp + healedThisTurn)
      addLog(ct('oracleAbsorbHeal', { amount: healedThisTurn, hp: newCs.enemyHp, max: enemy.maxHp }), 'warning')
    }
  }

  // Check victory before enemy turn
  if (newCs.enemyHp <= 0) {
    const v = resolveVictory(gs, enemy)
    return {
      newGs: { ...newGs, playerHp, stamina, credits: credits + v.loot, reputation: reputation + 10, equippedWeapon, cargo, ...v.extra },
      newCs, outcome: 'victory', reward: v.rewardInfo,
    }
  }

  if (newCs.playerFled) {
    return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs, outcome: 'fled' }
  }

  // ── MOMENTUM ──────────────────────────────────────────────────────────
  if (newCs.lastPlayerDmg > 0) {
    newCs.momentum = Math.min(3, newCs.momentum + 1)
    if (newCs.momentum === 3) addLog(ct('momentumMax'), 'crit')
  }

  // ── BURN ──────────────────────────────────────────────────────────────
  if (newCs.enemyBurnTurns > 0) {
    newCs.enemyHp = Math.max(0, newCs.enemyHp - newCs.enemyBurnDmg)
    newCs.enemyBurnTurns--
    addLog(ct('burnTick', { dmg: newCs.enemyBurnDmg, enemy: translateEnemyName(enemy.name), hp: newCs.enemyHp, max: enemy.maxHp }), 'info')
    if (newCs.enemyHp <= 0) {
      const v = resolveVictory(gs, enemy)
      return {
        newGs: { ...newGs, playerHp, stamina, credits: credits + v.loot, reputation: reputation + 10, equippedWeapon, cargo, ...v.extra },
        newCs, outcome: 'victory', reward: v.rewardInfo,
      }
    }
  }

  // ── ENEMY TURN ────────────────────────────────────────────────────────
  if (newCs.enemySilencedTurns > 0) newCs.enemySilencedTurns--
  newCs.currentIntent = newCs.enemyCharging ? 'heavy' : generateIntent(enemy, newCs)

  if (newCs.enemyStunTurns > 0) {
    newCs.enemyStunTurns--
    newCs.enemyCharging = false   // une frappe en préparation est annulée par l'étourdissement
    addLog(ct('enemyStunnedSkip', { enemy: translateEnemyName(enemy.name) }), 'info')
  } else if (newCs.enemyConfusedTurns > 0) {
    newCs.enemyConfusedTurns--
    const confuseDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 0.55)
    newCs.enemyHp = Math.max(0, newCs.enemyHp - confuseDmg)
    addLog(ct('enemyConfused', { enemy: translateEnemyName(enemy.name), dmg: confuseDmg, n: newCs.enemyConfusedTurns }), 'info')
    if (newCs.enemyHp <= 0) {
      const vC = resolveVictory(gs, enemy)
      return { newGs: { ...newGs, playerHp, stamina, credits: credits + vC.loot, reputation: reputation + 10, equippedWeapon, cargo, ...vC.extra }, newCs, outcome: 'victory', reward: vC.rewardInfo }
    }
  } else if (newCs.enemyWeaponDisabledTurns > 0) {
    newCs.enemyWeaponDisabledTurns--
    const hackDmg = rng(2, 8)
    playerHp = Math.max(0, playerHp - hackDmg)
    addLog(ct('weaponDisabledImprovise', { enemy: translateEnemyName(enemy.name), dmg: hackDmg, n: newCs.enemyWeaponDisabledTurns }), 'enemy')
  } else {
    let enemyDmg = 0
    let skipped = false

    const wasBlinded = newCs.enemyBlinded
    if (newCs.enemyBlinded) newCs.enemyBlinded = false

    switch (newCs.currentIntent) {
      case 'heavy': {
        newCs.enemyCharging = false
        enemyDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 1.8)
        if (wasBlinded) enemyDmg = Math.floor(enemyDmg * 0.6)
        addLog(ct('enemyHeavy', { enemy: translateEnemyName(enemy.name) }), 'enemy')
        break
      }
      case 'defend': {
        addLog(ct('enemyDefend', { enemy: translateEnemyName(enemy.name) }), 'info')
        skipped = true
        break
      }
      case 'charge': {
        newCs.enemyCharging = true
        enemyDmg = Math.max(1, rng(1, Math.max(2, Math.floor(enemy.damageMin / 2))))
        if (wasBlinded) enemyDmg = Math.floor(enemyDmg * 0.6)
        addLog(ct('enemyCharge', { enemy: translateEnemyName(enemy.name) }), 'warning')
        break
      }
      case 'disarm': {
        enemyDmg = rng(Math.floor(enemy.damageMin / 2), Math.max(Math.floor(enemy.damageMin / 2) + 1, Math.floor(enemy.damageMax / 2)))
        if (wasBlinded) enemyDmg = Math.floor(enemyDmg * 0.6)
        if (equippedWeapon && roll(30)) {
          const wName = equippedWeapon.name
          equippedWeapon = null
          addLog(ct('enemyDisarm', { enemy: translateEnemyName(enemy.name), weapon: wName }), 'enemy')
        }
        break
      }
      // ── ATTAQUES SPÉCIALES — TOUS BOSS ──────────────────────────────────────
      case 'blood_rage': {
        const rawDmg = rng(enemy.damageMin, enemy.damageMax)
        if (wasBlinded) enemyDmg = Math.floor(rawDmg * 0.6)
        else enemyDmg = rawDmg
        const heal = Math.floor(enemyDmg * 0.35)
        newCs.enemyHp = Math.min(enemy.maxHp, newCs.enemyHp + heal)
        addLog(ct('bloodRage', { enemy: translateEnemyName(enemy.name), heal }), 'crit')
        break
      }
      case 'execution': {
        let execDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 1.4)
        if (wasBlinded) execDmg = Math.floor(execDmg * 0.6)
        execDmg = Math.floor(execDmg * (gs.class.combatDefenseMult ?? 1.0))
        addLog(ct('executionArmorTarget', { enemy: translateEnemyName(enemy.name) }), 'warning')
        playerHp = Math.max(0, playerHp - execDmg)
        addLog(ct('armorIgnoredDamage', { dmg: execDmg, hp: playerHp, max: gs.playerMaxHp }), 'enemy')
        skipped = true
        break
      }
      case 'weaken': {
        enemyDmg = rng(enemy.damageMin, enemy.damageMax)
        if (wasBlinded) enemyDmg = Math.floor(enemyDmg * 0.6)
        newCs.playerWeakenedTurns = 2
        addLog(ct('weakenHit', { enemy: translateEnemyName(enemy.name) }), 'warning')
        break
      }

      // ── ATTAQUES UNIQUES — PERSONNAGES PILIERS ────────────────────────────
      case 'imperial_barrage': {
        // Cesarion — 3 coups rapides (chacun 70% des dégâts normaux)
        addLog(ct('imperialBarrage'), 'crit')
        let totalBarrage = 0
        for (let i = 0; i < 3; i++) {
          const hit = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 0.70)
          const armor = gs.equippedArmor
          const red = armor ? Math.floor(hit * armor.defense / 100) : 0
          const net = Math.max(1, hit - red)
          totalBarrage += net
          addLog(ct('imperialBarrageHit', { n: i + 1, dmg: net }), 'enemy')
        }
        playerHp = Math.max(0, playerHp - totalBarrage)
        newCs.playerWeakenedTurns = 1
        addLog(ct('imperialBarrageTotal', { total: totalBarrage, hp: playerHp, max: gs.playerMaxHp }), 'enemy')
        skipped = true // dégâts déjà appliqués manuellement
        break
      }
      case 'phantom_strike': {
        // Raphazarus — frappe depuis l'angle mort : perce l'armure et ignore le dodge.
        // L'armure ne protégeait AUCUNEMENT contre cette attaque, ce qui annulait
        // toute la progression défensive du joueur face au boss le plus dur du jeu
        // (580 PV, déclenchement 30-40 %). Elle compte désormais à moitié : la
        // frappe reste la plus dangereuse du jeu, mais s'équiper sert à quelque chose.
        enemyDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 1.6)
        if (wasBlinded) enemyDmg = Math.floor(enemyDmg * 0.6)
        const armorPhantom = gs.equippedArmor
        if (armorPhantom) {
          const halfRed = Math.floor(enemyDmg * (armorPhantom.defense / 2) / 100)
          enemyDmg = Math.max(1, enemyDmg - halfRed)
        }
        addLog(ct('phantomStrike'), 'crit')
        // Appliqué directement, sans dodge
        playerHp = Math.max(0, playerHp - enemyDmg)
        addLog(ct('armorIgnoredDamage', { dmg: enemyDmg, hp: playerHp, max: gs.playerMaxHp }), 'enemy')
        skipped = true
        break
      }
      case 'party_over': {
        // Eliotis — transformation instantanée : stun joueur + frappe lourde
        enemyDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 1.5)
        if (wasBlinded) enemyDmg = Math.floor(enemyDmg * 0.6)
        newCs.playerStunnedTurns = 1
        addLog(ct('partyOver'), 'crit')
        break
      }
      case 'flora_toxin': {
        // Le Roi Maxance — poison de Paradoxa Eterna, très long et douloureux
        const toxBase = rng(enemy.damageMin, enemy.damageMax)
        enemyDmg = wasBlinded ? Math.floor(toxBase * 0.6) : toxBase
        newCs.playerBurnDmg = rng(18, 35)
        newCs.playerBurnTurns = 5
        addLog(ct('floraToxin', { dmg: newCs.playerBurnDmg }), 'crit')
        break
      }
      case 'all_in': {
        // Samy Scotty — casino : 50/50 entre 0 dégâts et x3
        const allInRoll = Math.random()
        if (allInRoll < 0.50) {
          addLog(ct('allInStart'), 'crit')
          enemyDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 3.0)
          if (wasBlinded) enemyDmg = Math.floor(enemyDmg * 0.6)
          addLog(ct('allInJackpot'), 'crit')
        } else {
          addLog(ct('allInBluff'), 'info')
          skipped = true
        }
        break
      }

      default: { // normal
        enemyDmg = rng(enemy.damageMin, enemy.damageMax)
        if (wasBlinded) enemyDmg = Math.floor(enemyDmg * 0.6)
        if (roll(10)) {
          enemyDmg = Math.floor(enemyDmg * 1.8)
          addLog(ct('enemyCrit'), 'crit')
        }
        break
      }
    }

    if (!skipped && enemyDmg > 0) {
      const stance = newCs.playerStance as import('../types').CombatStance
      switch (stance) {
        case 'defensive': enemyDmg = Math.floor(enemyDmg * 0.70); break
        case 'offensive': enemyDmg = Math.floor(enemyDmg * 1.20); break
        case 'dodge':
          if (roll(40)) {
            addLog(ct('perfectDodge'), 'player')
            enemyDmg = 0
          }
          break
      }
    }

    if (!skipped && enemyDmg > 0 && newCs.playerExposedTurns > 0) {
      const stance = newCs.playerStance as import('../types').CombatStance
      const exposedMult = stance === 'defensive' ? 1.10 : stance === 'dodge' ? 1.20 : 1.50
      enemyDmg = Math.floor(enemyDmg * exposedMult)
      newCs.playerExposedTurns = 0
      if (exposedMult < 1.5) {
        addLog(ct('exposedMitigated', { pct: Math.round(exposedMult * 100) }), 'warning')
      } else {
        addLog(ct('exposedFull', { enemy: translateEnemyName(enemy.name) }), 'enemy')
      }
    }

    if (!skipped && enemyDmg > 0 && newCs.enemyWeakenedTurns > 0) {
      enemyDmg = Math.floor(enemyDmg * 0.60)
      newCs.enemyWeakenedTurns--
      addLog(ct('curseActive', { enemy: translateEnemyName(enemy.name), n: newCs.enemyWeakenedTurns, s: newCs.enemyWeakenedTurns !== 1 ? 's' : '' }), 'info')
    }

    if (!skipped && enemyDmg > 0) {
      enemyDmg = Math.floor(enemyDmg * (gs.class.combatDefenseMult ?? 1.0))
      const armor = gs.equippedArmor
      if (armor) {
        const reduced = Math.floor(enemyDmg * armor.defense / 100)
        enemyDmg -= reduced
        if (reduced > 0) addLog(ct('armorAbsorb', { amount: reduced }), 'info')
        if (armor.effect === 'thorns' && enemyDmg > 0) {
          const thorns = Math.floor(enemyDmg * armor.effectValue / 100)
          newCs.enemyHp = Math.max(0, newCs.enemyHp - thorns)
          addLog(ct('thornsReflect', { amount: thorns, enemy: translateEnemyName(enemy.name) }), 'info')
        }
        if (armor.effect === 'immunity' && !newCs.immunityUsed && playerHp <= enemyDmg) {
          newCs.immunityUsed = true
          enemyDmg = 0
          addLog(ct('immunityUsed'), 'warning')
        }
      }

      if (enemyDmg > 0 && newCs.escortHits > 0) {
        newCs.escortHits--
        addLog(ct('heirEscortBlock', { n: newCs.escortHits }), 'player')
        enemyDmg = 0
      }
      if (enemyDmg > 0) {
        newCs.momentum = 0
        playerHp = Math.max(0, playerHp - enemyDmg)
        addLog(ct('enemyAttack', { enemy: translateEnemyName(enemy.name), dmg: enemyDmg, hp: playerHp, max: gs.playerMaxHp }), 'enemy')
      }
    }
  }

  // ── POISON JOUEUR (flora_toxin — Le Roi Maxance) ─────────────────────────
  if (newCs.playerBurnTurns > 0) {
    playerHp = Math.max(0, playerHp - newCs.playerBurnDmg)
    newCs.playerBurnTurns--
    addLog(ct('paradoxaPoisonTick', { dmg: newCs.playerBurnDmg, n: newCs.playerBurnTurns, s: newCs.playerBurnTurns !== 1 ? 's' : '', hp: playerHp, max: gs.playerMaxHp }), 'warning')
    if (playerHp <= 0) {
      const flip = tryDeathFlip(gs, addLog)
      if (flip.survived) {
        playerHp = 1
        if (flip.flag) newGs[flip.flag] = true
      } else {
        addLog(ct('poisonKilled'), 'enemy')
        const rp = Math.random() * 100
        let outcomeP: CombatOutcome = 'stunned'
        if (rp < enemy.killChance) outcomeP = 'dead'
        else if (rp < enemy.killChance + enemy.captureChance) outcomeP = 'captured'
        const survivedHpP = outcomeP === 'captured' ? Math.floor(gs.playerMaxHp / 2) : 0
        return {
          newGs: { ...newGs, ...(flip.flag ? { [flip.flag]: true } : {}), playerHp: survivedHpP, stamina, credits, reputation, equippedWeapon, cargo },
          newCs, outcome: outcomeP,
        }
      }
    }
  }

  // ── SUB-BOSS PASSIVE EFFECTS (each enemy turn) ──────────────────────────
  if (isSubBoss) {
    // Le Ravitailleur de l'Ombre — auto-soin 15% tous les 4 tours
    if (enemy.name === "Le Ravitailleur de l'Ombre" && sbTurn % 4 === 0) {
      const healAmt = Math.floor(enemy.maxHp * 0.15)
      newCs.enemyHp = Math.min(enemy.maxHp, newCs.enemyHp + healAmt)
      addLog(ct('ravitailleurHeal', { amount: healAmt, hp: newCs.enemyHp, max: enemy.maxHp }), 'enemy')
    }

    // La Faucon — crit garanti tous les 5 tours + dégâts croissants
    if (enemy.name === 'La Faucon' && sbTurn % 5 === 0) {
      const bonusDmg = Math.floor(rng(enemy.damageMin, enemy.damageMax) * 1.0)
      playerHp = Math.max(0, playerHp - bonusDmg)
      addLog(ct('fauconRage', { dmg: bonusDmg, hp: playerHp, max: gs.playerMaxHp }), 'crit')
    }

    // La Marchande de Mort — vol de crédits chaque tour
    if (enemy.name === 'La Marchande de Mort') {
      const stolen = rng(200, 500)
      credits = Math.max(0, credits - stolen)
      addLog(ct('marchandeSteal', { amount: stolen, credits }), 'warning')
    }

    // Le Sergent Cendré — double attaque chaque tour, pause tous les 4 tours
    if (enemy.name === 'Le Sergent Cendré' && sbTurn % 4 !== 0) {
      const bonusDmg = rng(enemy.damageMin, Math.floor(enemy.damageMax * 0.7))
      playerHp = Math.max(0, playerHp - bonusDmg)
      addLog(ct('sergentDoubleAttack', { dmg: bonusDmg, hp: playerHp, max: gs.playerMaxHp }), 'warning')
    }
    if (enemy.name === 'Le Sergent Cendré' && sbTurn % 4 === 0) {
      addLog(ct('sergentReload'), 'info')
    }

    // Le Maréchal Osseux — sa rage augmente ses dégâts d'ennemi
    if (enemy.name === 'Le Maréchal Osseux' && (newCs.subBossDefenseStacks ?? 0) > 0) {
      const baseDmg = rng(enemy.damageMin, enemy.damageMax)
      const bonusDmg = Math.floor(baseDmg * (newCs.subBossDefenseStacks ?? 0) / 100)
      playerHp = Math.max(0, playerHp - bonusDmg)
      if (bonusDmg > 0) addLog(ct('marechalRageDamage', { amount: bonusDmg, hp: playerHp, max: gs.playerMaxHp }), 'warning')
    }

    // Directeur Pale — drain de stamina passif
    if (enemy.name === 'Directeur Pale') {
      stamina = Math.max(0, stamina - 15)
      addLog(ct('directeurPaleDrain', { stamina, max: gs.maxStamina }), 'warning')
    }
  }

  // Regen armor
  if (gs.equippedArmor?.effect === 'regen') {
    const r = gs.equippedArmor.effectValue
    playerHp = Math.min(gs.playerMaxHp, playerHp + r)
    if (r > 0) addLog(ct('regen', { amount: r }), 'info')
  }

  // Exposition résiduele (si l'ennemi était stun) — expirée proprement en fin de tour
  if (newCs.playerExposedTurns > 0) newCs.playerExposedTurns = 0

  // Stamina regen
  const staminaRegen = 20 + (gs.equippedArmor?.effect === 'staminaBoost' ? gs.equippedArmor.effectValue : 0)
    + ((newCs.playerStance as import('../types').CombatStance) === 'defensive' ? 10 : 0)
    + (gs.class.combatStaminaRegen ?? 0)
  stamina = Math.min(gs.maxStamina, stamina + staminaRegen)

  // Victory check after enemy turn (thorns, sub-boss reflect, etc. may have killed the enemy)
  if (newCs.enemyHp <= 0) {
    const v = resolveVictory(gs, enemy)
    return {
      newGs: { ...newGs, playerHp: Math.max(1, playerHp), stamina, credits: credits + v.loot, reputation: reputation + 10, equippedWeapon, cargo, ...v.extra },
      newCs, outcome: 'victory', reward: v.rewardInfo,
    }
  }

  if (playerHp <= 0) {
    const flip = tryDeathFlip(gs, addLog)
    if (flip.survived) {
      playerHp = 1
      if (flip.flag) newGs[flip.flag] = true
    } else {
      addLog(ct('youFall', { enemy: translateEnemyName(enemy.name) }), 'enemy')
      const r = Math.random() * 100
      let outcome: CombatOutcome = 'stunned'
      if (r < enemy.killChance) outcome = 'dead'
      else if (r < enemy.killChance + enemy.captureChance) outcome = 'captured'
      const survivedHpFinal = outcome === 'captured' ? Math.floor(gs.playerMaxHp / 2) : 0
      return {
        newGs: { ...newGs, ...(flip.flag ? { [flip.flag]: true } : {}), playerHp: survivedHpFinal, stamina, credits, reputation, equippedWeapon, cargo },
        newCs, outcome,
      }
    }
  }

  return { newGs: { ...newGs, playerHp, stamina, credits, reputation, equippedWeapon, cargo }, newCs }
}

function applyWeaponEffect(effect: string, cs: CombatState, addLog: (t: string, type: CombatLogEntry['type']) => void) {
  switch (effect) {
    case 'stun':          cs.enemyStunTurns = 1; addLog(ct('effectStun'), 'info'); break
    case 'paralyze':      cs.enemyStunTurns = 2; addLog(ct('effectParalyze'), 'info'); break
    case 'burn':          cs.enemyBurnDmg = rng(8, 20);  cs.enemyBurnTurns = 3; addLog(ct('effectBurn', { dmg: cs.enemyBurnDmg }), 'warning'); break
    case 'poison':        cs.enemyBurnDmg = rng(5, 15);  cs.enemyBurnTurns = 4; addLog(ct('effectPoison', { dmg: cs.enemyBurnDmg }), 'info'); break
    case 'blind':         cs.enemyBlinded = true; addLog(ct('effectBlind'), 'info'); break
    case 'flee':          cs.enemyHp = 0; addLog(ct('effectFlee'), 'victory'); break
    case 'distraction':   cs.enemyStunTurns = 1; addLog(ct('effectDistraction'), 'info'); break
    case 'shock':         cs.enemyStunTurns = 1; cs.enemyBurnDmg = rng(10, 18); cs.enemyBurnTurns = 3; addLog(ct('effectShock'), 'warning'); break
    case 'curse':         cs.enemyWeakenedTurns = 3; addLog(ct('effectCurse'), 'info'); break
    case 'confusion':     cs.enemyConfusedTurns = 2; addLog(ct('effectConfusion'), 'info'); break
    case 'silence':       cs.enemySilencedTurns = 2; addLog(ct('effectSilence'), 'info'); break
    case 'disarm':        cs.enemyWeakenedTurns = Math.max(cs.enemyWeakenedTurns, 2); addLog(ct('effectDisarm'), 'info'); break
    case 'random':        applyWeaponEffect(['stun','burn','blind','poison','flee','shock','curse','confusion'][rng(0,7)], cs, addLog); break
  }
}

// Déduit le tier d'un ennemi à partir de ses stats
function inferEnemyTier(enemy: Enemy): 1 | 2 | 3 | 4 {
  if (enemy.isBoss) return 4
  if (enemy.maxHp >= 100) return 3
  if (enemy.maxHp >= 45)  return 2
  return 1
}

function resolveVictory(gs: GameState, enemy: Enemy): { loot: number; extra: Partial<GameState>; rewardInfo: { loot: number; weaponName?: string; armorName?: string; isBossKill: boolean } } {
  const fauconsRep = gs.factionReputation?.faucons ?? 0
  const lootMult = fauconsRep >= 80 ? 1.30 : fauconsRep >= 50 ? 1.20 : fauconsRep >= 20 ? 1.10 : 1.0
  // Économie dure : butin de combat réduit (cf. ECONOMY dans quests.ts).
  let loot = Math.floor(rng(enemy.lootMin, enemy.lootMax) * lootMult * 0.65)
  const extra: Partial<GameState> = {}
  const bossNames = ['Alanossa', 'La Faucon', 'Directeur Pale', 'Garde du Corps d\'Eliotis',
    'Le Boucher de Velkor', 'Oracle de la Singularité', 'Amiral Voss-Kheran', 'La Curatrice',
    'Frère Ossian le Dernier', 'La Mère Mecanique', 'Veilleur du Bout du Monde',
    "L'Architecte du Chaos", 'Commandante Zara Sable', 'Le Colosse de Ferraille',
    'Le Fantôme des Ombres', 'La Bête Noire', 'La Veuve de Vega',
    "L'Exilé Écarlate", 'Patient Zéro', "L'Ombre du Vide", 'Le Roi de Nuit']
  const isBossKill = bossNames.includes(enemy.name)
  let weaponName: string | undefined
  let armorName: string | undefined

  if (isBossKill) {
    extra.bossesDefeated = (gs.bossesDefeated ?? 0) + 1
    const legendary = rollWeaponForTier(5)
    extra.weapons = [...gs.weapons, legendary]
    weaponName = legendary.name
  } else {
    // Tier de drop lié au niveau de l'ennemi
    const enemyTier = inferEnemyTier(enemy)
    // chance de drop et fourchette de tier selon l'ennemi
    const dropChance = enemyTier === 1 ? 22 : enemyTier === 2 ? 32 : enemyTier === 3 ? 42 : 55
    const minTier    = enemyTier === 1 ? 1  : enemyTier === 2 ? 1  : enemyTier === 3 ? 2  : 3
    const maxTier    = enemyTier === 1 ? 1  : enemyTier === 2 ? 2  : enemyTier === 3 ? 3  : 4

    if (rng(0, 99) < dropChance) {
      if (Math.random() < 0.6) {
        const w = rollWeaponForTier(rng(minTier, maxTier))
        extra.weapons = [...gs.weapons, w]
        weaponName = w.name
      } else {
        const a = rollArmorForTier(rng(minTier, maxTier))
        const armorPatch = grantArmor(gs, a)
        if (armorPatch.armors) {
          extra.armors = armorPatch.armors
          armorName = a.name
        } else {
          loot += a.sellValue
        }
      }
    }
  }
  return { loot, extra, rewardInfo: { loot, weaponName, armorName, isBossKill } }
}
