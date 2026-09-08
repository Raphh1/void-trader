import { useState, useEffect, useMemo } from 'react'
import { questTitle, questDescription } from '../../engine/questI18n'
import { TypewriterText } from '../ui/TypewriterText'
import type { GameState, WeaponData } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { StatusBar } from '../ui/StatusBar'
import { getStation, BOSS_STATIONS, FUEL_STATIONS, getAccessibleStations, getFuelCost } from '../../data/stations'
import { getEnemyForStation, scaleEnemy, getTierBoss } from '../../data/enemies'
import { rollExplorationEvent, rollWanderEvent, type WanderEvent } from '../../engine/exploration'
import type { ExploreResult } from '../../engine/exploration'
import { generateQuest } from '../../engine/quests'
import { getStationEvents, type StationEvent } from '../../engine/stationEvents'
import { getNamedNpcs, getNpcService } from '../../engine/npcTracker'
import { getAmbiance } from '../../engine/jsonEventLoader'
import { getEnemyByTier } from '../../data/enemies'
import { checkArcTriggers } from '../../engine/narrativeArcs'
import { getObjectives } from '../../engine/objectives'
import { StopTheBar, type StopResult } from '../minigames/StopTheBar'
import { CardGame } from '../minigames/CardGame'
import { ScenarioGame } from '../minigames/ScenarioGame'
import { CustomsGame } from '../minigames/CustomsGame'
import { translateGood, translateWeaponName, translateArmorName, translateEnemyName, translateClassName, translateStationName, translateNpcRole } from '../../engine/goodsI18n'
import { stalkerToEnemy, getStalkerAmbushChance, getStalkerPresenceText } from '../../engine/stalker'
import { isFactionBlockedAtStation, getStationFactionName, STATION_FACTION_CONTROL } from '../../engine/factionRep'
import { getArrivalSituation, type ArrivalSituation } from '../../engine/arrivalSituations'
import { getBossHomeVisit, resolveBossHomeVisit, type BossHomeVisitDef, type BossHomeVisitResult } from '../../engine/bossHomeVisits'
import { getRunModifiers } from '../../data/runModifiers'
import { getRunObjective } from '../../data/runObjectives'
import { getSubBossAtStation, isSubBossDefeated, getSubBossProgress, arePillarSubBossesCleared, getSubBossesForPillar, getSubBossStation, rollLieutenantClueEvent, LIEUTENANT_CLUE_REVEAL_LEVEL, type LieutenantClueEvent } from '../../data/subBosses'
import { canResolveSubBoss, resolveSubBoss, getResolutionMeta, hasPact, pactProgress, breakPact } from '../../engine/subBossResolutions'
import { getAvailableClues, canCollectClue, collectClue } from '../../engine/nexus'
import { getDailyExpenses, getDailyExpenseBreakdown } from '../../engine/expenses'
import { resolveShipDown } from '../../engine/shipDamage'
import { useTranslation } from 'react-i18next'
import { getActiveEvents } from '../../engine/worldEvents'
import { getQuestsAtStation, canStartQuest, completeQuest, type EquipmentQuest } from '../../data/equipmentQuests'
import { LORE_TOTAL } from '../../data/loreFragments'
import { ExploreResultPanel } from './hub/ExploreResultPanel'
import { WanderResultPanel } from './hub/WanderResultPanel'
import { QuestOfferPanel } from './hub/QuestOfferPanel'
import { StationEventPanel } from './hub/StationEventPanel'
import { NpcEncounterPanel } from './hub/NpcEncounterPanel'

const DANGER_CLS   = ['danger-0', 'danger-1', 'danger-2', 'danger-3']

type HubMode = 'menu' | 'explore-result' | 'wander-result' | 'quest-offer' | 'station-event' | 'npc-encounter' | 'lockpick-game' | 'card-game' | 'fuel-scavenge' | 'delivery-event' | 'negotiation' | 'navigation-minigame' | 'customs' | 'lieutenant-clue'

