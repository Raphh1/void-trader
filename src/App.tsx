import { useEffect, useState, lazy, Suspense } from 'react'
import { useGameStore } from './store/gameStore'
import { useMetaStore }  from './store/metaStore'
import { ClassSelect }          from './components/screens/ClassSelect'
import { StationHub }           from './components/screens/StationHub'
import { CombatScreen }         from './components/screens/CombatScreen'
import { TravelScreen }         from './components/screens/TravelScreen'
import { MarketScreen }         from './components/screens/MarketScreen'
import { InventoryScreen }      from './components/screens/InventoryScreen'
import { NarrativeArcsScreen }  from './components/screens/NarrativeArcsScreen'
import { CombatResultScreen }   from './components/screens/CombatResultScreen'
import { CombatOutcomeScreen }  from './components/screens/CombatOutcomeScreen'
import { StationArrivalScreen } from './components/screens/StationArrivalScreen'
import { MetaScreen }           from './components/screens/MetaScreen'
import { IntroScreen }          from './components/screens/IntroScreen'
import { CinematicIntro }       from './components/screens/CinematicIntro'

// Écrans secondaires : rarement ouverts et jamais dans la boucle de jeu
// principale (hub → marché/voyage → combat). Les charger à la demande allège
// le bundle initial sans faire clignoter les écrans qu'on enchaîne souvent.
const PrisonScreen        = lazy(() => import('./components/screens/PrisonScreen').then(m => ({ default: m.PrisonScreen })))
const FactionsScreen      = lazy(() => import('./components/screens/FactionsScreen').then(m => ({ default: m.FactionsScreen })))
const QuestsScreen        = lazy(() => import('./components/screens/QuestsScreen').then(m => ({ default: m.QuestsScreen })))
const ObjectivesScreen    = lazy(() => import('./components/screens/ObjectivesScreen').then(m => ({ default: m.ObjectivesScreen })))
const ShipWorkshopScreen  = lazy(() => import('./components/screens/ShipWorkshopScreen').then(m => ({ default: m.ShipWorkshopScreen })))
const CraftingScreen      = lazy(() => import('./components/screens/CraftingScreen').then(m => ({ default: m.CraftingScreen })))
const LoreScreen          = lazy(() => import('./components/screens/LoreScreen').then(m => ({ default: m.LoreScreen })))
const InterrogationScreen = lazy(() => import('./components/screens/InterrogationScreen').then(m => ({ default: m.InterrogationScreen })))
const NexusScreen         = lazy(() => import('./components/screens/NexusScreen').then(m => ({ default: m.NexusScreen })))
const JournalScreen       = lazy(() => import('./components/screens/JournalScreen').then(m => ({ default: m.JournalScreen })))
const EscortMiniGameScreen = lazy(() => import('./components/screens/EscortMiniGameScreen').then(m => ({ default: m.EscortMiniGameScreen })))
const MapScreen           = lazy(() => import('./components/screens/MapScreen').then(m => ({ default: m.MapScreen })))
import { getObjectives }        from './engine/objectives'
import { getMetaUnlocks }         from './data/metaUnlocks'
import { useTranslation }       from 'react-i18next'
import { LanguageToggle }       from './components/ui/LanguageToggle'

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3200)
    return () => clearTimeout(t)
  }, [message])
  return <div className="toast" onClick={onDismiss}>{message}</div>
}

function renderScreen(screen: string) {
  switch (screen) {
    case 'intro':          return <IntroScreen />
    case 'station-hub':    return <StationHub />
    case 'combat':         return <CombatScreen />
    case 'travel':         return <TravelScreen />
    case 'market':         return <MarketScreen />
    case 'inventory':      return <InventoryScreen />
    case 'prison':         return <PrisonScreen />
    case 'factions':       return <FactionsScreen />
    case 'quests':         return <QuestsScreen />
    case 'objectives':     return <ObjectivesScreen />
    case 'ship-workshop':  return <ShipWorkshopScreen />
    case 'narrative-arcs': return <NarrativeArcsScreen />
    case 'station-arrival':return <StationArrivalScreen />
    case 'combat-result':  return <CombatResultScreen />
    case 'combat-outcome': return <CombatOutcomeScreen />
    case 'crafting':       return <CraftingScreen />
    case 'lore':           return <LoreScreen />
    case 'interrogation':  return <InterrogationScreen />
    case 'nexus':          return <NexusScreen />
    case 'journal':        return <JournalScreen />
    case 'escort-minigame': return <EscortMiniGameScreen />
    case 'map':            return <MapScreen />
    default:               return <StationHub />
  }
}

