import type { GameState, SubBossData, SubBossResolution, SubBossRequirement } from '../types'
import { shiftPillar } from './memoryEvents'
import { translateGood, translateStationName, translateEnemyName } from './goodsI18n'
import { addJournal } from './journal'
import i18n from '../i18n/config'

const sr = (key: string, params?: Record<string, unknown>) => i18n.t(key, { ns: 'subBossResolutions', ...params })

// ── RÉSOLUTIONS NON-LÉTALES DES LIEUTENANTS ───────────────────────────────────
// Chaque lieutenant (sous-boss) peut être neutralisé autrement que par le combat.
// Chaque voie ouvre une SCÈNE (texte basé sur sa personnalité) avec un coût, un
// risque et des conséquences réelles — au lieu d'un bouton instantané silencieux.

export interface SubBossResolutionResult {
  success: boolean
  message: string
  patch: Partial<GameState>
  triggerCombat?: boolean   // échec qui bascule en combat forcé
}

export function getResolutionMeta(): Record<SubBossResolution, { icon: string; label: string }> {
  return {
    kill:      { icon: '⚔', label: sr('meta.kill') },
    manipulate:{ icon: '🎭', label: sr('meta.manipulate') },
    sabotage:  { icon: '💣', label: sr('meta.sabotage') },
    ally:      { icon: '🤝', label: sr('meta.ally') },
    betray:    { icon: '🗡', label: sr('meta.betray') },
    bribe:     { icon: '💰', label: sr('meta.bribe') },
    service:   { icon: '📜', label: sr('meta.service') },
  }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const pillarKey = (sb: SubBossData) => sb.pillar as keyof GameState['pillarStanding']
const getStanding = (gs: GameState, sb: SubBossData): number =>
  ((gs.pillarStanding ?? {}) as Record<string, number>)[sb.pillar] ?? 0

function markDefeated(gs: GameState, sb: SubBossData): Partial<GameState> {
  const defeated = { ...(gs.subBossesDefeated ?? {}) }
  defeated[sb.pillar] = [...(defeated[sb.pillar] ?? []), sb.id]
  return { subBossesDefeated: defeated }
}

// Coûts / seuils qui montent avec l'ordre du lieutenant (1 = garde avancé, 4 = bras droit).
const MANIPULATE_CR   = (o: number) => 1500 + o * 500       // 2000 / 2500 / 3000 / 3500
const MANIPULATE_PCT  = (o: number) => [55, 45, 35, 30][o - 1] ?? 35
const SABOTAGE_PCT    = (o: number) => [85, 75, 65, 55][o - 1] ?? 65
const ALLY_STANDING   = (o: number) => 15 + o * 8           // 23 / 31 / 39 / 47
const ALLY_REWARD_CR  = (o: number) => 800 + o * 400        // 1200 … 2400

// ── DISPONIBILITÉ (pour l'UI) ─────────────────────────────────────────────────

export function canResolveSubBoss(
  gs: GameState, sb: SubBossData, action: SubBossResolution,
): { ok: boolean; reason?: string; hint: string } {
  const o = sb.order
  switch (action) {
    case 'manipulate': {
      const cr = MANIPULATE_CR(o)
      const pct = MANIPULATE_PCT(o)
      if (gs.credits < cr) return { ok: false, reason: sr('canResolve.manipulateWhyNot', { amount: (cr - gs.credits).toLocaleString() }), hint: sr('canResolve.manipulateHintFail', { cr: cr.toLocaleString(), pct }) }
      return { ok: true, hint: sr('canResolve.manipulateHintOk', { cr: cr.toLocaleString(), pct }) }
    }
    case 'sabotage': {
      const have = gs.cargo['Composants électroniques'] ?? 0
      const pct = SABOTAGE_PCT(o)
      if (have < 2) return { ok: false, reason: sr('canResolve.sabotageWhyNot', { have }), hint: sr('canResolve.sabotageHintFail', { pct }) }
      return { ok: true, hint: sr('canResolve.sabotageHintOk', { pct }) }
    }
    case 'ally': {
      const req = ALLY_STANDING(o)
      const st = getStanding(gs, sb)
      if (st < req || gs.reputation < 40) {
        const m: string[] = []
        if (st < req) m.push(sr('canResolve.allyStandingReason', { pillar: cap(sb.pillar), cur: st, req }))
        if (gs.reputation < 40) m.push(sr('canResolve.allyRepReason', { rep: gs.reputation }))
        return { ok: false, reason: m.join(' · '), hint: sr('canResolve.allyHintFail', { req }) }
      }
      return { ok: true, hint: sr('canResolve.allyHintOk') }
    }
    case 'betray': {
      const st = getStanding(gs, sb)
      if (st < 15) return { ok: false, reason: sr('canResolve.betrayWhyNot', { pillar: cap(sb.pillar), cur: st }), hint: sr('canResolve.betrayHintFail') }
      return { ok: true, hint: sr('canResolve.betrayHintOk') }
    }
    // ── RACHAT : cher mais certain. Le prix est propre à chaque lieutenant. ──
    case 'bribe': {
      if (!sb.bribe) return { ok: false, hint: '' }
      const cr = sb.bribe.credits
      if (gs.credits < cr) {
        return {
          ok: false,
          reason: sr('canResolve.bribeWhyNot', { amount: (cr - gs.credits).toLocaleString() }),
          hint: sr('canResolve.bribeHintFail', { cr: cr.toLocaleString() }),
        }
      }
      return { ok: true, hint: sr('canResolve.bribeHintOk', { cr: cr.toLocaleString() }) }
    }
    // ── SERVICE : il faut d'abord accepter le marché, puis revenir l'honorer.
    // On ne peut pas remplir ses conditions par hasard sans s'être engagé. ──
    case 'service': {
      if (!sb.service) return { ok: false, hint: '' }
      const summary = describeRequirements(sb.service.requirements)
      if (hasBrokenPact(gs, sb)) {
        return { ok: false, reason: sr('canResolve.servicePactBroken', { name: sb.name }), hint: sr('canResolve.servicePactBrokenHint') }
      }
      if (!hasPact(gs, sb)) {
        // Le marché n'est pas encore accepté : le bouton sert à s'engager.
        return { ok: true, hint: sr('canResolve.serviceNotAccepted', { list: summary }) }
      }
      const missing = missingServiceRequirements(gs, sb.service.requirements)
      if (missing.length > 0) {
        return { ok: false, reason: sr('canResolve.servicePending', { missing: missing.join(' · ') }), hint: sr('canResolve.serviceHintFail', { list: summary }) }
      }
      return { ok: true, hint: sr('canResolve.serviceHintOk', { list: summary }) }
    }
    default:
      return { ok: false, hint: '' }
  }
}

// Évalue les conditions d'un service et renvoie ce qui manque, en clair.
function missingServiceRequirements(gs: GameState, reqs: SubBossRequirement[]): string[] {
  const missing: string[] = []
  for (const req of reqs) {
    switch (req.type) {
      case 'credits':
        if (gs.credits < req.amount) missing.push(sr('service.missing.credits', { amount: (req.amount - gs.credits).toLocaleString() }))
        break
      case 'reputation':
        if (gs.reputation < req.min) missing.push(sr('service.missing.reputation', { value: gs.reputation, needed: req.min }))
        break
      case 'item': {
        const qty = gs.cargo[req.name] ?? 0
        if (qty < req.qty) missing.push(sr('service.missing.item', { name: translateGood(req.name), have: qty, needed: req.qty }))
        break
      }
      case 'combatsWon':
        if ((gs.combatsWon ?? 0) < req.min) missing.push(sr('service.missing.combatsWon', { value: gs.combatsWon ?? 0, needed: req.min }))
        break
      case 'visitStation':
        if (!gs.visitedStations.includes(req.station)) missing.push(sr('service.missing.visitStation', { station: translateStationName(req.station) }))
        break
      case 'bossKill':
        if (!gs.stationBossesBeaten.includes(req.bossName)) missing.push(sr('service.missing.bossKill', { boss: translateEnemyName(req.bossName) }))
        break
      case 'day':
        if (gs.day < req.min) missing.push(sr('service.missing.day', { value: gs.day, needed: req.min }))
        break
      case 'subBoss': {
        const all = Object.values(gs.subBossesDefeated ?? {}).flat()
        if (!all.includes(req.subBossId)) missing.push(sr('service.missing.subBoss'))
        break
      }
      case 'pillarStanding': {
        const cur = (gs.pillarStanding ?? {})[req.pillar as keyof typeof gs.pillarStanding] ?? 0
        if (cur < req.min) missing.push(sr('service.missing.pillarStanding', { pillar: cap(req.pillar), cur, needed: req.min }))
        break
      }
      case 'factionReputation': {
        const cur = gs.factionReputation[req.faction] ?? 0
        if (cur < req.min) missing.push(sr('service.missing.factionReputation', { faction: req.faction, cur, needed: req.min }))
        break
      }
      case 'questsCompleted':
        if (gs.completedQuestIds.length < req.min) missing.push(sr('service.missing.questsCompleted', { value: gs.completedQuestIds.length, needed: req.min }))
        break
    }
  }
  return missing
}

// ── MARCHÉS AVEC LES LIEUTENANTS ──────────────────────────────────────────────
// Un service n'est plus une simple case à cocher : on s'engage explicitement,
// le marché est suivi comme une quête, et le rompre a un coût.

export function hasPact(gs: GameState, sb: SubBossData): boolean {
  return (gs.lieutenantPacts ?? []).includes(sb.id)
}

export function hasBrokenPact(gs: GameState, sb: SubBossData): boolean {
  return (gs.brokenPacts ?? []).includes(sb.id)
}

/** Ce qui manque encore pour honorer un marché déjà accepté. */
export function pactProgress(gs: GameState, sb: SubBossData): { done: boolean; missing: string[] } {
  const missing = missingServiceRequirements(gs, sb.service?.requirements ?? [])
  return { done: missing.length === 0, missing }
}

export function acceptPact(gs: GameState, sb: SubBossData): SubBossResolutionResult {
  return {
    success: true,
    message: sr('pact.accepted', { name: sb.name, list: describeRequirements(sb.service?.requirements ?? []) }),
    patch: {
      lieutenantPacts: [...(gs.lieutenantPacts ?? []), sb.id],
      journal: addJournal(gs, sr('pact.journalAccepted', { name: sb.name, station: translateStationName(sb.station) }), 'decision'),
    },
  }
}

/** Rompre un marché : il ne renégociera plus. Restent le combat ou le rachat. */
export function breakPact(gs: GameState, sb: SubBossData): SubBossResolutionResult {
  return {
    success: true,
    message: sr('pact.broken', { name: sb.name }),
    patch: {
      lieutenantPacts: (gs.lieutenantPacts ?? []).filter(id => id !== sb.id),
      brokenPacts: [...(gs.brokenPacts ?? []), sb.id],
      pillarStanding: shiftPillar(gs, pillarKey(sb), -12),
      reputation: gs.reputation - 5,
      journal: addJournal(gs, sr('pact.journalBroken', { name: sb.name }), 'decision'),
    },
  }
}

// Résumé lisible de ce que le lieutenant exige, affiché avant de s'engager.
function describeRequirements(reqs: SubBossRequirement[]): string {
  return reqs.map(req => {
    switch (req.type) {
      case 'credits':           return sr('service.req.credits', { amount: req.amount.toLocaleString() })
      case 'reputation':        return sr('service.req.reputation', { value: req.min })
      case 'item':              return sr('service.req.item', { name: translateGood(req.name), qty: req.qty })
      case 'combatsWon':        return sr('service.req.combatsWon', { value: req.min })
      case 'visitStation':      return sr('service.req.visitStation', { station: translateStationName(req.station) })
      case 'bossKill':          return sr('service.req.bossKill', { boss: translateEnemyName(req.bossName) })
      case 'day':               return sr('service.req.day', { value: req.min })
      case 'subBoss':           return sr('service.req.subBoss')
      case 'pillarStanding':    return sr('service.req.pillarStanding', { pillar: cap(req.pillar), value: req.min })
      case 'factionReputation': return sr('service.req.factionReputation', { faction: req.faction, value: req.min })
      case 'questsCompleted':   return sr('service.req.questsCompleted', { value: req.min })
    }
  }).join(' · ')
}

// ── EXÉCUTION (scène + effets) ────────────────────────────────────────────────

export function resolveSubBoss(
  gs: GameState, sb: SubBossData, action: SubBossResolution,
): SubBossResolutionResult {
  const check = canResolveSubBoss(gs, sb, action)
  if (!check.ok) return { success: false, message: check.reason ?? sr('canResolve.conditionsNotMet'), patch: {} }

  const o = sb.order
  const boss = cap(sb.pillar)

  switch (action) {
    // ── MANIPULER : ruse coûteuse. Échec = il te démasque et attaque. ──
    case 'manipulate': {
      const cr = MANIPULATE_CR(o)
      const ok = Math.random() * 100 < MANIPULATE_PCT(o)
      if (ok) {
        return {
          success: true,
          message: sr('resolve.manipulateSuccess', { trait: sb.personality.split('.')[0], name: sb.name, cr: cr.toLocaleString() }),
          patch: {
            ...markDefeated(gs, sb),
            credits: gs.credits - cr,
            pillarStanding: shiftPillar(gs, pillarKey(sb), -3),
          },
        }
      }
      const hpLoss = Math.floor(Math.random() * 20) + 15
      return {
        success: false,
        message: sr('resolve.manipulateFail', { name: sb.name, cr: cr.toLocaleString(), hp: hpLoss }),
        patch: {
          credits: gs.credits - cr,
          playerHp: Math.max(1, gs.playerHp - hpLoss),
          pillarStanding: shiftPillar(gs, pillarKey(sb), -8),
        },
        triggerCombat: true,
      }
    }

    // ── SABOTER : préparation matérielle. Échec = alarme, pas de neutralisation. ──
    case 'sabotage': {
      const newCargo = { ...gs.cargo }
      newCargo['Composants électroniques'] = (newCargo['Composants électroniques'] ?? 0) - 2
      if (newCargo['Composants électroniques'] <= 0) delete newCargo['Composants électroniques']
      const ok = Math.random() * 100 < SABOTAGE_PCT(o)
      if (ok) {
        return {
          success: true,
          message: sr('resolve.sabotageSuccess', { mechanic: sb.combatMechanic.split(':')[0].toLowerCase(), name: sb.name }),
          patch: { ...markDefeated(gs, sb), cargo: newCargo },
        }
      }
      return {
        success: false,
        message: sr('resolve.sabotageFail', { name: sb.name }),
        patch: { cargo: newCargo, pillarStanding: shiftPillar(gs, pillarKey(sb), -6) },
      }
    }

    // ── RALLIER : le retourner à ta cause. Cher en réputation/standing, gros gain. ──
    case 'ally': {
      const reward = ALLY_REWARD_CR(o)
      return {
        success: true,
        message: sr('resolve.allySuccess', { motivation: sb.motivation, boss, name: sb.name, reward: reward.toLocaleString() }),
        patch: {
          ...markDefeated(gs, sb),
          credits: gs.credits + reward,
          pillarStanding: shiftPillar(gs, pillarKey(sb), +12),
          reputation: gs.reputation + 6,
          pastDecisions: [...(gs.pastDecisions ?? []), `allied-lt-${sb.id}`],
        },
      }
    }

    // ── TRAHIR : gagner sa confiance pour le poignarder. Mercenaire, mal vu. ──
    case 'betray': {
      const loot = sb.enemy.lootMax
      return {
        success: true,
        message: sr('resolve.betraySuccess', { name: sb.name, loot: loot.toLocaleString(), boss }),
        patch: {
          ...markDefeated(gs, sb),
          credits: gs.credits + loot,
          pillarStanding: shiftPillar(gs, pillarKey(sb), -25),
          reputation: gs.reputation - 10,
          pastDecisions: [...(gs.pastDecisions ?? []), `betrayed-lt-${sb.id}`],
        },
      }
    }

    // ── RACHAT : il se retire contre paiement. Aucun risque, mais le prix fait
    // mal et le pilier apprend que ses hommes s'achètent. ──
    case 'bribe': {
      const cr = sb.bribe?.credits ?? 0
      return {
        success: true,
        message: sr('resolve.bribeSuccess', { name: sb.name, cr: cr.toLocaleString(), boss }),
        patch: {
          ...markDefeated(gs, sb),
          credits: gs.credits - cr,
          pillarStanding: shiftPillar(gs, pillarKey(sb), -8),
          pastDecisions: [...(gs.pastDecisions ?? []), `bribed-lt-${sb.id}`],
        },
      }
    }

    // ── SERVICE : deux temps. Sans marché accepté, ce clic engage le joueur.
    // Avec marché rempli, il honore et le lieutenant se retire. ──
    case 'service': {
      if (!hasPact(gs, sb)) return acceptPact(gs, sb)
      const spent: Partial<GameState> = {}
      // Les conditions matérielles sont consommées : le service a un coût réel.
      let cargo = { ...gs.cargo }
      let credits = gs.credits
      for (const req of sb.service?.requirements ?? []) {
        if (req.type === 'item') {
          const left = (cargo[req.name] ?? 0) - req.qty
          if (left > 0) cargo[req.name] = left
          else delete cargo[req.name]
        }
        if (req.type === 'credits') credits -= req.amount
      }
      spent.cargo = cargo
      spent.credits = credits
      return {
        success: true,
        message: sr('resolve.serviceSuccess', { name: sb.name, boss }),
        patch: {
          ...markDefeated(gs, sb),
          ...spent,
          // le marché est honoré : il sort des quêtes en cours
          lieutenantPacts: (gs.lieutenantPacts ?? []).filter(id => id !== sb.id),
          pillarStanding: shiftPillar(gs, pillarKey(sb), +10),
          reputation: gs.reputation + 8,
          pastDecisions: [...(gs.pastDecisions ?? []), `served-lt-${sb.id}`],
          journal: addJournal(gs, sr('pact.journalHonored', { name: sb.name }), 'decision'),
        },
      }
    }

    default:
      return { success: false, message: sr('canResolve.unavailable'), patch: {} }
  }
}