export function StationHub() {
  const { t, i18n }   = useTranslation('stationHub')
  const DANGER_LABEL = t('dangerLabels', { returnObjects: true }) as unknown as string[]

  const gs           = useGameStore(s => s.gs!)
  const goTo         = useGameStore(s => s.goTo)
  const startCombat  = useGameStore(s => s.startCombat)
  const patch        = useGameStore(s => s.patch)
  const addQuest     = useGameStore(s => s.addQuest)
  const manualCompleteQuest = useGameStore(s => s.manualCompleteQuest)
  const resolveRayaneGamble = useGameStore(s => s.resolveRayaneGamble)
  const collectNexusFragment = useGameStore(s => s.collectNexusFragment)

  // Marchés en cours avec des lieutenants, recalculés à chaque rendu pour que
  // la progression suive l'état réel du joueur (cargo, réputation, voyages...).
  const activePacts = (gs.lieutenantPacts ?? [])
    .map(id => ['alanossa', 'cesarion', 'raphazarus', 'scotty']
      .flatMap(p => getSubBossesForPillar(p, gs))
      .find(sb => sb.id === id))
    .filter((sb): sb is NonNullable<typeof sb> => !!sb)
    .map(sb => ({ sb, progress: pactProgress(gs, sb) }))

  function tickPatrolProgress() {
    const q = gs.activeQuests.find(aq => aq.type === 'patrol' && aq.targetStation === gs.currentStation)
    if (!q) return
    const newProgress = (q.progress ?? 0) + 1
    if (newProgress >= 3) {
      manualCompleteQuest(q.id)
    } else {
      patch({ activeQuests: gs.activeQuests.map(aq => aq.id === q.id ? { ...aq, progress: newProgress } : aq) })
    }
  }
  const spendAction  = useGameStore(s => s.spendAction)
  const travelMsg    = useGameStore(s => s.travelEventMessage)
  const objPopup     = useGameStore(s => s.objectivePopup)
  const questPopup   = useGameStore(s => s.questCompletionMsg)
  const dismissTravel    = useGameStore(s => s.dismissTravelEvent)
  const dismissObj       = useGameStore(s => s.dismissObjectivePopup)
  const dismissQuest     = useGameStore(s => s.dismissQuestCompletion)
  const chainEvent       = useGameStore(s => s.chainEventNotification)
  const dismissChain     = useGameStore(s => s.dismissChainEvent)
  const worldEventPopup  = useGameStore(s => s.worldEventPopup)
  const dismissWorldEvent = useGameStore(s => s.dismissWorldEventPopup)
  const advanceMajorQuests = useGameStore(s => s.advanceMajorQuests)

  const [mode, setMode]             = useState<HubMode>('menu')
  const [exploreResult, setExploreResult] = useState<ExploreResult | null>(null)
  const [wanderEvent, setWanderEvent]     = useState<WanderEvent | null>(null)
  const [questOffer, setQuestOffer]       = useState<ReturnType<typeof generateQuest>>(null)
  const [stationEvent, setStationEvent]   = useState<StationEvent | null>(null)
  const [npcDialogResult, setNpcDialogResult] = useState<string | null>(null)
  const [lockpickMsg, setLockpickMsg] = useState<string | null>(null)
  const [miniGameReward, setMiniGameReward] = useState<Partial<GameState>>({})
  const [fuelScavResult, setFuelScavResult] = useState<string | null>(null)
  const [specialResult, setSpecialResult]   = useState<string | null>(null)
  const [gambleWin, setGambleWin]           = useState(false)
  type DealCondition = { id: string; label: string; desc: string; fuelAmount: number; available: boolean; whyNot?: string; accept: () => void }
  const [dealConditions, setDealConditions] = useState<DealCondition[] | null>(null)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [clueMsg, setClueMsg] = useState<string | null>(null)
  const [clueUnlocked, setClueUnlocked] = useState(false)
  const [subBossResult, setSubBossResult] = useState<{ message: string; success: boolean } | null>(null)
  const [lieutenantClueEvent, setLieutenantClueEvent] = useState<LieutenantClueEvent | null>(null)
  const [arrivalSit, setArrivalSit] = useState<ArrivalSituation | null>(null)
  const [arrivalResult, setArrivalResult] = useState<string | null>(null)
  const [bossVisit, setBossVisit] = useState<BossHomeVisitDef | null>(null)
  const [bossVisitResult, setBossVisitResult] = useState<BossHomeVisitResult | null>(null)
  const [pendingDeliveryQuest, setPendingDeliveryQuest] = useState<ReturnType<typeof generateQuest>>(null)
  const [deliveryResult, setDeliveryResult] = useState<string | null>(null)
  const [negotiationBase]   = useState(() => Math.floor(Math.random() * 1500 + 600))
  const [negoResult, setNegoResult]         = useState<{ earned: number; label: string } | null>(null)
  const [questRerollsLeft, setQuestRerollsLeft] = useState(3)
  const [navResult, setNavResult]           = useState<{ shipDamage: number; bonusCredits: number } | null>(null)
  const [customsResult, setCustomsResult]   = useState<{ confiscated: string[]; repChange: number } | null>(null)
  const [hoveredQuest, setHoveredQuest]     = useState<string | null>(null)

  const station      = getStation(gs.currentStation)
  const accessibleStations = getAccessibleStations(gs.currentStation)
  const reachableCount = accessibleStations.filter(s => getFuelCost(gs.currentStation, s.name) <= gs.fuel).length
  // Le carburant n'est le VRAI facteur limitant que si une destination deviendrait
  // atteignable avec plus de carburant (coût > fuel actuel mais <= réservoir max).
  // Sinon (ex : réservoir plein, station peu connectée), pas d'alerte carburant.
  const fuelWouldHelp = accessibleStations.some(s => {
    const c = getFuelCost(gs.currentStation, s.name)
    return c > gs.fuel && c <= gs.maxFuel
  })
  const fuelStranded = reachableCount === 0 && gs.fuel > 0 && fuelWouldHelp
  // Soupape de sécurité : chercher du carburant est proposé quand on est à sec, ou
  // en état critique ET que du carburant supplémentaire débloquerait une route.
  const fuelCritical = reachableCount <= 1 && fuelWouldHelp
  const canScavengeFuel = (gs.fuel <= 0 || fuelCritical) && !FUEL_STATIONS.has(gs.currentStation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ambianceText = useMemo(() => getAmbiance(gs.currentStation), [gs.currentStation, i18n.language])
  const factionBlocked     = isFactionBlockedAtStation(gs, gs.currentStation)
  const blockedFactionName = getStationFactionName(gs.currentStation)
  const outcome      = gs.pendingCombatOutcome
  const stationEvts  = getStationEvents(gs).filter(
    ev => !(gs.usedLocalActivities ?? []).includes(`${gs.currentStation}-${ev.id}`)
  )
  const localNpc     = getNamedNpcs().find(n => n.station === gs.currentStation)
  const availableArcs = checkArcTriggers(gs)
  const hasArcs      = gs.activeArcs.length > 0 || availableArcs.length > 0 || gs.completedArcs.length > 0
  const newArcsCount = availableArcs.filter(a => !gs.activeArcs.find(b => b.id === a.id)).length

  // Situation d'arrivée — calculée une fois au montage si pendingArrival est vrai
  useEffect(() => {
    if (gs.pendingArrival && !arrivalSit) {
      const sit = getArrivalSituation(gs, true)
      if (sit) setArrivalSit(sit)
      else patch({ pendingArrival: false })
    }
  }, [])

  // Visite privée d'un détenteur — calculée une fois au montage si pendingBossVisit est posé
  useEffect(() => {
    if (gs.pendingBossVisit && !bossVisit) {
      const def = getBossHomeVisit(gs.pendingBossVisit)
      if (def) setBossVisit(def)
      else patch({ pendingBossVisit: null })
    }
  }, [])

  // Réinitialise le résultat de résolution de lieutenant au changement de station.
  useEffect(() => { setSubBossResult(null) }, [gs.currentStation])

  // Arriver physiquement à la station d'un lieutenant le révèle automatiquement —
  // pas besoin d'indice si le joueur l'a trouvé tout seul.
  useEffect(() => {
    const sb = getSubBossAtStation(gs, gs.currentStation)
    if (sb && !(gs.lieutenantLocationsKnown ?? []).includes(sb.id) && !isSubBossDefeated(gs.subBossesDefeated ?? {}, sb.id)) {
      patch({ lieutenantLocationsKnown: [...(gs.lieutenantLocationsKnown ?? []), sb.id] })
    }
  }, [gs.currentStation])

  // Contrôle douanier auto sur stations militaires (une fois par visite de station/jour)
  useEffect(() => {
    const key = `customs_${gs.currentStation}_${gs.day}`
    if (
      station.type === 'military' &&
      Object.keys(gs.cargo).length > 0 &&
      !sessionStorage.getItem(key) &&
      Math.random() < 0.38
    ) {
      sessionStorage.setItem(key, '1')
      setMode('customs')
    }
  }, [])

  // ── ACTIONS ──────────────────────────────────────────────────────────────

  function explore() {
    spendAction()
    tickPatrolProgress()
    if (gs.stalker && Math.random() < getStalkerAmbushChance(gs.stalker, 'explore')) {
      startCombat(stalkerToEnemy(gs.stalker))
      return
    }

    const clueRoll = rollLieutenantClueEvent(gs)
    if (clueRoll.event) {
      const sb = clueRoll.event.subBoss
      const levels = { ...(gs.lieutenantClueLevels ?? {}), [sb.id]: clueRoll.event.level }
      const known = clueRoll.event.level >= LIEUTENANT_CLUE_REVEAL_LEVEL
        ? [...(gs.lieutenantLocationsKnown ?? []), sb.id]
        : (gs.lieutenantLocationsKnown ?? [])
      patch({
        lieutenantClueLevels: levels,
        lieutenantLocationsKnown: known,
        ...(clueRoll.newMilestone !== null ? { lieutenantClueMilestone: clueRoll.newMilestone } : {}),
      })
      setLieutenantClueEvent(clueRoll.event)
      setMode('lieutenant-clue')
      return
    }
    if (clueRoll.newMilestone !== null) {
      patch({ lieutenantClueMilestone: clueRoll.newMilestone })
    }

    const depth = gs.zoneDepth + 1
    const result = rollExplorationEvent({ ...gs, zoneDepth: depth })
    if (result.type === 'combat') {
      patch({ zoneDepth: depth, lastExploreWasCombat: true, explorationFightsDone: (gs.explorationFightsDone ?? 0) + 1 })
      startCombat(scaleEnemy(getEnemyForStation(gs.currentStation, depth, gs.day), Math.max(0, depth - 2)))
      return
    }
    if (result.type === 'boss') {
      patch({ zoneDepth: depth, lastExploreWasCombat: true })
      const bossName = BOSS_STATIONS[gs.currentStation]
      const tierBoss = getTierBoss()
      const boss = bossName
        ? (tierBoss.find(b => b.name === bossName) ?? tierBoss[Math.floor(Math.random() * tierBoss.length)])
        : tierBoss[Math.floor(Math.random() * tierBoss.length)]
      startCombat(boss)
      return
    }
    patch({ zoneDepth: depth, lastExploreWasCombat: false })
    setExploreResult(result); setLockpickMsg(null); setMode('explore-result')
  }

  function wander() {
    spendAction()
    tickPatrolProgress()
    if (gs.stalker && Math.random() < getStalkerAmbushChance(gs.stalker, 'wander')) {
      startCombat(stalkerToEnemy(gs.stalker))
      return
    }
    // Sur les stations risquées/dangereuses, risque de tomber sur des problèmes
    const wanderCombatChance = station.danger >= 3 ? 0.30 : station.danger >= 2 ? 0.22 : station.danger >= 1 ? 0.12 : 0
    if (wanderCombatChance > 0 && Math.random() < wanderCombatChance) {
      const tier = station.danger >= 3 ? 3 : station.danger >= 2 ? 2 : 1
      startCombat(scaleEnemy(getEnemyByTier(tier as 1|2|3), Math.floor(gs.day / 15)))
      return
    }
    setWanderEvent(rollWanderEvent(gs)); setMode('wander-result')
  }

  function lookForQuest() {
    spendAction()
    setQuestRerollsLeft(3)
    // Priorité aux quêtes enchaînées en attente
    const chainPending = (gs.pendingChainQuests ?? [])
    if (chainPending.length > 0) {
      const [next, ...rest] = chainPending
      patch({ pendingChainQuests: rest })
      setQuestOffer(next)
    } else {
      setQuestOffer(generateQuest(gs))
    }
    setMode('quest-offer')
  }

  function rerollQuest() {
    setQuestRerollsLeft(n => n - 1)
    setQuestOffer(generateQuest(gs))
  }

  function openStationEvent(ev: StationEvent) {
    spendAction()
    setStationEvent(ev); setMode('station-event')
  }

  // ── MODES ────────────────────────────────────────────────────────────────

  if (mode === 'lieutenant-clue' && lieutenantClueEvent) {
    const revealed = lieutenantClueEvent.level >= LIEUTENANT_CLUE_REVEAL_LEVEL
    return (
      <div className="layout">
        <div className="px-box" style={{ borderColor: 'var(--purple)' }}>
          <div className="t-xs mb8" style={{ color: 'var(--purple)', letterSpacing: '2px' }}>{t('informant')}</div>
          <div className="t-xs mb8" style={{ lineHeight: 1.8 }}>{lieutenantClueEvent.npcLine}</div>
          <div className="px-box" style={{ borderColor: 'var(--gold)', background: 'rgba(30,20,0,0.15)' }}>
            <div className="t-xs t-gold mb4" style={{ letterSpacing: '1px' }}>
              {t('clueLabel', { name: translateEnemyName(lieutenantClueEvent.subBoss.name), pillar: lieutenantClueEvent.subBoss.pillar.charAt(0).toUpperCase() + lieutenantClueEvent.subBoss.pillar.slice(1) })}
            </div>
            <div className="t-xs" style={{ lineHeight: 1.8 }}>{lieutenantClueEvent.clueText}</div>
          </div>
          {revealed ? (
            <div className="t-xs t-green mt8">{t('locationConfirmed')}</div>
          ) : (
            <div className="t-xs t-dim mt8">{t('locationHint')}</div>
          )}
          <button className="px-btn mt8" onClick={() => { setLieutenantClueEvent(null); setMode('menu') }}>{t('continueButton')}</button>
        </div>
      </div>
    )
  }

  if (mode === 'explore-result' && exploreResult) {
    return (
      <ExploreResultPanel
        gs={gs}
        exploreResult={exploreResult}
        initialResultMsg={lockpickMsg}
        onContinue={explore}
        onReturn={() => { patch({ zoneDepth: 0 }); setLockpickMsg(null); setMode('menu') }}
        onStartLockpick={(reward) => { setMiniGameReward(reward); setMode('lockpick-game') }}
        patch={patch}
      />
    )
  }

  if (mode === 'wander-result' && wanderEvent) {
    return (
      <WanderResultPanel
        gs={gs}
        wanderEvent={wanderEvent}
        dangerLevel={station.danger}
        onReturn={() => setMode('menu')}
        startCombat={startCombat}
        patch={patch}
        addQuest={addQuest}
        spendAction={spendAction}
        onWanderAgain={(next) => setWanderEvent(next)}
        onNegotiation={() => { setNegoResult(null); setMode('negotiation') }}
        onNavigation={() => { setNavResult(null); setMode('navigation-minigame') }}
      />
    )
  }

  if (mode === 'station-event' && stationEvent) {
    return (
      <StationEventPanel
        gs={gs}
        stationEvent={stationEvent}
        stationName={station.name}
        onReturn={() => setMode('menu')}
        startCombat={startCombat}
        patch={patch}
      />
    )
  }

  if (mode === 'lockpick-game') {
    return (
      <StopTheBar difficulty={2} label={t('lockpick.label')} onResult={(result: StopResult) => {
        if (result === 'perfect') {
          const bonus = Math.floor((miniGameReward.credits ?? 0) * 0.2)
          patch({ ...miniGameReward, credits: (miniGameReward.credits ?? 0) + bonus })
          setLockpickMsg(t('lockpick.perfect', { amount: ((miniGameReward.credits ?? 0) + bonus).toLocaleString() }))
        } else if (result === 'good') {
          patch(miniGameReward)
          setLockpickMsg(t('lockpick.success', { amount: (miniGameReward.credits ?? 0).toLocaleString() }))
        } else {
          setLockpickMsg(t('lockpick.fail'))
          patch({ reputation: gs.reputation - 5 })
        }
        setMode('explore-result')
      }} />
    )
  }

  if (mode === 'card-game') {
    return (
      <CardGame onResult={(creditsWon) => {
        if (creditsWon > 0) {
          patch({ credits: gs.credits + creditsWon })
        }
        setNpcDialogResult(creditsWon > 0 ? t('cardGame.won', { amount: creditsWon.toLocaleString() }) : t('cardGame.lost'))
        setMode('npc-encounter')
      }} />
    )
  }

  // ── LIVRAISON MANUELLE AVEC OBSTACLES ────────────────────────────────────

  if (mode === 'delivery-event' && pendingDeliveryQuest) {
    const q = pendingDeliveryQuest

    const DELIVERY_SCENES = (t('delivery.scenes', { returnObjects: true }) as unknown as { desc: string; outcome: string }[])
      .map(s => ({ desc: s.desc.replace('{{giver}}', q.giver), outcome: s.outcome as 'smooth' | 'tense' | 'detour' | 'ambush' | 'negotiation' }))

    const HEIST_SCENES = (t('delivery.heistScenes', { returnObjects: true }) as unknown as { desc: string; outcome: string }[])
      .map(s => ({ desc: s.desc.replace(/\{\{giver\}\}/g, q.giver), outcome: s.outcome as 'smooth' | 'tense' | 'detour' | 'ambush' | 'negotiation' }))

    const scenes = q.type === 'heist' ? HEIST_SCENES : DELIVERY_SCENES
    const scene = scenes[Math.floor(Math.random() * scenes.length)]

    function resolveDelivery(choice: 'proceed' | 'negotiate' | 'flee') {
      if (choice === 'flee') {
        setDeliveryResult(t('delivery.resultAbandoned'))
        setMode('menu')
        setPendingDeliveryQuest(null)
        return
      }
      if (choice === 'negotiate') {
        const success = Math.random() < 0.55 + gs.reputation / 300
        if (success) {
          manualCompleteQuest(q.id)
          setMode('menu')
          setPendingDeliveryQuest(null)
        } else {
          patch({ credits: gs.credits - Math.floor(q.creditReward * 0.15) })
          setDeliveryResult(t('delivery.resultNegotiateFail'))
          manualCompleteQuest(q.id)
          setTimeout(() => { setMode('menu'); setPendingDeliveryQuest(null) }, 50)
        }
        return
      }
      // proceed — résoudre selon l'outcome de la scène
      if (scene.outcome === 'smooth' || scene.outcome === 'detour') {
        manualCompleteQuest(q.id)
        setMode('menu')
        setPendingDeliveryQuest(null)
      } else if (scene.outcome === 'ambush') {
        setPendingDeliveryQuest(null)
        patch({ pendingFuelReward: 0 })
        manualCompleteQuest(q.id)
        startCombat(scaleEnemy(getEnemyByTier(station.danger >= 2 ? 2 : 1), Math.floor(gs.day / 15)))
      } else {
        manualCompleteQuest(q.id)
        setMode('menu')
        setPendingDeliveryQuest(null)
      }
    }

    return (
      <div className="layout">
        <div className="t-xs t-dim t-center">{t('delivery.header', { station: translateStationName(q.targetStation) })}</div>
        <div className="px-box px-box--hi">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
            <div className="t-sm t-bright">{questTitle(q)}</div>
            <div className="tag t-xs tag--cyan">{q.type.toUpperCase()}</div>
          </div>
          <div className="t-xs" style={{ lineHeight: '2.2', marginBottom: '10px' }}>
            <TypewriterText text={scene.desc} speed={16} />
          </div>
          {deliveryResult ? (
            <div className="t-xs t-green mt8">{deliveryResult}</div>
          ) : (
            <div className="col gap4">
              {scene.outcome === 'ambush' ? (
                <>
                  <button className="px-btn px-btn--danger" onClick={() => resolveDelivery('proceed')}>
                    {t('delivery.deliverAnyway')}
                  </button>
                  <button className="px-btn" onClick={() => resolveDelivery('flee')}>
                    {t('delivery.turnBack')}
                  </button>
                </>
              ) : scene.outcome === 'negotiation' ? (
                <>
                  <button className="px-btn px-btn--primary" onClick={() => resolveDelivery('negotiate')}>
                    {t('delivery.negotiate')}
                  </button>
                  <button className="px-btn px-btn--danger" onClick={() => {
                    patch({ reputation: gs.reputation - 5 })
                    resolveDelivery('proceed')
                  }}>
                    {t('delivery.imposeTerms')}
                  </button>
                  <button className="px-btn" onClick={() => resolveDelivery('flee')}>
                    {t('delivery.leaveComeBack')}
                  </button>
                </>
              ) : scene.outcome === 'tense' ? (
                <>
                  <button className="px-btn px-btn--primary" onClick={() => resolveDelivery('proceed')}>
                    {t('delivery.deliverDespite')}
                  </button>
                  <button className="px-btn" onClick={() => resolveDelivery('flee')}>
                    {t('delivery.turnBackSuspicious')}
                  </button>
                </>
              ) : (
                <button className="px-btn px-btn--primary" onClick={() => resolveDelivery('proceed')}>
                  {t('delivery.complete', { credits: q.creditReward.toLocaleString(), rep: q.repReward })}
                </button>
              )}
            </div>
          )}
        </div>
        <button className="px-btn" onClick={() => { setMode('menu'); setPendingDeliveryQuest(null); setDeliveryResult(null) }}>{t('delivery.backToHub')}</button>
      </div>
    )
  }

  if (mode === 'quest-offer') {
    return (
      <QuestOfferPanel
        gs={gs}
        questOffer={questOffer}
        addQuest={addQuest}
        rerollsLeft={questRerollsLeft}
        onReroll={rerollQuest}
        onReturn={() => setMode('menu')}
      />
    )
  }

  // ── NPC ENCOUNTER ─────────────────────────────────────────────────────────

  if (mode === 'npc-encounter' && localNpc) {
    return (
      <NpcEncounterPanel
        gs={gs}
        localNpc={localNpc}
        npcDialogResult={npcDialogResult}
        onDialogResult={setNpcDialogResult}
        onCardGame={() => setMode('card-game')}
        onBack={() => { setMode('menu'); setNpcDialogResult(null) }}
        patch={patch}
        startCombat={startCombat}
        advanceMajorQuests={advanceMajorQuests}
        spendAction={spendAction}
      />
    )
  }

  // ── CHERCHER DU CARBURANT ─────────────────────────────────────────────────

  function generateDealConditions(): DealCondition[] {
    const pool: DealCondition[] = []
    const creditCost = (Math.floor(Math.random() * 8) + 4) * 100

    pool.push({
      id: 'credits',
      label: t('fuelScavenge.payCredits', { amount: creditCost.toLocaleString() }),
      desc: t('fuelScavenge.payCreditsDesc'),
      fuelAmount: 2,
      available: gs.credits >= creditCost,
      whyNot: gs.credits < creditCost ? t('fuelScavenge.payCreditsMissing', { amount: (creditCost - gs.credits).toLocaleString() }) : undefined,
      accept: () => {
        patch({ credits: gs.credits - creditCost, fuel: Math.min(gs.maxFuel, gs.fuel + 2) })
        setFuelScavResult(t('fuelScavenge.payCreditsDeal', { amount: creditCost.toLocaleString() }))
        setDealConditions(null)
      },
    })

    if (Object.keys(gs.cargo).length > 0) {
      const cargoLabel = Object.entries(gs.cargo).map(([k, v]) => `${translateGood(k)} ×${v}`).join(', ')
      pool.push({
        id: 'cargo',
        label: t('fuelScavenge.emptyCargo'),
        desc: t('fuelScavenge.emptyCargoDesc', { cargo: cargoLabel }),
        fuelAmount: 3,
        available: true,
        accept: () => {
          patch({ cargo: {}, fuel: Math.min(gs.maxFuel, gs.fuel + 3) })
          setFuelScavResult(t('fuelScavenge.emptyCargoDeal'))
          setDealConditions(null)
        },
      })
    }

    pool.push({
      id: 'favor_sexual',
      label: t('fuelScavenge.personalFavor'),
      desc: t('fuelScavenge.personalFavorDesc'),
      fuelAmount: 2,
      available: true,
      accept: () => {
        patch({ fuel: Math.min(gs.maxFuel, gs.fuel + 2), reputation: gs.reputation - 5 })
        setFuelScavResult(t('fuelScavenge.personalFavorDeal'))
        setDealConditions(null)
      },
    })

    const scavengeableWeapons = gs.weapons.filter(w => (w.tier ?? 0) < 5)
    if (scavengeableWeapons.length > 0) {
      const w = scavengeableWeapons[scavengeableWeapons.length - 1]
      pool.push({
        id: 'weapon',
        label: t('fuelScavenge.giveWeapon', { weapon: translateWeaponName(w.name) }),
        desc: t('fuelScavenge.giveWeaponDesc'),
        fuelAmount: 2,
        available: true,
        accept: () => {
          const remaining = gs.weapons.filter(x => x !== w)
          patch({ weapons: remaining, equippedWeapon: gs.equippedWeapon === w ? null : gs.equippedWeapon, fuel: Math.min(gs.maxFuel, gs.fuel + 2) })
          setFuelScavResult(t('fuelScavenge.giveWeaponDeal', { weapon: translateWeaponName(w.name) }))
          setDealConditions(null)
        },
      })
    }

    if (gs.equippedArmor) {
      pool.push({
        id: 'armor',
        label: t('fuelScavenge.leaveArmor'),
        desc: t('fuelScavenge.leaveArmorDesc'),
        fuelAmount: 2,
        available: true,
        accept: () => {
          patch({ equippedArmor: null, fuel: Math.min(gs.maxFuel, gs.fuel + 2) })
          setFuelScavResult(t('fuelScavenge.leaveArmorDeal'))
          setDealConditions(null)
        },
      })
    }

    pool.push({
      id: 'humiliation',
      label: t('fuelScavenge.dirtyWork'),
      desc: t('fuelScavenge.dirtyWorkDesc'),
      fuelAmount: 1,
      available: true,
      accept: () => {
        patch({ fuel: Math.min(gs.maxFuel, gs.fuel + 1), reputation: gs.reputation - 8 })
        setFuelScavResult(t('fuelScavenge.dirtyWorkDeal'))
        setDealConditions(null)
      },
    })

    pool.push({
      id: 'intel',
      label: t('fuelScavenge.giveIntel'),
      desc: t('fuelScavenge.giveIntelDesc'),
      fuelAmount: 2,
      available: gs.reputation >= 10,
      whyNot: gs.reputation < 10 ? t('fuelScavenge.giveIntelWhyNot') : undefined,
      accept: () => {
        patch({ fuel: Math.min(gs.maxFuel, gs.fuel + 2), reputation: gs.reputation - 12 })
        setFuelScavResult(t('fuelScavenge.giveIntelDeal'))
        setDealConditions(null)
      },
    })

    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(pool.length, Math.floor(Math.random() * 2) + 2))
  }

  if (mode === 'fuel-scavenge') {
    const dangerTier = station.danger >= 2 ? 2 : 1

    if (dealConditions) {
      return (
        <div className="layout">
          <div className="t-xs t-red t-center">{t('fuelScavenge.negotiationHeader')}</div>
          <div className="px-box" style={{ borderColor: 'var(--cyan)' }}>
            <div className="t-sm t-bright mb8">{t('fuelScavenge.hisConditions')}</div>
            <div className="t-xs t-dim mb8" style={{ lineHeight: '2', fontStyle: 'italic' }}>
              {t('fuelScavenge.hisConditionsLine')}
            </div>
            <div className="col gap4">
              {dealConditions.map(c => (
                <button key={c.id} className="px-btn" disabled={!c.available}
                  style={{ borderColor: c.available ? 'var(--cyan)' : undefined, textAlign: 'left' }}
                  onClick={() => c.accept()}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="t-xs t-bright">{c.label}</span>
                    <span className="t-xs t-cyan">{t('fuelScavenge.fuelSuffix', { amount: c.fuelAmount })}</span>
                  </div>
                  <div className="t-xs t-dim" style={{ lineHeight: '1.8' }}>{c.desc}</div>
                  {!c.available && c.whyNot && <div className="t-xs t-red mt2">{c.whyNot}</div>}
                </button>
              ))}
            </div>
          </div>
          <button className="px-btn t-dim" onClick={() => setDealConditions(null)}>
            {t('fuelScavenge.refuseAll')}
          </button>
        </div>
      )
    }

    return (
      <div className="layout">
        <div className="t-xs t-red t-center">{t('fuelScavenge.criticalHeader')}</div>

        <div className="px-box" style={{ borderColor: 'var(--red)' }}>
          <div className="t-sm t-red mb8">{t('fuelScavenge.criticalTitle')}</div>
          <div className="t-xs mb8" style={{ lineHeight: '2.2' }}>
            <TypewriterText
              text={t('fuelScavenge.criticalDesc')}
              speed={16}
            />
          </div>

          {fuelScavResult
            ? (
              <div className="t-xs mt8" style={{ lineHeight: '2.2', color: 'var(--green)' }}>
                {fuelScavResult}
              </div>
            )
            : (
              <div className="col gap4">
                <button className="px-btn" style={{ borderColor: 'var(--orange)', color: 'var(--orange)' }}
                  onClick={() => {
                    const roll = Math.random()
                    if (roll < 0.45) {
                      const amount = Math.random() < 0.5 ? 1 : 2
                      patch({ fuel: Math.min(gs.maxFuel, gs.fuel + amount), reputation: gs.reputation - 3 })
                      setFuelScavResult(t('fuelScavenge.stealSuccess', { amount }))
                    } else if (roll < 0.65) {
                      patch({ reputation: gs.reputation - 8, pendingFuelReward: 2 })
                      startCombat(scaleEnemy(getEnemyByTier(dangerTier as 1|2|3), Math.floor(gs.day / 15)))
                    } else if (roll < 0.82) {
                      patch({ reputation: gs.reputation - 5 })
                      setFuelScavResult(t('fuelScavenge.alarmTriggered'))
                    } else {
                      const fine = Math.floor(Math.random() * 400 + 300)
                      patch({
                        isImprisoned: true,
                        prisonDaysLeft: 2,
                        reputation: gs.reputation - 20,
                        credits: Math.max(0, gs.credits - fine),
                        screen: 'prison',
                      })
                    }
                  }}>
                  {t('fuelScavenge.stealDiscreetly')}
                </button>

                <button className="px-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
                  onClick={() => setDealConditions(generateDealConditions())}>
                  {t('fuelScavenge.negotiateOption')}
                </button>

                <button className="px-btn px-btn--danger"
                  onClick={() => {
                    patch({ pendingFuelReward: 2 })
                    startCombat(scaleEnemy(getEnemyByTier(dangerTier as 1|2|3), Math.floor(gs.day / 15)))
                  }}>
                  {t('fuelScavenge.takeByForce')}
                </button>
              </div>
            )
          }
        </div>

        <button className="px-btn" onClick={() => { setFuelScavResult(null); setDealConditions(null); setMode('menu') }}>{t('fuelScavenge.back')}</button>
      </div>
    )
  }

  // ── MINI-JEUX ─────────────────────────────────────────────────────────────

  if (mode === 'negotiation') {
    if (negoResult) {
      const failed = negoResult.label === 'ÉCHEC'
      return (
        <div className="layout">
          <div className="t-xs t-dim t-center">{t('negoOutcome.header')}</div>
          <div className="px-box" style={{ borderColor: failed ? 'var(--red)' : 'var(--gold)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className={`t-sm ${failed ? 't-red' : 't-bright'}`}>{t('negoOutcome.result', { label: negoResult.label })}</div>
              <div className={`tag t-xs ${failed ? 'tag--red' : 'tag--gold'}`}>{negoResult.label}</div>
            </div>
            {failed
              ? <>
                  <div className="t-xs t-red">{t('negoOutcome.broken')}</div>
                  <div className="t-xs t-dim mt4">{t('negoOutcome.repLoss')}</div>
                </>
              : <div className="t-xs t-gold">{t('negoOutcome.success', { earned: negoResult.earned.toLocaleString() })}</div>
            }
          </div>
          <button className="px-btn px-btn--primary" onClick={() => {
            if (failed) {
              patch({ reputation: gs.reputation - 10 })
            } else {
              patch({ credits: gs.credits + negoResult.earned })
            }
            setNegoResult(null)
            setMode('menu')
          }}>{failed ? t('negoOutcome.leave') : t('negoOutcome.collect')}</button>
        </div>
      )
    }
    return (
      <ScenarioGame
        mode="negotiation"
        baseCredits={negotiationBase}
        onResult={(earned, label) => setNegoResult({ earned, label })}
      />
    )
  }

  if (mode === 'navigation-minigame') {
    if (navResult) {
      const dmg = navResult.shipDamage
      const bonus = navResult.bonusCredits
      return (
        <div className="layout">
          <div className="t-xs t-dim t-center">{t('navOutcome.header')}</div>
          <div className="px-box" style={{ borderColor: dmg === 0 ? 'var(--green)' : dmg <= 10 ? 'var(--gold)' : 'var(--red)' }}>
            <div className="t-sm t-bright mb4">{dmg === 0 ? t('navOutcome.perfect') : dmg <= 15 ? t('navOutcome.decent') : t('navOutcome.rough')}</div>
            {dmg > 0 && <div className="t-xs t-red">{t('navOutcome.damaged', { dmg })}</div>}
            {bonus > 0 && <div className="t-xs t-gold mt4">{t('navOutcome.bonus', { bonus: bonus.toLocaleString() })}</div>}
            {dmg === 0 && bonus === 0 && <div className="t-xs t-green">{t('navOutcome.noDamage')}</div>}
          </div>
          <button className="px-btn px-btn--primary" onClick={() => {
            const rawShipHp = gs.shipHp - dmg
            patch({
              ...(rawShipHp <= 0 ? resolveShipDown(gs) : { shipHp: rawShipHp }),
              credits: gs.credits + bonus,
            })
            setNavResult(null)
            setMode('menu')
          }}>{t('continueButton')}</button>
        </div>
      )
    }
    return <ScenarioGame mode="navigation" onResult={(shipDamage, bonusCredits) => setNavResult({ shipDamage, bonusCredits })} />
  }

  if (mode === 'customs') {
    if (customsResult) {
      const { confiscated, repChange } = customsResult
      return (
        <div className="layout">
          <div className="t-xs t-dim t-center">{t('customs.header')}</div>
          <div className="px-box" style={{ borderColor: confiscated.length > 0 ? 'var(--red)' : 'var(--green)' }}>
            <div className="t-sm t-bright mb4">
              {confiscated.length > 0 ? t('customs.contrabandDetected') : t('customs.cleanScan')}
            </div>
            {confiscated.length > 0 ? (
              <>
                <div className="t-xs t-red mb4">{t('customs.confiscatedItems', { items: confiscated.map(translateGood).join(', ') })}</div>
                <div className="t-xs t-dim">{t('customs.repChangeSeized', { value: repChange })}</div>
              </>
            ) : (
              <div className="t-xs t-green">{t('customs.nothingSuspicious', { value: repChange })}</div>
            )}
          </div>
          <button className="px-btn px-btn--primary" onClick={() => {
            const newCargo = { ...gs.cargo }
            confiscated.forEach(item => { delete newCargo[item] })
            patch({
              cargo: newCargo,
              reputation: gs.reputation + repChange,
            })
            setCustomsResult(null)
            setMode('menu')
          }}>{t('customs.continue')}</button>
        </div>
      )
    }
    return (
      <CustomsGame
        cargo={gs.cargo}
        maxHide={2 + (gs.shipModules?.soute ?? 0)}
        onResult={(confiscated, repChange) => setCustomsResult({ confiscated, repChange })}
      />
    )
  }

  // ── MENU PRINCIPAL ────────────────────────────────────────────────────────

  return (
    <div className="hub-layout" style={{ maxWidth: '1300px', margin: '0 auto', padding: '20px' }}>
    <div className="scanlines" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatusBar gs={gs} />

      {/* ── MODE CONQUÊTE (post-victoire) ──────────────────────────────────── */}
      {gs.conquestMode && (
        <div className="px-box" style={{ borderColor: 'var(--cyan)', background: 'rgba(0,20,30,0.5)' }}>
          <div className="t-xs" style={{ color: 'var(--cyan)', letterSpacing: '2px' }}>
            {t('conquestBanner')}
          </div>
        </div>
      )}

      {/* ── SITUATION D'ARRIVÉE (interactive — reste séparée) ──────────────── */}
      {arrivalSit && !arrivalResult && (
        <div className="px-box" style={{ borderColor: 'var(--orange)', background: 'rgba(20,10,0,0.7)' }}>
          <div className="t-xs mb4" style={{ color: 'var(--orange)', letterSpacing: '2px' }}>{t('arrival.header', { station: translateStationName(gs.currentStation).toUpperCase() })}</div>
          <div className="t-sm t-bright mb8">{arrivalSit.title}</div>
          <div className="t-xs" style={{ lineHeight: '2.2', marginBottom: '14px' }}>{arrivalSit.description}</div>
          <div className="col gap4">
            {arrivalSit.choices.map((c, i) => {
              const avail = c.available ? c.available(gs) : true
              return (
                <button key={i} className="px-btn" disabled={!avail}
                  style={{ borderColor: avail ? 'var(--orange)' : undefined, textAlign: 'left' }}
                  onClick={() => {
                    const result = c.result(gs)
                    patch({ ...result.gs, pendingArrival: false })
                    setArrivalResult(result.message)
                    if (result.triggerCombat) {
                      setArrivalSit(null)
                      const enemy = scaleEnemy(getEnemyForStation(gs.currentStation, gs.zoneDepth, gs.day), 0)
                      startCombat(enemy)
                    }
                    if (result.triggerPrison) {
                      setArrivalSit(null)
                      goTo('prison')
                    }
                  }}>
                  <span className="t-xs">{c.label}</span>
                  {!avail && <div className="t-xs t-dim mt2">{t('arrival.conditionNotMet')}</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {arrivalResult && (
        <div className="px-box" style={{ borderColor: 'var(--dim)' }}>
          <div className="t-xs t-dim mb4">{t('arrivalResultHeader')}</div>
          <div className="t-xs">{arrivalResult}</div>
          <button className="px-btn px-btn--sm mt8" style={{ width: 'auto' }} onClick={() => { setArrivalSit(null); setArrivalResult(null) }}>
            {t('continueArrow')}
          </button>
        </div>
      )}

      {/* ── VISITE PRIVÉE D'UN DÉTENTEUR (vol par réputation) ───────────────── */}
      {bossVisit && !arrivalSit && (
        <div className="px-box" style={{ borderColor: 'var(--purple)', background: 'rgba(20,0,30,0.6)' }}>
          <div className="t-xs mb4" style={{ color: 'var(--purple)', letterSpacing: '2px' }}>{t('bossVisitHeader', { name: translateEnemyName(bossVisit.bossName).toUpperCase() })}</div>
          {!bossVisitResult ? (
            <>
              <div className="t-xs mb8" style={{ lineHeight: '2.2' }}>{bossVisit.inviteLine}</div>
              <div className="t-xs t-dim mb8" style={{ lineHeight: '2.2', fontStyle: 'italic' }}>{bossVisit.tourLine}</div>
              <button className="px-btn" style={{ borderColor: 'var(--purple)', color: 'var(--purple)' }}
                onClick={() => {
                  const result = resolveBossHomeVisit(gs, bossVisit)
                  setBossVisitResult(result)
                  patch({ ...result.patch, pendingBossVisit: null })
                }}>
                {t('followBoss', { name: translateEnemyName(bossVisit.bossName) })}
              </button>
            </>
          ) : (
            <>
              <div className="t-xs mb8" style={{ lineHeight: '2.2', color: bossVisitResult.revealed ? 'var(--green)' : 'var(--text)' }}>
                {bossVisitResult.message}
              </div>
              <button className="px-btn px-btn--sm" style={{ width: 'auto', borderColor: 'var(--purple)', color: 'var(--purple)' }}
                onClick={() => {
                  if (bossVisitResult.revealed) {
                    collectNexusFragment(bossVisit.idx)
                    patch({ nexusPath: { ...gs.nexusPath, [bossVisit.idx]: 'steal' } })
                  }
                  setBossVisit(null)
                  setBossVisitResult(null)
                }}>
                {t('continueArrow')}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── BRIEFING UNIFIÉ — toutes les notifications d'arrivée en un bloc ── */}
      {!arrivalSit && !arrivalResult && !bossVisit && (gs.pendingDaySummary || worldEventPopup || chainEvent || travelMsg || questPopup || objPopup || gs.rayaneGambleOffer) ? (
        <div className="px-box" style={{ borderColor: 'var(--cyan)', background: 'rgba(0,0,0,0.5)' }}>
          <div className="t-xs mb8" style={{ color: 'var(--cyan)', letterSpacing: '2px' }}>◆ BRIEFING — JOUR {gs.day}</div>

          {gs.pendingDaySummary && (
            <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-dim)' }}>
              <div className="t-xs t-dim" style={{ letterSpacing: '1px' }}>JOUR {gs.pendingDaySummary.prevDay} TERMINÉ</div>
              <div className="t-xs t-bright mt2">
                {gs.pendingDaySummary.actionsUsed >= 3
                  ? t('daySummary.fullDay')
                  : gs.pendingDaySummary.actionsUsed > 0
                  ? t('daySummary.partialDay', { used: gs.pendingDaySummary.actionsUsed, station: translateStationName(gs.pendingDaySummary.station) })
                  : t('daySummary.noAction', { station: translateStationName(gs.pendingDaySummary.station) })}
              </div>
            </div>
          )}

          {worldEventPopup && (
            <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-dim)' }}>
              <div className="t-xs" style={{ color: worldEventPopup.color, letterSpacing: '1px' }}>⚠ {worldEventPopup.title}</div>
              <div className="t-xs mt2" style={{ lineHeight: '1.8' }}>{worldEventPopup.shortDesc}</div>
              <div className="t-xs t-dim mt2">{t('worldEventDuration', { duration: worldEventPopup.duration, start: worldEventPopup.startDay, end: worldEventPopup.startDay + worldEventPopup.duration })}</div>
            </div>
          )}

          {chainEvent && (
            <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-dim)' }}>
              <div className="t-xs" style={{ color: chainEvent.color, letterSpacing: '1px' }}>
                {chainEvent.type === 'reward' ? '★' : chainEvent.type === 'threat' ? '⚠' : '◆'} {chainEvent.title}
              </div>
              <div className="t-xs mt2" style={{ lineHeight: '1.8' }}>{chainEvent.description}</div>
            </div>
          )}

          {travelMsg && (
            <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-dim)' }}>
              <div className="t-xs t-cyan" style={{ letterSpacing: '1px' }}>{t('travelEventLabel')}</div>
              <div className="t-xs mt2">{travelMsg}</div>
            </div>
          )}

          {questPopup && (
            <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-dim)' }}>
              <div className="t-xs t-green" style={{ letterSpacing: '1px' }}>{t('questAccomplished')}</div>
              {questPopup.split('\n\n').map((block, i) => {
                const lines = block.split('\n')
                return (
                  <div key={i} style={{ marginTop: '4px' }}>
                    <div className="t-xs t-bright">{lines[1]}</div>
                    <div className="t-xs t-green">{lines[2]}</div>
                  </div>
                )
              })}
            </div>
          )}

          {objPopup && (
            <div style={{ marginBottom: '10px' }}>
              <div className="t-xs t-gold">{objPopup}</div>
            </div>
          )}

          {!!gs.rayaneGambleOffer && (
            <div className="px-box" style={{ borderColor: 'var(--gold)', background: 'rgba(30,20,0,0.15)', marginBottom: '10px' }}>
              <div className="t-xs t-gold mb4" style={{ letterSpacing: '1px' }}>{t('rayaneHeader', { amount: gs.rayaneGambleOffer.toLocaleString() })}</div>
              <div className="t-xs t-dim mb8">{t('rayanePrompt')}</div>
              <div className="row gap8">
                <button className="px-btn px-btn--sm" style={{ width: 'auto', borderColor: 'var(--gold)', color: 'var(--gold)' }}
                  onClick={() => resolveRayaneGamble(true)}>
                  {t('rayanePlay')}
                </button>
                <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => resolveRayaneGamble(false)}>
                  {t('rayaneKeep')}
                </button>
              </div>
            </div>
          )}

          <button className="px-btn px-btn--sm" style={{ width: 'auto', borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
            onClick={() => {
              if (gs.pendingDaySummary) patch({ pendingDaySummary: null })
              if (worldEventPopup) dismissWorldEvent()
              if (chainEvent) dismissChain()
              if (travelMsg) dismissTravel()
              if (questPopup) dismissQuest()
              if (objPopup) dismissObj()
              if (gs.rayaneGambleOffer) resolveRayaneGamble(false)
            }}>
            {t('continueArrow')}
          </button>
        </div>
      ) : !arrivalSit && !arrivalResult && newArcsCount > 0 ? (
        <div className="px-box" style={{ borderColor: 'var(--purple)' }}>
          <div className="t-xs t-purple mb4">{t('newArcHeader', { titles: availableArcs.slice(0, newArcsCount).map(a => a.title).join(', ') })}</div>
          <button className="px-btn px-btn--sm" style={{ width: 'auto', color: 'var(--purple)' }}
            onClick={() => goTo('narrative-arcs')}>{t('viewArcs')}</button>
        </div>
      ) : null}

      {/* Outcomes combat */}
      {!arrivalSit && outcome === 'victory'  && <div className="px-box t-gold t-sm t-center">{t('outcomeVictory')}</div>}
      {!arrivalSit && outcome === 'fled'     && <div className="px-box t-dim t-sm t-center">{t('outcomeFled')}</div>}
      {!arrivalSit && outcome === 'stunned'  && <div className="px-box t-red t-sm t-center">{t('outcomeStunned')}</div>}
      {!arrivalSit && outcome === 'captured' && <div className="px-box t-red t-sm t-center">{t('outcomeCaptured')}</div>}

      {gs.isImprisoned && (
        <div className="px-box" style={{ borderColor: 'var(--red)' }}>
          <div className="t-xs t-red mb4">{t('imprisonedHeader')}</div>
          <button className="px-btn px-btn--danger px-btn--sm" onClick={() => goTo('prison')}>{t('manageImprisonment')}</button>
        </div>
      )}

      {/* Événements mondiaux actifs */}
      {getActiveEvents(gs).length > 0 && (
        <div className="col gap4">
          {getActiveEvents(gs).map(evt => (
            <div key={evt.id} className="px-box" style={{ borderColor: evt.color, padding: '6px 12px', background: 'rgba(0,0,0,0.35)' }}>
              <div className="row" style={{ alignItems: 'center', gap: '8px' }}>
                <span style={{ color: evt.color, fontSize: '9px', letterSpacing: '1px' }}>⚠ ÉVÉNEMENT MONDIAL — {evt.title}</span>
                <span className="t-xs t-dim" style={{ marginLeft: 'auto' }}>J{evt.startDay}–J{evt.startDay + evt.duration}</span>
              </div>
              <div className="t-xs t-dim" style={{ marginTop: '2px' }}>{evt.shortDesc}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── PRÉSENCE DU STALKER ────────────────────────────────────────────── */}
      {gs.stalker && (
        <div className="px-box" style={{ borderColor: 'var(--red)', background: 'rgba(180,0,0,0.07)', boxShadow: '0 0 12px rgba(255,40,40,0.15)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div className="t-xs t-red blink" style={{ letterSpacing: '3px' }}>⚠ {translateEnemyName(gs.stalker.name).toUpperCase()}</div>
            <div className="t-xs t-red">{'★'.repeat(gs.stalker.threatLevel)}</div>
          </div>
          <div className="t-xs" style={{ lineHeight: '2', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            {getStalkerPresenceText(gs.stalker)}
          </div>
          <button
            className="px-btn px-btn--danger px-btn--sm"
            style={{ width: 'auto', marginTop: '10px' }}
            onClick={() => { spendAction(); startCombat(stalkerToEnemy(gs.stalker!)) }}
            disabled={gs.actionsToday >= 3}
          >
            {t('confrontStalker')}
          </button>
        </div>
      )}

      {/* ── MODIFICATEURS DE RUN ───────────────────────────────────────────── */}
      {(gs.runModifiers ?? []).length > 0 && (() => {
        const mods = (gs.runModifiers ?? []).map(id => getRunModifiers().find(m => m.id === id)).filter(Boolean)
        const runObj = gs.runObjectiveId ? getRunObjective(gs.runObjectiveId) : null
        const TAG_COLOR: Record<string, string> = { buff: 'var(--green)', debuff: 'var(--red)', mixed: 'var(--gold)' }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {mods.map(mod => mod && (
                <div key={mod.id} className="tag t-xs" style={{ borderColor: TAG_COLOR[mod.tag], color: TAG_COLOR[mod.tag] }}
                  title={mod.desc}>
                  {mod.tag === 'buff' ? '▲' : mod.tag === 'debuff' ? '▼' : '◆'} {mod.name}
                </div>
              ))}
              {runObj && (
                <div className="tag t-xs" style={{
                  borderColor: gs.runObjectiveCompleted ? 'var(--gold)' : 'var(--purple)',
                  color: gs.runObjectiveCompleted ? 'var(--gold)' : 'var(--purple)',
                  marginLeft: 'auto',
                }} title={runObj.desc}>
                  {gs.runObjectiveCompleted ? '★' : '○'} {runObj.name} — {runObj.progress(gs)}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Station info */}
      <div className="px-box">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div className="t-lg t-bright">{translateStationName(station.name)}</div>
          <div className={`tag t-xs ${DANGER_CLS[station.danger]}`}>{DANGER_LABEL[station.danger]}</div>
        </div>
        <div className="t-xs t-dim" style={{ lineHeight: '2' }}>{station.description}</div>
        {(() => { const a = ambianceText; return a ? (
          <div className="t-xs t-dim mt8" style={{ lineHeight: '2.2', fontStyle: 'italic', borderLeft: '2px solid var(--border)', paddingLeft: '10px' }}>
            {a}
          </div>
        ) : null })()}
        <div className="t-xs t-dim mt4">
          {t('dayActionsLine', { day: gs.day, actions: gs.actionsToday })} <span style={{ color: gs.class.color }}>{translateClassName(gs.class.name)}</span>
          {gs.equippedWeapon && <> · <span className="t-orange">{translateWeaponName(gs.equippedWeapon.name)}</span></>}
          {gs.equippedArmor  && <> · <span style={{ color: 'var(--blue)' }}>{translateArmorName(gs.equippedArmor.name)}</span></>}
        </div>
        {/* Tracker Nexus permanent — révélé après la quête tutorielle */}
        {gs.nexusTrackerUnlocked === false ? (
          <div className="row mt4" style={{ gap: '6px', alignItems: 'center' }}>
            <span className="t-xs t-dim" style={{ fontStyle: 'italic' }}>
              {t('nexusTrackerTeaser')}
            </span>
          </div>
        ) : (
          <div className="row mt4" style={{ gap: '6px', alignItems: 'center' }}>
            {[0, 1, 2, 3].map(i => {
              const collected = (gs.nexusFragments ?? []).includes(i)
              return (
                <span key={i} style={{
                  fontSize: '16px',
                  color: collected ? 'var(--gold)' : 'var(--border)',
                  textShadow: collected ? '0 0 8px var(--gold)' : 'none',
                  transition: 'all 0.3s',
                }}>◈</span>
              )
            })}
            <span className="t-xs" style={{ color: (gs.nexusFragments?.length ?? 0) >= 4 ? 'var(--gold)' : 'var(--dim)' }}>
              {gs.nexusFragments?.length ?? 0}/4 Nexus
            </span>
            <span className="t-xs t-dim" style={{ marginLeft: '8px' }}>
              {(gs.discoveredLore ?? []).length}/{LORE_TOTAL} lore
            </span>
          </div>
        )}
      </div>

      {/* Alerte de station (world event) */}
      {(() => {
        const alert = gs.stationAlerts?.[gs.currentStation]
        if (!alert) return null
        const ALERT_CONFIG = {
          siege:    { label: t('alertConfig.siege.label'), color: 'var(--red)',    bg: 'rgba(180,0,0,0.12)',    desc: t('alertConfig.siege.desc') },
          lockdown: { label: t('alertConfig.lockdown.label'), color: 'var(--orange)', bg: 'rgba(180,90,0,0.12)',   desc: t('alertConfig.lockdown.desc') },
          epidemic: { label: t('alertConfig.epidemic.label'),      color: 'var(--green)',  bg: 'rgba(0,120,0,0.10)',    desc: t('alertConfig.epidemic.desc') },
          festival: { label: t('alertConfig.festival.label'),       color: 'var(--gold)',   bg: 'rgba(180,140,0,0.12)',  desc: t('alertConfig.festival.desc') },
        }
        const cfg = ALERT_CONFIG[alert]
        return (
          <div className="px-box" style={{ borderColor: cfg.color, background: cfg.bg }}>
            <div className="t-xs" style={{ color: cfg.color, letterSpacing: '1px' }}>{cfg.label}</div>
            <div className="t-xs t-dim" style={{ marginTop: '4px' }}>{cfg.desc}</div>
          </div>
        )
      })()}

      {/* Avertissement faction hostile */}
      {factionBlocked && (
        <div className="px-box" style={{ borderColor: 'var(--red)', background: 'rgba(180,0,0,0.12)' }}>
          <div className="t-xs" style={{ color: 'var(--red)', letterSpacing: '1px' }}>
            {t('hostileTerritory', { faction: blockedFactionName?.toUpperCase() })}
          </div>
          <div className="t-xs t-dim" style={{ marginTop: '4px' }}>
            {t('hostileTerritoryDesc')}
          </div>
        </div>
      )}

      {/* Tutoriel progressif jour 1 — T8 */}
      {(() => {
        // Phase 0 : premier jour, aucune action → 3 boutons max
        // Phase 1 : premier jour, 1 action → déverrouille traîner + voyager
        // Phase 2+ : tout déverrouillé
        const tutPhase = gs.day === 1
          ? gs.actionsToday === 0 ? 0 : gs.actionsToday === 1 ? 1 : 2
          : 3

        const HINTS = [
          { label: t('tutorial.step1Label'), text: t('tutorial.step1Text') },
          { label: t('tutorial.step2Label'), text: t('tutorial.step2Text') },
        ]
        const hint = tutPhase < 2 ? HINTS[tutPhase] : null

        return (
          <>
            {hint && (
              <div className="px-box" style={{ borderColor: 'var(--cyan)', opacity: 0.9 }}>
                <div className="t-xs t-cyan mb4">{hint.label}</div>
                <div className="t-xs t-dim" style={{ lineHeight: '2.2' }}>{hint.text}</div>
              </div>
            )}

            {/* Grille de menus */}
            <div className="grid2">
              <div className="px-box col" style={{ gap: '8px' }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('navigationHeader')}</span>
                  <button className="px-btn px-btn--sm" style={{ width: 'auto', fontSize: '8px', padding: '3px 8px', color: 'var(--cyan)', borderColor: 'var(--cyan)' }}
                    onClick={() => goTo('map')}>
                    {t('map')}
                  </button>
                </div>
                {tutPhase >= 1 && (
                  <button className="px-btn" onClick={() => goTo('travel')} disabled={gs.fuel <= 0}>
                    {gs.fuel <= 0 ? t('travelNoFuel') : t('travel', { fuel: gs.fuel })}
                  </button>
                )}
                {fuelCritical && reachableCount > 0 && !FUEL_STATIONS.has(gs.currentStation) && (
                  <div className="t-xs t-red" style={{ padding: '4px 8px', background: 'rgba(255,0,0,0.08)', border: '1px solid var(--red)' }}>
                    {t('fuelCritical', { count: reachableCount, plural: reachableCount > 1 ? 's' : '' })}
                  </div>
                )}
                {canScavengeFuel && (
                  <button className="px-btn px-btn--danger" onClick={() => { setFuelScavResult(null); setMode('fuel-scavenge') }}>
                    {gs.fuel <= 0
                      ? t('scavengeEmpty')
                      : fuelStranded
                        ? t('scavengeStranded')
                        : t('scavengeCritical')}
                  </button>
                )}
                <button className="px-btn" onClick={() => goTo('market')}>
                  {t('market')}
                </button>
                {/* Endetté : sa dette est son outil. Il lève des fonds quand
                    personne ne lui prêterait, au prix d'une saignée quotidienne. */}
                {gs.class.name === 'Endetté' && (gs.loansTaken ?? 0) < 3 && (
                  <button className="px-btn" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
                    onClick={() => patch({
                      credits: gs.credits + 5000,
                      debtDailyAmount: (gs.debtDailyAmount ?? gs.class.dailyDebt ?? 0) + 75,
                      loansTaken: (gs.loansTaken ?? 0) + 1,
                    })}>
                    {t('debtorLoan', { n: 3 - (gs.loansTaken ?? 0), debt: (gs.debtDailyAmount ?? gs.class.dailyDebt ?? 0) + 75 })}
                  </button>
                )}
                {tutPhase >= 2 && (
                  <button className="px-btn" onClick={() => goTo('crafting')} style={{ borderColor: 'var(--orange)', color: 'var(--orange)' }}>
                    {t('crafting')}
                  </button>
                )}
                {tutPhase >= 2 && (
                  <button className="px-btn" onClick={() => goTo('ship-workshop')}>
                    {t('shipWorkshop', { hp: gs.shipHp, maxHp: gs.shipMaxHp })}
                  </button>
                )}
              </div>

              <div className="px-box col" style={{ gap: '8px' }}>
                <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t('actionsHeader')}
                  <span style={{ display: 'flex', gap: '4px' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        display: 'inline-block', width: '10px', height: '10px',
                        transform: 'rotate(45deg)',
                        background: i < gs.actionsToday ? 'var(--red)' : 'var(--cyan)',
                        opacity: i < gs.actionsToday ? 0.4 : 1,
                        border: `1px solid ${i < gs.actionsToday ? 'var(--red)' : 'var(--cyan)'}`,
                      }} />
                    ))}
                  </span>
                  <span className="t-xs" style={{ color: gs.actionsToday >= 3 ? 'var(--red)' : 'var(--dim)' }}>
                    {t('actionsRemaining', { count: 3 - gs.actionsToday, plural: 3 - gs.actionsToday > 1 ? 's' : '' })}
                  </span>
                </div>
                {gs.actionsToday >= 3 && (
                  <div style={{ padding: '8px 12px', background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.3)', marginBottom: '4px' }}>
                    <div className="t-xs" style={{ color: '#ffd700' }}>{t('endOfDayBanner')}</div>
                  </div>
                )}
                <button className="px-btn" onClick={explore}>
                  {t('explore', { depth: gs.zoneDepth + 1 })}
                </button>
                {tutPhase >= 1 && (
                  <button className="px-btn" onClick={wander}>
                    {t('wander')}
                  </button>
                )}
                <button className="px-btn" onClick={lookForQuest}
                  disabled={factionBlocked}
                  style={factionBlocked ? { opacity: 0.4, cursor: 'not-allowed' } : (gs.pendingChainQuests ?? []).length > 0 ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined}>
                  {t('lookForQuest')}
                  {factionBlocked && <span className="t-xs" style={{ marginLeft: '8px', color: 'var(--red)' }}>{t('questRefused')}</span>}
                  {!factionBlocked && (gs.pendingChainQuests ?? []).length > 0 && <span className="t-xs" style={{ marginLeft: '8px', color: 'var(--gold)' }}>{t('chainAvailable')}</span>}
                </button>
                {tutPhase >= 1 && gs.activeQuests.length === 0 && gs.day <= 2 && (
                  <div className="t-xs t-dim" style={{ opacity: 0.6, lineHeight: 2, marginTop: '4px' }}>
                    {t('tutorialHint')}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* Événements spéciaux de station */}
      {stationEvts.length > 0 && (
        <div className="px-box" style={{ borderColor: 'var(--gold)' }}>
          <div className="t-xs t-gold mb8">{t('localActivities')}</div>
          <div className="col gap4">
            {stationEvts.map(ev => (
              <button key={ev.id} className="px-btn" onClick={() => openStationEvent(ev)}>
                {ev.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SOUS-BOSS ───────────────────────────────────────────────────── */}
      {(() => {
        const subBoss = getSubBossAtStation(gs, gs.currentStation)
        if (!subBoss) return null
        const defeated = gs.subBossesDefeated ?? {}
        const alreadyDone = isSubBossDefeated(defeated, subBoss.id)
        const progress = getSubBossProgress(defeated, subBoss.pillar)
        const pillarSubs = defeated[subBoss.pillar] ?? []
        const prevSubBoss = subBoss.order === 1 ? null : getSubBossesForPillar(subBoss.pillar, gs).find(sb => sb.order === subBoss.order - 1)
        const prevDone = subBoss.order === 1 || (prevSubBoss ? pillarSubs.includes(prevSubBoss.id) : true)
        const pName = subBoss.pillar.charAt(0).toUpperCase() + subBoss.pillar.slice(1)
        return (
          <div className="px-box" style={{ borderColor: alreadyDone ? 'var(--green)' : 'var(--red)', background: 'rgba(40,0,0,0.2)' }}>
            <div className="t-xs mb4" style={{ color: alreadyDone ? 'var(--green)' : 'var(--gold)', letterSpacing: '2px' }}>
              {t('lieutenant.header', { pillar: pName.toUpperCase(), done: progress.done, total: progress.total })}
            </div>
            <div className="t-sm t-bright mb4">{translateEnemyName(subBoss.name)}</div>
            <div className="t-xs t-dim mb4" style={{ lineHeight: 1.6 }}>{subBoss.personality}</div>
            <div className="t-xs mb4" style={{ color: 'var(--cyan)', lineHeight: 1.6 }}>« {subBoss.backstory.slice(0, 150)}... »</div>
            <div className="t-xs t-dim mb8">{t('lieutenant.mechanic', { mechanic: subBoss.combatMechanic })}</div>
            {alreadyDone ? (
              <div className="t-xs t-green">{t('lieutenant.defeated')}</div>
            ) : !prevDone ? (
              <div className="t-xs t-red">{t('lieutenant.orderRequired', { order: subBoss.order - 1, name: prevSubBoss ? translateEnemyName(prevSubBoss.name) : undefined, station: prevSubBoss?.station ? translateStationName(prevSubBoss.station) : undefined })}</div>
            ) : subBossResult ? (
              <div className="px-box" style={{ borderColor: subBossResult.success ? 'var(--green)' : 'var(--red)' }}>
                <div className="t-xs" style={{ color: subBossResult.success ? 'var(--green)' : 'var(--orange)', lineHeight: 2 }}>
                  {subBossResult.message}
                </div>
                <button className="px-btn px-btn--sm mt4" style={{ width: 'auto' }} onClick={() => setSubBossResult(null)}>{t('continueButton')}</button>
              </div>
            ) : (
              <div className="col gap4">
                <button className="px-btn" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                  onClick={() => startCombat(subBoss.enemy)}>
                  {t('lieutenant.confront', { name: translateEnemyName(subBoss.name) })}
                </button>
                {subBoss.resolutions.filter(a => a !== 'kill').map(action => {
                  const meta = getResolutionMeta()[action]
                  const check = canResolveSubBoss(gs, subBoss, action)
                  return (
                    <button key={action} className="px-btn" style={{ borderColor: 'var(--cyan)', textAlign: 'left' }}
                      disabled={!check.ok}
                      onClick={() => {
                        const res = resolveSubBoss(gs, subBoss, action)
                        patch(res.patch)
                        if (res.triggerCombat) {
                          startCombat(subBoss.enemy)
                        } else {
                          setSubBossResult({ message: res.message, success: res.success })
                        }
                      }}>
                      <div className="t-xs t-bright">{meta.icon} {meta.label}</div>
                      {/* Ce que le lieutenant demande, dans ses mots — sans ça,
                          les conditions ne sont qu'une liste de courses. */}
                      {action === 'service' && subBoss.service && (
                        <div className="t-xs mt4" style={{ lineHeight: 1.9, fontStyle: 'italic', color: 'var(--cyan)' }}>
                          « {subBoss.service.demand} »
                        </div>
                      )}
                      <div className="t-xs t-dim mt2">{check.ok ? check.hint : check.reason}</div>
                    </button>
                  )
                })}
                {/* Se dégager d'un marché en cours : possible, mais il ne
                    reproposera plus rien — seuls la force et l'argent resteront. */}
                {hasPact(gs, subBoss) && (
                  <button className="px-btn" style={{ borderColor: 'var(--red)', color: 'var(--red)', textAlign: 'left' }}
                    onClick={() => {
                      const res = breakPact(gs, subBoss)
                      patch(res.patch)
                      setSubBossResult({ message: res.message, success: false })
                    }}>
                    <div className="t-xs">{t('lieutenant.breakPact')}</div>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── INDICES ARC PERDU (PNJs) ──────────────────────────────────────── */}
      {(() => {
        const clues = getAvailableClues(gs)
        if (clues.length === 0) return null
        return (
          <div className="px-box" style={{ borderColor: 'var(--purple)', background: 'rgba(100,0,160,0.06)' }}>
            <div className="t-xs mb4" style={{ color: 'var(--purple)', letterSpacing: '2px' }}>{t('lostArcInformant')}</div>
            <div className="t-xs t-dim mb8" style={{ lineHeight: 1.8 }}>
              {t('cluesCollected', { count: (gs.arcPerduClues ?? []).length })}
            </div>
            {clueMsg && (
              <div className="px-box mb8" style={{ borderColor: clueUnlocked ? 'var(--gold)' : 'var(--purple)' }}>
                <div className="t-xs" style={{ color: clueUnlocked ? 'var(--gold)' : 'var(--purple)', lineHeight: 2 }}>{clueMsg}</div>
                <button className="px-btn px-btn--sm mt4" style={{ width: 'auto' }} onClick={() => setClueMsg(null)}>{t('ok')}</button>
              </div>
            )}
            {clues.map(clue => {
              const check = canCollectClue(gs, clue)
              return (
                <div key={clue.id} className="col gap4 mb8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                  <div className="t-sm" style={{ color: 'var(--purple)' }}>{clue.npcName}</div>
                  <div className="t-xs t-dim" style={{ lineHeight: 2, fontStyle: 'italic' }}>{clue.dialogue}</div>
                  {!check.ok && <div className="t-xs t-red">{check.reason}</div>}
                  <button
                    className="px-btn px-btn--sm"
                    style={{ borderColor: 'var(--purple)', color: 'var(--purple)', width: 'auto' }}
                    disabled={!check.ok}
                    onClick={() => {
                      const result = collectClue(gs, clue.id)
                      patch(result.gs)
                      setClueMsg(result.message)
                      setClueUnlocked(result.unlocked)
                    }}
                  >
                    {clue.requirement?.credits ? t('listen', { cost: clue.requirement.credits }) : t('listenFree')}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── QUÊTES D'ÉQUIPEMENT ──────────────────────────────────────────── */}
      {(() => {
        const eqQuests = getQuestsAtStation(gs.currentStation)
        if (eqQuests.length === 0) return null
        const available = eqQuests.filter(q => !(gs.completedEquipmentQuests ?? []).includes(q.id))
        if (available.length === 0) return null
        return (
          <div className="px-box" style={{ borderColor: 'var(--gold)', background: 'rgba(30,20,0,0.15)' }}>
            <div className="t-xs t-gold mb8" style={{ letterSpacing: '2px' }}>{t('equipmentQuestsHeader')}</div>
            <div className="col gap8">
              {available.map(q => {
                const check = canStartQuest(gs, q)
                const diffColors: Record<string, string> = { common: 'var(--text-dim)', rare: 'var(--cyan)', epic: 'var(--purple, #a855f7)', legendary: 'var(--gold)' }
                return (
                  <div key={q.id} className="col gap4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div className="t-sm" style={{ color: diffColors[q.difficulty] }}>{q.title}</div>
                      <div className="tag t-xs" style={{ color: diffColors[q.difficulty], borderColor: 'currentColor' }}>{q.difficulty.toUpperCase()}</div>
                    </div>
                    <div className="t-xs t-dim" style={{ lineHeight: 1.6 }}>{q.description}</div>
                    {!check.ok && (
                      <div className="t-xs t-red">{check.missing.join(' · ')}</div>
                    )}
                    <button className="px-btn px-btn--sm" style={{ width: 'auto', borderColor: diffColors[q.difficulty], color: diffColors[q.difficulty], opacity: check.ok ? 1 : 0.4 }}
                      disabled={!check.ok}
                      onClick={() => {
                        const result = completeQuest(gs, q)
                        patch(result)
                      }}>
                      {check.ok ? t('completeButton') : t('missingConditions')}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── SERVICE EXCLUSIF ──────────────────────────────────────────────── */}
      {station.specialService && (() => {
        const svc = station.specialService!
        const SERVICE_LABELS: Record<string, string> = {
          gambling:     t('serviceLabels.gambling'),
          implants:     t('serviceLabels.implants'),
          fuel_cheap:   t('serviceLabels.fuelCheap', { pct: Math.round((station.fuelDiscount ?? 0.35) * 100) }),
          weapon_forge: t('serviceLabels.weaponForge'),
          arena:        t('serviceLabels.arena'),
          rest_bonus:   t('serviceLabels.restBonus'),
        }
        return (
          <div className="px-box" style={{ borderColor: 'var(--gold)', background: 'rgba(30,20,0,0.3)' }}>
            <div className="t-xs t-gold mb8" style={{ letterSpacing: '2px' }}>★ {SERVICE_LABELS[svc]}</div>

            {/* GAMBLING */}
            {svc === 'gambling' && (
              specialResult
                ? <div className="col gap4">
                    <div className="t-xs" style={{ color: gambleWin ? 'var(--green)' : 'var(--red)', lineHeight: 2 }}>{specialResult}</div>
                    <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => setSpecialResult(null)}>{t('gambling.playAgain')}</button>
                  </div>
                : <div className="col gap4">
                    <div className="t-xs t-dim mb4" style={{ lineHeight: 2 }}>{t('gambling.odds')}</div>
                    <div className="row gap4">
                      {([100, 500, 1000] as const).map(bet => (
                        <button key={bet} className="px-btn" style={{ flex: 1, opacity: gs.credits < bet ? 0.4 : 1 }}
                          disabled={gs.credits < bet}
                          onClick={() => {
                            const win = Math.random() < 0.45
                            patch({ credits: win ? gs.credits + bet : gs.credits - bet })
                            setGambleWin(win)
                            setSpecialResult(win
                              ? t('gambling.win', { amount: bet.toLocaleString() })
                              : t('gambling.lose', { amount: bet.toLocaleString() }))
                          }}>
                          {t('gambling.bet', { amount: bet.toLocaleString() })}
                        </button>
                      ))}
                    </div>
                  </div>
            )}

            {/* IMPLANTS */}
            {svc === 'implants' && (() => {
              const bought = gs.implantsBought ?? []
              const IMPLANTS = [
                { id: 'hp',      label: t('implants.hp'),       cost: 800,  apply: (g: GameState): Partial<GameState> => ({ implantsBought: [...(g.implantsBought ?? []), 'hp'],      playerMaxHp: g.playerMaxHp + 25, playerHp: g.playerMaxHp + 25 }) },
                { id: 'stamina', label: t('implants.stamina'),  cost: 600,  apply: (g: GameState): Partial<GameState> => ({ implantsBought: [...(g.implantsBought ?? []), 'stamina'], maxStamina: g.maxStamina + 2,    stamina: g.maxStamina + 2 }) },
                { id: 'regen',   label: t('implants.regen'), cost: 500,  apply: (g: GameState): Partial<GameState> => ({ implantsBought: [...(g.implantsBought ?? []), 'regen'],   cargo: { ...g.cargo, 'Kit médical': (g.cargo['Kit médical'] ?? 0) + 5 } }) },
              ]
              return (
                <div className="col gap4">
                  {specialResult && <div className="t-xs t-green mb4">{specialResult}</div>}
                  {IMPLANTS.map(imp => {
                    const alreadyBought = bought.includes(imp.id)
                    const canAfford = gs.credits >= imp.cost
                    return (
                      <button key={imp.id} className="px-btn"
                        style={{ opacity: alreadyBought || !canAfford ? 0.4 : 1, color: alreadyBought ? undefined : 'var(--cyan)', borderColor: alreadyBought ? undefined : 'var(--cyan)' }}
                        disabled={alreadyBought || !canAfford}
                        onClick={() => {
                          patch({ ...imp.apply(gs), credits: gs.credits - imp.cost })
                          setSpecialResult(t('implants.installed', { label: imp.label }))
                        }}>
                        {imp.label}
                        <span className="t-dim" style={{ marginLeft: '8px', fontSize: '9px' }}>
                          {alreadyBought ? t('implants.alreadyInstalled') : `${imp.cost.toLocaleString()} cr`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* FUEL CHEAP */}
            {svc === 'fuel_cheap' && (() => {
              const basePrice = 240
              const disc = station.fuelDiscount ?? 0.35
              const price = Math.floor(basePrice * (1 - disc))
              const missing = gs.maxFuel - gs.fuel
              return specialResult
                ? <div className="t-xs t-green">{specialResult}</div>
                : <div className="col gap4">
                    <div className="t-xs t-dim mb4" style={{ lineHeight: 2 }}>
                      {t('fuelCheap.pitch')} <span style={{ color: 'var(--green)' }}>{price} cr/u</span>
                      <span className="t-dim" style={{ marginLeft: '6px', textDecoration: 'line-through', fontSize: '9px' }}>{basePrice} cr</span>
                    </div>
                    {missing === 0
                      ? <div className="t-xs t-dim">{t('fuelCheap.tankFull')}</div>
                      : [1, 2, 3].filter(n => n <= missing).map(qty => (
                          <button key={qty} className="px-btn"
                            style={{ opacity: gs.credits < price * qty ? 0.4 : 1, color: 'var(--green)', borderColor: 'var(--green)' }}
                            disabled={gs.credits < price * qty}
                            onClick={() => {
                              patch({ credits: gs.credits - price * qty, fuel: gs.fuel + qty })
                              setSpecialResult(t('fuelCheap.bought', { qty, cost: (price * qty).toLocaleString() }))
                            }}>
                            {t('fuelCheap.buy', { qty, cost: (price * qty).toLocaleString() })}
                          </button>
                        ))
                    }
                  </div>
            })()}

            {/* WEAPON FORGE */}
            {svc === 'weapon_forge' && (() => {
              const w = gs.equippedWeapon
              if (!w) return <div className="t-xs t-dim">{t('weaponForge.needWeapon')}</div>
              const alreadyUpgraded = w.name.includes('[+]')
              const cost = w.tier <= 2 ? 500 : 1200
              const canAfford = gs.credits >= cost
              return specialResult
                ? <div className="t-xs t-green">{specialResult}</div>
                : <div className="col gap4">
                    <div className="t-xs t-dim mb4" style={{ lineHeight: 2 }}>
                      {t('weaponForge.equippedPrefix')} <span className="t-bright">{translateWeaponName(w.name)}</span> {t('weaponForge.equippedSuffix', { min: w.damageMin, max: w.damageMax, tier: w.tier })}
                    </div>
                    <button className="px-btn"
                      style={{ opacity: alreadyUpgraded || !canAfford ? 0.4 : 1, color: 'var(--orange)', borderColor: 'var(--orange)' }}
                      disabled={alreadyUpgraded || !canAfford}
                      onClick={() => {
                        const upgraded: WeaponData = { ...w, name: w.name + ' [+]', damageMin: w.damageMin + 4, damageMax: w.damageMax + 6 }
                        patch({ credits: gs.credits - cost, equippedWeapon: upgraded, weapons: gs.weapons.map(x => x === w ? upgraded : x) })
                        setSpecialResult(t('weaponForge.upgraded', { name: translateWeaponName(w.name), cost: cost.toLocaleString() }))
}}>
                      {t('weaponForge.upgradeButton', { name: translateWeaponName(w.name), cost: cost.toLocaleString() })}
                      {alreadyUpgraded && <span className="t-dim" style={{ marginLeft: '8px', fontSize: '9px' }}>{t('weaponForge.alreadyUpgraded')}</span>}
                    </button>
                  </div>
            })()}

            {/* ARENA */}
            {svc === 'arena' && (
              specialResult
                ? <div className="col gap4">
                    <div className="t-xs t-green">{specialResult}</div>
                    <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => setSpecialResult(null)}>{t('arena.fightAgain')}</button>
                  </div>
                : <div className="col gap4">
                    <div className="t-xs t-dim mb4" style={{ lineHeight: 2 }}>{t('arena.pitch')}</div>
                    {([
                      { label: t('arena.qualification'), tier: 1 as const, note: t('arena.qualificationNote') },
                      { label: t('arena.prestige'),      tier: 2 as const, note: t('arena.prestigeNote') },
                      { label: t('arena.championship'),   tier: 3 as const, note: t('arena.championshipNote') },
                    ]).map(f => (
                      <button key={f.tier} className="px-btn"
                        style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                        onClick={() => {
                          spendAction()
                          const base = getEnemyByTier(f.tier)
                          startCombat({ ...base, lootMin: base.lootMin * 2, lootMax: base.lootMax * 2, description: t('arena.arenaPrefix') + base.description })
                        }}>
                        ⚔ {f.label}
                        <span className="t-dim" style={{ marginLeft: '8px', fontSize: '9px' }}>{f.note}</span>
                      </button>
                    ))}
                  </div>
            )}

            {/* REST BONUS */}
            {svc === 'rest_bonus' && (() => {
              const usedFree  = (gs.usedFreeRestStations ?? []).includes(gs.currentStation)
              const cost      = usedFree ? 200 : 0
              const alreadyFull = gs.playerHp >= gs.playerMaxHp && gs.stamina >= gs.maxStamina
              return specialResult
                ? <div className="t-xs t-green">{specialResult}</div>
                : factionBlocked
                ? <div className="t-xs" style={{ color: 'var(--red)', opacity: 0.7 }}>{t('restBonus.blockedAccess')} <span style={{ color: 'var(--red)' }}>{t('restBonus.accessDenied')}</span></div>
                : <div className="col gap4">
                    <div className="t-xs t-dim mb4" style={{ lineHeight: 2 }}>
                      {usedFree
                        ? t('restBonus.paidPitch', { cost })
                        : t('restBonus.freePitch')}
                    </div>
                    <button className="px-btn"
                      style={{ opacity: alreadyFull || (usedFree && gs.credits < cost) ? 0.4 : 1, color: 'var(--green)', borderColor: 'var(--green)' }}
                      disabled={alreadyFull || (usedFree && gs.credits < cost)}
                      onClick={() => {
                        patch({
                          playerHp: gs.playerMaxHp,
                          stamina: gs.maxStamina,
                          credits: usedFree ? gs.credits - cost : gs.credits,
                          usedFreeRestStations: usedFree
                            ? gs.usedFreeRestStations
                            : [...(gs.usedFreeRestStations ?? []), gs.currentStation],
                        })
                        setSpecialResult(t('restBonus.done', { hp: gs.playerMaxHp, maxHp: gs.playerMaxHp, stamina: gs.maxStamina, maxStamina: gs.maxStamina, cost: usedFree ? t('restBonus.doneCost', { cost }) : t('restBonus.doneFree') }))
                      }}>
                      {t('restBonus.restButton', { cost: cost > 0 ? t('restBonus.restButtonCost', { cost }) : t('restBonus.restButtonFree') })}
                    </button>
                    {alreadyFull && <div className="t-xs t-dim">{t('restBonus.alreadyFull')}</div>}
                  </div>
            })()}
          </div>
        )
      })()}

      {/* PNJ local */}
      {localNpc && (() => {
        const svc = getNpcService(localNpc.role)
        const npcState = gs.knownNpcs[localNpc.id]
        const serviceUsed = (npcState?.lastServiceDay ?? -1) === gs.day
        return (
          <div className="px-box" style={{ borderColor: 'var(--cyan)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div>
                <span className="t-sm t-bright">{localNpc.name}</span>
                <span className="t-xs t-dim" style={{ marginLeft: '8px' }}>{translateNpcRole(localNpc.role)}</span>
              </div>
              {svc && (
                <span className="t-xs" style={{ color: serviceUsed ? 'var(--text-dim)' : 'var(--cyan)', opacity: serviceUsed ? 0.5 : 1 }}>
                  {svc.label} — {svc.costText}
                </span>
              )}
            </div>
            <div className="t-xs t-dim mb8">{localNpc.description}</div>
            <button className="px-btn px-btn--sm" onClick={() => {
              setNpcDialogResult(null)
              setMode('npc-encounter')
            }}>
              › {svc ? t('viewNpc', { name: localNpc.name }) : t('talkToNpc', { name: localNpc.name })}
            </button>
          </div>
        )
      })()}

      <div className="grid2">
        <div className="col">
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{t('inventoryHeader')}</span>
            {(() => {
              const maxCargo = 15 + (gs.shipModules?.soute ?? 0) * 5
              const totalCargo = Object.values(gs.cargo).reduce((a, b) => a + b, 0)
              return (
                <span style={{ fontSize: '9px', letterSpacing: '1px', color: totalCargo >= maxCargo ? 'var(--red)' : 'var(--dim)' }}>
                  {t('cargoHold', { current: totalCargo, max: maxCargo, full: totalCargo >= maxCargo ? t('cargoHoldFull') : '' })}
                </span>
              )
            })()}
          </div>
          <button className="px-btn" onClick={() => goTo('inventory')} disabled={gs.weapons.length === 0 && gs.armors.length === 0}>
            {t('weaponsArmors', { weapons: gs.weapons.length, armors: gs.armors.length })}
          </button>
          {(gs.cargo['Médicaments'] ?? 0) > 0 && gs.playerHp < gs.playerMaxHp && (
            <button className="px-btn px-btn--green" onClick={() => {
              const qty = (gs.cargo['Médicaments'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Médicaments': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Médicaments']
              patch({ playerHp: Math.min(gs.playerMaxHp, gs.playerHp + 30), cargo: nc })
            }}>
              {t('healMed', { qty: gs.cargo['Médicaments'] })}
            </button>
          )}
          {(gs.cargo['Kit médical'] ?? 0) > 0 && gs.playerHp < gs.playerMaxHp && (
            <button className="px-btn" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => {
              const qty = (gs.cargo['Kit médical'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Kit médical': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Kit médical']
              patch({ playerHp: Math.min(gs.playerMaxHp, gs.playerHp + 30), cargo: nc })
            }}>
              {t('medKit', { qty: gs.cargo['Kit médical'] })}
            </button>
          )}
          {(gs.cargo['Kit médical premium'] ?? 0) > 0 && (gs.playerHp < gs.playerMaxHp || gs.stamina < gs.maxStamina) && (
            <button className="px-btn" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => {
              const qty = (gs.cargo['Kit médical premium'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Kit médical premium': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Kit médical premium']
              patch({ playerHp: Math.min(gs.playerMaxHp, gs.playerHp + 60), stamina: Math.min(gs.maxStamina, gs.stamina + 2), cargo: nc })
            }}>
              {t('medKitPremium', { qty: gs.cargo['Kit médical premium'] })}
            </button>
          )}
          {(gs.cargo['Stimulant'] ?? 0) > 0 && gs.stamina < gs.maxStamina && (
            <button className="px-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }} onClick={() => {
              const qty = (gs.cargo['Stimulant'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Stimulant': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Stimulant']
              patch({ stamina: Math.min(gs.maxStamina, gs.stamina + 3), cargo: nc })
            }}>
              {t('stimulant', { qty: gs.cargo['Stimulant'] })}
            </button>
          )}
          {/* Pièces techniques / Pièces de rechange → réparation vaisseau */}
          {(() => {
            const REPAIR = ['Pièces techniques', 'Pièces de rechange']
            const key = REPAIR.find(k => (gs.cargo[k] ?? 0) > 0)
            if (!key || gs.shipHp >= gs.shipMaxHp) return null
            return (
              <button className="px-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }} onClick={() => {
                const qty = (gs.cargo[key] ?? 1) - 1
                const nc = { ...gs.cargo, [key]: qty }
                if (qty <= 0) delete (nc as Record<string,number>)[key]
                patch({ shipHp: Math.min(gs.shipMaxHp, gs.shipHp + 5), cargo: nc })
              }}>
                {t('repairShip', { item: translateGood(key), hp: gs.shipHp, max: gs.shipMaxHp, qty: gs.cargo[key] })}
              </button>
            )
          })()}
          {/* Implants (cargo) → bonus HP max permanent — plafonné à 3 par run,
              sinon le corps ne suit plus (et c'était un bug : illimité avant). */}
          {(gs.cargo['Implants'] ?? 0) > 0 && (() => {
            const used = gs.cargoImplantsUsed ?? 0
            const capped = used >= 3
            return (
              <button className="px-btn" style={{ borderColor: 'var(--purple)', color: 'var(--purple)', opacity: capped ? 0.4 : 1 }}
                disabled={capped}
                onClick={() => {
                  const qty = (gs.cargo['Implants'] ?? 1) - 1
                  const nc = { ...gs.cargo, 'Implants': qty }
                  if (qty <= 0) delete (nc as Record<string,number>)['Implants']
                  patch({ playerMaxHp: gs.playerMaxHp + 15, playerHp: Math.min(gs.playerMaxHp + 15, gs.playerHp + 10), cargo: nc, cargoImplantsUsed: used + 1 })
                }}>
                {capped
                  ? t('cargoActions.implantCapped')
                  : t('cargoActions.implantUsed', { used, qty: gs.cargo['Implants'] })}
              </button>
            )
          })()}
          {/* Logiciels → effacer le contrôle douanier du jour */}
          {(gs.cargo['Logiciels'] ?? 0) > 0 && station.type === 'military' && (
            <button className="px-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }} onClick={() => {
              const qty = (gs.cargo['Logiciels'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Logiciels': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Logiciels']
              sessionStorage.setItem(`customs_${gs.currentStation}_${gs.day}`, '1')
              patch({ cargo: nc, pendingMessage: t('cargoActions.customsCleared') })
            }}>
              {t('clearCustomsScan', { qty: gs.cargo['Logiciels'] })}
            </button>
          )}
          {/* Or → pot-de-vin reputation */}
          {(gs.cargo['Or'] ?? 0) > 0 && (
            <button className="px-btn" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }} onClick={() => {
              const qty = (gs.cargo['Or'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Or': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Or']
              patch({ cargo: nc, reputation: gs.reputation + 15, pendingMessage: t('cargoActions.goldDistributed') })
            }}>
              {t('distributeGold', { qty: gs.cargo['Or'] })}
            </button>
          )}
          {/* Rations / Vivres → soin léger */}
          {(['Rations', 'Vivres'] as const).map(key => (gs.cargo[key] ?? 0) > 0 && gs.playerHp < gs.playerMaxHp && (
            <button key={key} className="px-btn px-btn--green" onClick={() => {
              const qty = (gs.cargo[key] ?? 1) - 1
              const nc = { ...gs.cargo, [key]: qty }
              if (qty <= 0) delete (nc as Record<string,number>)[key]
              patch({ playerHp: Math.min(gs.playerMaxHp, gs.playerHp + 10), cargo: nc })
            }}>
              {t('rationHeal', { item: translateGood(key), qty: gs.cargo[key] })}
            </button>
          ))}
          {/* Rations militaires → soin + stamina */}
          {(gs.cargo['Rations militaires'] ?? 0) > 0 && (gs.playerHp < gs.playerMaxHp || gs.stamina < gs.maxStamina) && (
            <button className="px-btn px-btn--green" onClick={() => {
              const qty = (gs.cargo['Rations militaires'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Rations militaires': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Rations militaires']
              patch({ playerHp: Math.min(gs.playerMaxHp, gs.playerHp + 15), stamina: Math.min(gs.maxStamina, gs.stamina + 1), cargo: nc })
            }}>
              {t('militaryRations', { qty: gs.cargo['Rations militaires'] })}
            </button>
          )}
          {/* Luxe → réputation */}
          {(gs.cargo['Luxe'] ?? 0) > 0 && (
            <button className="px-btn" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }} onClick={() => {
              const qty = (gs.cargo['Luxe'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Luxe': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Luxe']
              patch({ cargo: nc, reputation: gs.reputation + 10, pendingMessage: t('cargoActions.luxuryDistributed') })
            }}>
              {t('distributeLuxury', { qty: gs.cargo['Luxe'] })}
            </button>
          )}
          {/* Renseignements → réputation */}
          {(gs.cargo['Renseignements'] ?? 0) > 0 && (
            <button className="px-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }} onClick={() => {
              const qty = (gs.cargo['Renseignements'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Renseignements': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Renseignements']
              patch({ cargo: nc, reputation: gs.reputation + 12, pendingMessage: t('cargoActions.intelResold') })
            }}>
              {t('resellIntel', { qty: gs.cargo['Renseignements'] })}
            </button>
          )}
          {/* Intel faction → réputation faction locale */}
          {(gs.cargo['Intel faction'] ?? 0) > 0 && (() => {
            const localFaction = STATION_FACTION_CONTROL[gs.currentStation]
            if (!localFaction) return null
            return (
              <button className="px-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }} onClick={() => {
                const qty = (gs.cargo['Intel faction'] ?? 1) - 1
                const nc = { ...gs.cargo, 'Intel faction': qty }
                if (qty <= 0) delete (nc as Record<string,number>)['Intel faction']
                patch({
                  cargo: nc,
                  factionReputation: { ...gs.factionReputation, [localFaction]: (gs.factionReputation?.[localFaction] ?? 0) + 20 },
                  pendingMessage: t('cargoActions.factionIntelResold', { faction: localFaction }),
                })
              }}>
                {t('resellFactionIntel', { faction: localFaction, qty: gs.cargo['Intel faction'] })}
              </button>
            )
          })()}
          {/* Informations monnayables / VIP → crédits */}
          {(['Informations monnayables', 'Informations VIP'] as const).map(key => {
            const qty = gs.cargo[key] ?? 0
            if (qty === 0) return null
            const gain = key === 'Informations VIP' ? 350 : 200
            return (
              <button key={key} className="px-btn" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => {
                const newQty = qty - 1
                const nc = { ...gs.cargo, [key]: newQty }
                if (newQty <= 0) delete (nc as Record<string,number>)[key]
                patch({ cargo: nc, credits: gs.credits + gain, pendingMessage: t('cargoActions.infoConverted', { item: translateGood(key), gain }) })
              }}>
                {t('sellInfo', { item: translateGood(key), gain, qty })}
              </button>
            )
          })}
          {/* Matériel de pillage → bonus +50% loot prochaine exploration */}
          {(gs.cargo['Matériel de pillage'] ?? 0) > 0 && !gs.pillageBonusActive && (
            <button className="px-btn" style={{ borderColor: 'var(--orange)', color: 'var(--orange)' }} onClick={() => {
              const qty = (gs.cargo['Matériel de pillage'] ?? 1) - 1
              const nc = { ...gs.cargo, 'Matériel de pillage': qty }
              if (qty <= 0) delete (nc as Record<string,number>)['Matériel de pillage']
              patch({ cargo: nc, pillageBonusActive: true, pendingMessage: t('pillageDeployed') })
            }}>
              {t('pillageGear', { qty: gs.cargo['Matériel de pillage'] })}
            </button>
          )}
          {gs.pillageBonusActive && (
            <div className="px-box" style={{ borderColor: 'var(--orange)', padding: '5px 10px' }}>
              <span className="t-xs" style={{ color: 'var(--orange)' }}>{t('pillageActive')}</span>
            </div>
          )}
        </div>

        <div className="col">
          <div className="section-header">{t('progressionHeader')}</div>
          <button className="px-btn" onClick={() => goTo('quests')} disabled={gs.activeQuests.length === 0}>
            {t('questsButton', { count: gs.activeQuests.length })}
          </button>
          <button className="px-btn" onClick={() => goTo('objectives')}>
            {t('objectivesButton', { done: gs.completedObjectives.length, total: getObjectives().length })}
          </button>
          <div className="px-box" style={{ borderColor: 'var(--purple)', padding: '8px 12px', background: 'rgba(80,0,120,0.1)' }}>
            <div className="t-xs" style={{ color: 'var(--purple)' }}>
              {t('nexusFragmentsCount')} <span className="t-bright">{gs.stationPiecesRallied} / 4</span>
            </div>
          </div>
          <button className="px-btn" style={{ borderColor: 'var(--text-dim)', color: (gs.discoveredLore ?? []).length > 0 ? 'var(--cyan)' : 'var(--text-dim)' }}
            onClick={() => goTo('lore')}>
            {t('loreTitle')} {(gs.discoveredLore ?? []).length > 0 ? t('loreFragments', { count: gs.discoveredLore.length }) : t('loreEmpty')}
          </button>
          <button className="px-btn" style={{ borderColor: 'var(--text-dim)', color: (gs.journal ?? []).length > 0 ? 'var(--orange)' : 'var(--text-dim)' }}
            onClick={() => goTo('journal')}>
            {t('journalTitle')} {(gs.journal ?? []).length > 0 ? t('journalEntries', { count: gs.journal.length }) : t('journalEmpty')}
          </button>
          <button className="px-btn" onClick={() => goTo('factions')}>
            {t('factionsButton', { tag: gs.faction !== 'none' ? `[${gs.faction.toUpperCase()}]` : '' })}
          </button>
          {hasArcs && (
            <button className="px-btn" style={{ color: 'var(--purple)' }} onClick={() => goTo('narrative-arcs')}>
              {t('narrativeArcsButton', { count: gs.activeArcs.length, new: newArcsCount > 0 ? t('narrativeArcsNew', { count: newArcsCount }) : '' })}
            </button>
          )}
        </div>
      </div>

      {/* Résumé cargo */}
      {Object.keys(gs.cargo).length > 0 && (
        <div className="px-box">
          <div className="t-xs t-dim mb4">CARGAISON</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(gs.cargo).map(([item, qty]) => (
              <div key={item} className="tag tag--dim">{translateGood(item)} ×{qty}</div>
            ))}
          </div>
        </div>
      )}

      {/* Recommencer */}
      {confirmRestart ? (
        <div className="px-box" style={{ borderColor: 'var(--red)', background: 'rgba(40,0,0,0.3)' }}>
          <div className="t-xs t-red mb8">Abandonner cette run ? Toute progression sera perdue.</div>
          <div className="row gap4">
            <button className="px-btn px-btn--danger" style={{ flex: 1 }}
              onClick={() => useGameStore.getState().newGame()}>
              Confirmer — Nouvelle run
            </button>
            <button className="px-btn" style={{ flex: 1 }} onClick={() => setConfirmRestart(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button className="px-btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
          onClick={() => setConfirmRestart(true)}>
          {t('abandonRun')}
        </button>
      )}
    </div>

    {/* ── SIDEBAR QUÊTES ────────────────────────────────────────────────────── */}
    <div className="hub-sidebar">
      <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'var(--dim)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{t('questSidebar.header')}</span>
        <span style={{ color: 'var(--cyan)' }}>{gs.activeQuests.length + activePacts.length}</span>
      </div>
      {gs.activeQuests.length === 0 && activePacts.length === 0 && (
        <div style={{ fontSize: '9px', color: 'var(--dim)', fontStyle: 'italic', padding: '8px 0' }}>{t('questSidebar.noneActive')}</div>
      )}

      {/* Marchés passés avec des lieutenants : suivis comme des quêtes, avec le
          détail de ce qui manque encore et un rappel quand on est sur place. */}
      {activePacts.map(({ sb, progress }) => {
        const isHere = getSubBossStation(gs, sb) === gs.currentStation
        const borderCol = progress.done ? 'var(--green)' : isHere ? 'var(--gold)' : 'var(--purple)'
        return (
          <div key={sb.id}
            style={{ background: 'var(--bg-panel)', border: `2px solid ${borderCol}`, padding: '8px 10px', cursor: 'pointer' }}
            onClick={() => goTo('quests')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              <span style={{ fontSize: '8px', letterSpacing: '1px', color: 'var(--purple)' }}>{t('questSidebar.pactType')}</span>
              {progress.done && isHere && <span style={{ color: 'var(--green)', fontSize: '8px' }}>{t('questSidebar.pactReady')}</span>}
              {isHere && !progress.done && <span style={{ color: 'var(--gold)', fontSize: '8px' }}>{t('questSidebar.here')}</span>}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text)', lineHeight: '1.6', marginBottom: '2px' }}>
              {t('questSidebar.pactWith', { name: translateEnemyName(sb.name) })}
            </div>
            <div style={{ fontSize: '8px', color: 'var(--dim)' }}>→ {translateStationName(getSubBossStation(gs, sb))}</div>
            {!progress.done && (
              <div style={{ marginTop: '4px', borderLeft: '2px solid var(--purple)', paddingLeft: '6px', fontSize: '8px', color: 'var(--dim)', lineHeight: 1.6 }}>
                {progress.missing.join(' · ')}
              </div>
            )}
          </div>
        )
      })}
      {gs.activeQuests.map(q => {
        const isHere = q.targetStation === gs.currentStation
        const isDeliveryReady = isHere && (q.type === 'delivery' || q.type === 'heist') && !!q.targetItem && (gs.cargo[q.targetItem!] ?? 0) > 0
        const isPatrolHere = q.type === 'patrol' && isHere
        const patrolProg = q.progress ?? 0
        const isHov = hoveredQuest === q.id
        const borderCol = isDeliveryReady ? 'var(--green)' : isHere ? 'var(--gold)' : 'var(--border)'
        const typeCol = q.type === 'kill' || q.type === 'bounty' ? 'var(--red)' : q.type === 'patrol' ? 'var(--dim)' : isDeliveryReady ? 'var(--green)' : 'var(--cyan)'
        return (
          <div
            key={q.id}
            style={{ background: 'var(--bg-panel)', border: `2px solid ${borderCol}`, padding: '8px 10px', position: 'relative', cursor: 'pointer' }}
            onMouseEnter={() => setHoveredQuest(q.id)}
            onMouseLeave={() => setHoveredQuest(null)}
            onClick={() => goTo('quests')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              <span style={{ fontSize: '8px', letterSpacing: '1px', color: typeCol }}>{q.type.toUpperCase()}</span>
              {isHere && !isDeliveryReady && !isPatrolHere && <span style={{ color: 'var(--gold)', fontSize: '8px' }}>{t('questSidebar.here')}</span>}
              {isDeliveryReady && <span style={{ color: 'var(--green)', fontSize: '8px' }}>{t('questSidebar.deliverTag')}</span>}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text)', lineHeight: '1.6', marginBottom: '2px' }}>{questTitle(q)}</div>
            <div style={{ fontSize: '8px', color: 'var(--dim)' }}>→ {translateStationName(q.targetStation)}</div>
            {isPatrolHere && patrolProg < 3 && (
              <div style={{ marginTop: '4px', borderLeft: '2px solid var(--cyan)', paddingLeft: '6px', fontSize: '8px', color: 'var(--dim)' }}>
                {t('questSidebar.patrolProgress', { progress: patrolProg })}
              </div>
            )}
            {isDeliveryReady && (
              <button className="px-btn px-btn--sm" style={{ marginTop: '6px', color: 'var(--green)', borderColor: 'var(--green)', fontSize: '8px', padding: '4px 8px' }}
                onClick={(e) => { e.stopPropagation(); setPendingDeliveryQuest(q); setDeliveryResult(null); setMode('delivery-event') }}>
                {t('questSidebar.deliverButton', { item: q.targetItem ? translateGood(q.targetItem) : q.targetItem })}
              </button>
            )}
            {isPatrolHere && patrolProg >= 3 && (
              <button className="px-btn px-btn--sm" style={{ marginTop: '6px', color: 'var(--gold)', borderColor: 'var(--gold)', fontSize: '8px', padding: '4px 8px' }}
                onClick={(e) => { e.stopPropagation(); manualCompleteQuest(q.id) }}>
                {t('questSidebar.finishPatrol')}
              </button>
            )}
            {isHov && (
              <div style={{ position: 'absolute', right: '104%', top: 0, width: '210px', background: 'var(--bg-panel2)', border: '2px solid var(--border-hi)', padding: '10px 12px', zIndex: 50, fontSize: '9px', lineHeight: '1.8', boxShadow: '2px 2px 0 var(--border-hi)' }}>
                <div style={{ color: 'var(--gold)', marginBottom: '6px' }}>{questTitle(q)}</div>
                <div style={{ color: 'var(--dim)', marginBottom: '6px', lineHeight: '1.6', fontSize: '8px' }}>{questDescription(q)}</div>
                <div style={{ color: 'var(--text)' }}>{t('questSidebar.giver')} <span style={{ color: 'var(--cyan)' }}>{q.giver}</span></div>
                <div style={{ color: 'var(--text)' }}>→ {translateStationName(q.targetStation)}</div>
                {q.targetItem && <div style={{ color: 'var(--cyan)' }}>{t('questSidebar.item', { item: translateGood(q.targetItem) })}</div>}
                <div style={{ color: 'var(--gold)', marginTop: '4px' }}>{t('questSidebar.reward', { credits: q.creditReward, rep: q.repReward })}</div>
                {q.dayMult && <div style={{ color: 'var(--orange)', marginTop: '2px' }}>{t('questSidebar.timeLimit')}</div>}
              </div>
            )}
          </div>
        )
      })}
      {/* Daily expenses */}
      {(() => {
        const breakdown = getDailyExpenseBreakdown(gs)
        const total = breakdown.reduce((s, b) => s + b.amount, 0)
        if (total <= 0) return null
        return (
          <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
            <div style={{ fontSize: '8px', letterSpacing: '2px', color: 'var(--red)', marginBottom: '4px' }}>{t('expensesPerDay', { total })}</div>
            {breakdown.map(b => (
              <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--dim)', lineHeight: 1.8 }}>
                <span>{b.label}</span>
                <span>−{b.amount}</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>

  </div>
  )
}
