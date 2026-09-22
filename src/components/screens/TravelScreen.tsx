import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { getAccessibleStations, getFuelCost, getStation, findPath, PEACEFUL_STATIONS, FUEL_DEPOTS, getFuelPrice, fuelPriceColor } from '../../data/stations'
import { getWorldEventFuelBonus, getClosedStations, getActiveEvents } from '../../engine/worldEvents'
import { getEnemyByTier, scaleEnemy } from '../../data/enemies'
import { AsteroidDodge } from '../minigames/AsteroidDodge'
import { resolveShipDown } from '../../engine/shipDamage'
import { translateGood, translateStationName } from '../../engine/goodsI18n'

function NextHops({ stationName, currentName }: { stationName: string; currentName: string }) {
  const { t } = useTranslation('travelScreen')
  const hops = getAccessibleStations(stationName).filter(s => s.name !== currentName)
  if (hops.length === 0) return null
  return (
    <div className="t-xs t-dim mt6" style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '6px' }}>
      <span style={{ color: 'var(--border-hi)', marginRight: '4px' }}>{t('connections')}</span>
      {hops.map((h, i) => (
        <span key={h.name}>
          {i > 0 && <span style={{ opacity: 0.4, margin: '0 4px' }}>·</span>}
          <span style={{ color: FUEL_DEPOTS.has(h.name) ? 'var(--green)' : 'var(--text-dim)' }}
            title={FUEL_DEPOTS.has(h.name) ? t('sellsFuel') : undefined}>
            {FUEL_DEPOTS.has(h.name) ? '⛽ ' : ''}{translateStationName(h.name)}
          </span>
          <span style={{ color: 'var(--cyan)', opacity: 0.7, marginLeft: '3px', fontSize: '9px' }}>{t('cost', { amount: getFuelCost(stationName, h.name) })}</span>
        </span>
      ))}
    </div>
  )
}

const DANGER_CLS   = ['danger-0', 'danger-1', 'danger-2', 'danger-3']

interface Pending { station: string; fuelCost: number; danger: number }