export default function App() {
  const gs    = useGameStore(s => s.gs)
  const patch = useGameStore(s => s.patch)
  const [showMeta, setShowMeta]       = useState(false)
  const [showCinematic, setShowCinematic] = useState(
    () => !localStorage.getItem('vt_launched')
  )

  function handleCinematicDone() {
    localStorage.setItem('vt_launched', '1')
    setShowCinematic(false)
  }

  const langCorner = (
    <div style={{ position: 'fixed', top: '6px', right: '6px', zIndex: 500 }}>
      <LanguageToggle />
    </div>
  )

  if (showCinematic) return <CinematicIntro onDone={handleCinematicDone} />

  if (!gs) {
    return <><ClassSelect />{langCorner}</>
  }
  if (gs.isDead || gs.screen === 'game-over') return <><GameOver onMeta={() => setShowMeta(true)} showMeta={showMeta} onBackFromMeta={() => setShowMeta(false)} />{langCorner}</>
  if (gs.screen === 'victory') return <><Victory onMeta={() => setShowMeta(true)} showMeta={showMeta} onBackFromMeta={() => setShowMeta(false)} />{langCorner}</>

  return (
    <>
      <div key={gs.screen} className="screen-enter">
        <Suspense fallback={<div className="layout" />}>
          {renderScreen(gs.screen)}
        </Suspense>
      </div>
      {gs.pendingMessage && (
        <Toast message={gs.pendingMessage} onDismiss={() => patch({ pendingMessage: null })} />
      )}
      {langCorner}
    </>
  )
}

function RunStats({ gs }: { gs: ReturnType<typeof useGameStore.getState>['gs'] & object }) {
  const { t } = useTranslation()
  const completed = getObjectives().filter(o => gs.completedObjectives.includes(o.id))
  return (
    <>
      <div className="px-box mb8">
        <div className="t-xs t-dim mb8">{t('runStats.title')}</div>
        <div className="grid2" style={{ gap: '8px' }}>
          <StatLine label={t('runStats.daysSurvived')}     value={`${gs.day}`}                         color="var(--text)" />
          <StatLine label={t('runStats.finalCredits')}     value={`${gs.credits.toLocaleString()} cr`} color="var(--gold)" />
          <StatLine label={t('runStats.reputation')}       value={`${gs.reputation}`}                  color={gs.reputation >= 0 ? 'var(--green)' : 'var(--red)'} />
          <StatLine label={t('runStats.stationsVisited')}  value={`${gs.visitedStations.length}`}      color="var(--cyan)" />
          <StatLine label={t('runStats.combatsWon')}       value={`${gs.combatsWon}`}                  color="var(--green)" />
          <StatLine label={t('runStats.combatsFled')}      value={`${gs.combatsFled}`}                 color="var(--text-dim)" />
          <StatLine label={t('runStats.questsCompleted')}  value={`${gs.completedQuestIds.length}`}    color="var(--cyan)" />
          <StatLine label={t('runStats.bossesDefeated')}   value={`${gs.bossesDefeated}`}              color="var(--gold)" />
          <StatLine label={t('runStats.prisonEscapes')}    value={`${gs.prisonEscapes}`}               color="var(--orange)" />
          <StatLine label={t('runStats.class')}            value={gs.class.name}                       color={gs.class.color} />
        </div>
      </div>
      {completed.length > 0 && (
        <div className="px-box mb8">
          <div className="t-xs t-dim mb8">{t('runStats.objectivesCompleted', { count: completed.length })}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {completed.map(o => <div key={o.id} className="tag tag--gold t-xs">{o.name}</div>)}
          </div>
        </div>
      )}
      {gs.completedArcs.length > 0 && (
        <div className="px-box mb8">
          <div className="t-xs t-dim mb4">{t('runStats.arcsCompleted')}</div>
          {gs.completedArcs.map(id => (
            <div key={id} className="t-xs t-cyan" style={{ lineHeight: '2' }}>★ {id}</div>
          ))}
        </div>
      )}
    </>
  )
}

function PointsBadge() {
  const { t } = useTranslation()
  const pts = useMetaStore(s => s.availablePoints())
  if (pts === 0) return null
  return (
    <div className="t-xs" style={{ color: 'var(--purple)', marginBottom: '8px' }}>
      {t('legacyBadge', { count: pts, plural: pts > 1 ? 's' : '' })}
    </div>
  )
}

function NextUnlockBar() {
  const { t } = useTranslation()
  const meta = useMetaStore(s => s.meta)
  const earned = meta.totalPointsEarned
  const unlocked = meta.unlockedIds

  const next = getMetaUnlocks()
    .filter(u => !unlocked.includes(u.id) && (!u.requires || unlocked.includes(u.requires)))
    .sort((a, b) => a.cost - b.cost)[0]

  if (!next) return (
    <div className="px-box mb8" style={{ borderColor: 'var(--gold)', textAlign: 'center' }}>
      <div className="t-xs t-gold">{t('nextUnlock.allUnlocked')}</div>
    </div>
  )

  const pct = Math.min(100, Math.round((earned / next.cost) * 100))
  const remaining = Math.max(0, next.cost - earned)

  return (
    <div className="px-box mb8" style={{ borderColor: 'var(--purple)' }}>
      <div className="t-xs t-dim mb4">{t('nextUnlock.title')}</div>
      <div className="t-xs t-bright mb2">{next.name}</div>
      <div className="t-xs t-dim mb6" style={{ lineHeight: '1.8' }}>{next.description}</div>
      <div style={{ background: 'var(--border)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--purple)', transition: 'width 0.4s ease' }} />
      </div>
      <div className="t-xs t-dim">
        {earned}/{next.cost} points · {remaining > 0 ? t('nextUnlock.remaining', { count: remaining, plural: remaining > 1 ? 's' : '' }) : t('nextUnlock.available')}
      </div>
    </div>
  )
}

function GameOver({ onMeta, showMeta, onBackFromMeta }: { onMeta: () => void; showMeta: boolean; onBackFromMeta: () => void }) {
  const { t }   = useTranslation()
  const gs      = useGameStore(s => s.gs!)
  const newGame = useGameStore(s => s.newGame)
  if (showMeta) return <MetaScreen onBack={onBackFromMeta} />
  return (
    <div className="layout scanlines" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        <div className="px-box px-box--hi t-center mb8" style={{ borderColor: 'var(--red)' }}>
          <div className="t-xl t-red mb8">{t('gameOver.title')}</div>
          <div className="t-sm t-dim mb4">{gs.deathCause || t('gameOver.defaultCause')}</div>
          <div className="t-xs t-dim">{t('gameOver.footer')}</div>
        </div>
        <PointsBadge />
        <NextUnlockBar />
        <RunStats gs={gs} />
        <div className="row gap4">
          <button className="px-btn" style={{ flex: 1, borderColor: 'var(--purple)', color: 'var(--purple)' }} onClick={onMeta}>
            {t('buttons.legacy')}
          </button>
          <button className="px-btn px-btn--primary" style={{ flex: 2 }} onClick={newGame}>
            {t('buttons.newRun')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Victory({ onMeta, showMeta, onBackFromMeta }: { onMeta: () => void; showMeta: boolean; onBackFromMeta: () => void }) {
  const { t }             = useTranslation()
  const gs               = useGameStore(s => s.gs!)
  const newGame          = useGameStore(s => s.newGame)
  const continueConquest = useGameStore(s => s.continueConquest)
  if (showMeta) return <MetaScreen onBack={onBackFromMeta} />
  const [beforeLink, afterContinue] = t('victory.whatNextBody').split('{{continueLink}}')
  const [midText, afterObjectives] = (afterContinue ?? '').split('{{objectivesLink}}')
  return (
    <div className="layout scanlines" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        <div className="px-box px-box--hi t-center mb8" style={{ borderColor: 'var(--gold)' }}>
          <div className="t-xl mb8" style={{ color: 'var(--gold)' }}>{t('victory.title')}</div>
          <div className="t-sm t-dim mb4">{t('victory.subtitle')}</div>
          <div className="t-xs t-dim">{t('victory.footer')}</div>
        </div>

        {/* Continuation — la conquête spatiale */}
        <div className="px-box mb8" style={{ borderColor: 'var(--cyan)' }}>
          <div className="t-sm mb4" style={{ color: 'var(--cyan)' }}>{t('victory.whatNextTitle')}</div>
          <div className="t-xs t-dim" style={{ lineHeight: '2' }}>
            {beforeLink}
            <span className="t-cyan">{t('victory.continueLink')}</span>
            {midText}
            <span className="t-bright">{t('victory.objectivesLink')}</span>
            {afterObjectives}
          </div>
        </div>

        <PointsBadge />
        <NextUnlockBar />
        <RunStats gs={gs} />
        <button className="px-btn px-btn--primary mb8" onClick={continueConquest}
          style={{ width: '100%', borderColor: 'var(--cyan)', color: 'var(--cyan)' }}>
          {t('victory.continueConquest')}
        </button>
        <div className="row gap4">
          <button className="px-btn" style={{ flex: 1, borderColor: 'var(--purple)', color: 'var(--purple)' }} onClick={onMeta}>
            {t('buttons.legacy')}
          </button>
          <button className="px-btn" style={{ flex: 2 }} onClick={newGame}>
            {t('buttons.newRun')}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span className="t-xs t-dim">{label}</span>
      <span className="t-xs" style={{ color }}>{value}</span>
    </div>
  )
}