export function TravelScreen() {
  const { t } = useTranslation('travelScreen')
  const DANGER_LABEL = t('dangerLabels', { returnObjects: true }) as unknown as string[]
  const gs          = useGameStore(s => s.gs!)
  const travel      = useGameStore(s => s.travel)
  const patch       = useGameStore(s => s.patch)
  const goTo        = useGameStore(s => s.goTo)
  const setWaypoint = useGameStore(s => s.setWaypoint)
  const startCombat = useGameStore(s => s.startCombat)

  const [pending, setPending] = useState<Pending | null>(null)
  const accessible = getAccessibleStations(gs.currentStation).filter(s =>
    s.name !== "L'Arc Perdu" || gs.arcPerduUnlocked
  )

  const events = getActiveEvents(gs)
  const fuelBonus = getWorldEventFuelBonus(events)
  const closedByEvent = getClosedStations(events)

  const excludedStations = useMemo(() => {
    const ex = new Set(closedByEvent)
    if (!gs.arcPerduUnlocked) ex.add("L'Arc Perdu")
    if (gs.class.peacefulBan) for (const s of PEACEFUL_STATIONS) ex.add(s)
    return ex
  }, [closedByEvent, gs.arcPerduUnlocked, gs.class.peacefulBan])

  const waypoint     = gs.waypoint ?? null
  const waypointPath = useMemo(
    () => waypoint ? findPath(gs.currentStation, waypoint, excludedStations) : [],
    [gs.currentStation, waypoint, excludedStations]
  )
  const nextOnPath = waypointPath.length >= 2 ? waypointPath[1] : null

  // Mini-jeu astéroïdes — déclenché à 30%
  if (pending) {
    return (
      <AsteroidDodge
        dangerLevel={pending.danger}
        onResult={(shipDamage, creditBonus, engaged) => {
          // Appliquer les dégâts vaisseau / bonus
          if (shipDamage > 0) {
            const rawShipHp = gs.shipHp - shipDamage
            patch(rawShipHp <= 0 ? resolveShipDown(gs) : { shipHp: rawShipHp })
          }
          if (creditBonus > 0) patch({ credits: gs.credits + creditBonus })
          const dest = pending
          setPending(null)
          if (engaged) {
            // Le joueur a ouvert le feu : des pirates l'interceptent. Voyage avorté.
            const tier = Math.min(4, Math.max(1, dest.danger || 1)) as 1 | 2 | 3 | 4
            const pirate = scaleEnemy({ ...getEnemyByTier(tier), name: t('pirateInterceptor') }, Math.floor(gs.day / 15))
            startCombat(pirate)
          } else {
            travel(dest.station, dest.fuelCost)
          }
        }}
      />
    )
  }

  return (
    <div className="layout">
      <div className="row" style={{ alignItems: 'center', gap: '16px' }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>{t('back')}</button>
        <div className="t-sm t-bright">{t('title')}</div>
        <div className="t-xs t-dim">{t('fuel')} <span className="t-cyan">{gs.fuel}/{gs.maxFuel}</span></div>
      </div>

      {/* Bandeau de route planifiée */}
      {waypoint && waypointPath.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.4)', padding: '8px 12px' }}>
          <span style={{ fontSize: '9px', color: '#ffd700', letterSpacing: '1px', flexShrink: 0 }}>{t('route')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
            {waypointPath.map((name, i) => (
              <span key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  fontSize: '9px',
                  color: name === gs.currentStation ? 'var(--cyan)' : name === waypoint ? '#ffd700' : name === nextOnPath ? '#ffd700' : 'var(--dim)',
                  fontWeight: name === nextOnPath || name === waypoint ? 'bold' : 'normal',
                }}>
                  {translateStationName(name)}
                </span>
                {i < waypointPath.length - 1 && <span style={{ color: 'var(--border)', fontSize: '9px' }}>→</span>}
              </span>
            ))}
          </div>
          {waypointPath.length === 1 && waypoint === gs.currentStation && (
            <span style={{ fontSize: '8px', color: 'var(--green)' }}>{t('destinationReached')}</span>
          )}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '11px', padding: '0 4px', flexShrink: 0 }}
            onClick={() => setWaypoint(null)}
            title={t('clearRoute')}
          >✕</button>
        </div>
      )}

      {/* Événements mondiaux actifs */}
      {events.length > 0 && (
        <div className="col gap4" style={{ marginBottom: '4px' }}>
          {events.map(evt => (
            <div key={evt.id} className="px-box" style={{ borderColor: evt.color, background: 'rgba(0,0,0,0.4)', padding: '8px 12px' }}>
              <div className="row" style={{ alignItems: 'center', gap: '8px' }}>
                <span style={{ color: evt.color, fontSize: '9px', letterSpacing: '1px' }}>⚠ {evt.title}</span>
                <span className="t-xs t-dim" style={{ marginLeft: 'auto' }}>J{evt.startDay} → J{evt.startDay + evt.duration}</span>
              </div>
              <div className="t-xs t-dim" style={{ marginTop: '2px' }}>{evt.shortDesc}</div>
            </div>
          ))}
          {fuelBonus > 0 && (
            <div className="t-xs t-red" style={{ paddingLeft: '4px' }}>
              {t('fuelSurcharge', { amount: fuelBonus })}
            </div>
          )}
        </div>
      )}

      <div className="col gap4">
        {accessible.length === 0 && (
          <div className="px-box t-dim t-sm">{t('noDestination')}</div>
        )}
        {accessible.map(station => {
          const baseCost = getFuelCost(gs.currentStation, station.name)
          const cost = baseCost + fuelBonus
          const banned = gs.class.peacefulBan && PEACEFUL_STATIONS.has(station.name)
          const isClosed = closedByEvent.has(station.name)
          const canGo = cost <= gs.fuel && !banned && !isClosed

          // Hackeur voit les prix
          const priceHint = gs.class.seesPrices
            ? t('priceHint', { list: station.goods.slice(0, 2).map(translateGood).join(', ') })
            : ''

          function handleTravel() {
            // 30% de chance de déclencher le mini-jeu astéroïdes
            if (Math.random() < 0.30) {
              setPending({ station: station.name, fuelCost: cost, danger: station.danger })
            } else {
              travel(station.name, cost)
            }
          }

          const isNextOnPath = station.name === nextOnPath
          const isWaypoint   = station.name === waypoint

          return (
            <button key={station.name} className="px-btn" disabled={!canGo} onClick={handleTravel}
              style={isNextOnPath || isWaypoint ? { borderColor: '#ffd700', boxShadow: '0 0 8px rgba(255,215,0,0.25)' } : undefined}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="t-sm t-bright mb4">{translateStationName(station.name)}</div>
                  <div className="t-xs t-dim" style={{ lineHeight: '1.8', maxWidth: '500px' }}>
                    {station.description}
                  </div>
                  {priceHint && <div className="t-xs t-cyan mt4">{priceHint}</div>}
                </div>
                <div style={{ textAlign: 'right', minWidth: '110px' }}>
                  <div className={`t-xs ${DANGER_CLS[station.danger]}`}>{DANGER_LABEL[station.danger]}</div>
                  <div className="t-xs mt4" style={{ color: canGo ? 'var(--cyan)' : 'var(--red)' }}>
                    {cost} {t('fuelUnit')}{fuelBonus > 0 ? <span className="t-red"> (+{fuelBonus})</span> : ''}
                  </div>
                  {(() => {
                    const fp = getFuelPrice(station.name)
                    if (fp === null) return <div className="t-xs mt4 t-dim">{t('noFuelBadge')}</div>
                    if (FUEL_DEPOTS.has(station.name)) return <div className="t-xs mt4" style={{ color: 'var(--green)' }}>{t('sellsFuelBadge', { price: fp })}</div>
                    return <div className="t-xs mt4" style={{ color: fuelPriceColor(fp) }}>{t('fuelPriceBadge', { price: fp })}</div>
                  })()}
                  {banned && <div className="t-xs t-red mt4">{t('banned')}</div>}
                  {isClosed && <div className="t-xs t-red mt4">{t('blocked')}</div>}
                </div>
              </div>
              <div className="t-xs t-dim mt8">
                {station.goods.slice(0, 4).map(translateGood).join(' · ')}
              </div>
              {/* Badge route */}
              {isNextOnPath && <div style={{ fontSize: '8px', color: '#ffd700', marginTop: '4px', letterSpacing: '1px' }}>{t('nextStep')}</div>}
              {isWaypoint && !isNextOnPath && <div style={{ fontSize: '8px', color: '#ffd700', marginTop: '4px', letterSpacing: '1px' }}>{t('finalDestination')}</div>}
              {/* Quêtes actives vers cette station */}
              {gs.activeQuests.filter(q => q.targetStation === station.name).map(q => (
                <div key={q.id} className="t-xs t-gold mt4">{t('activeQuest', { title: q.title })}</div>
              ))}
              <NextHops stationName={station.name} currentName={gs.currentStation} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
