import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { questTitle } from '../../engine/questI18n'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { getStations, getAccessibleStations, PEACEFUL_STATIONS, findPath, getFuelCost, FUEL_STATIONS } from '../../data/stations'
import { STATION_POSITIONS } from '../../data/stationPositions'
import { STATION_FACTION_CONTROL } from '../../engine/factionRep'
import { getClosedStations, getWorldEventFuelBonus, getActiveEvents } from '../../engine/worldEvents'
import { translateGood, translateStationName } from '../../engine/goodsI18n'

const TYPE_COLORS: Record<string, string> = {
  peaceful:    '#40ff80',
  military:    '#4488ff',
  dangerous:   '#ff4444',
  ruins:       '#a040ff',
  scientific:  '#40d0ff',
  luxury:      '#ffd700',
  industrial:  '#ff8040',
}

const FACTION_COLORS: Record<string, string> = {
  cesarion:   '#ffd700',
  raphazarus: '#a040ff',
  alanossa:   '#ff4444',
  scotty:     '#40ff80',
  eliotis:    '#40d0ff',
}

// Paires d'arêtes déduplicées à partir de fuelCostFrom
function buildEdges() {
  const seen = new Set<string>()
  const result: Array<{ from: string; to: string; cost: number }> = []
  for (const station of getStations()) {
    for (const [from, cost] of Object.entries(station.fuelCostFrom)) {
      const key = [from, station.name].sort().join('||')
      if (!seen.has(key) && STATION_POSITIONS[from] && STATION_POSITIONS[station.name]) {
        seen.add(key)
        result.push({ from, to: station.name, cost })
      }
    }
  }
  return result
}

const EDGES = buildEdges()

export function MapScreen() {
  const { t } = useTranslation('mapScreen')
  const dangerLabels = t('dangerLabels', { returnObjects: true }) as unknown as string[]
  const gs          = useGameStore(s => s.gs!)
  const goTo        = useGameStore(s => s.goTo)
  const setWaypoint = useGameStore(s => s.setWaypoint)

  const [hovered, setHovered]   = useState<string | null>(null)
  // Sélection par clic/tap — séparée du survol souris pour éviter une course avec
  // le mouseleave synthétique que les navigateurs génèrent après un tap tactile.
  const [selected, setSelected] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [pan, setPan]           = useState({ x: 0, y: 0 })
  const [zoom, setZoom]         = useState(0.9)
  const draggingRef             = useRef(false)
  const dragStartRef            = useRef({ x: 0, y: 0 })
  const panStartRef             = useRef({ x: 0, y: 0 })
  const svgRef                  = useRef<SVGSVGElement>(null)
  const didDragRef              = useRef(false)
  const pinchStartDistRef       = useRef(0)
  const pinchStartZoomRef       = useRef(1)

  // ── ORIENTATION MOBILE ─────────────────────────────────────────────────
  // La carte a besoin d'espace horizontal. Sur téléphone en portrait, on
  // bloque l'accès avec un écran "tourne ton téléphone" plutôt que d'afficher
  // une carte inutilisable. On tente aussi le vrai verrouillage d'orientation
  // là où le navigateur le permet (Android/Chrome, en plein écran) — mais ça
  // ne marche pas partout (Safari iOS ne le supporte pas du tout), donc le
  // repli visuel reste le mécanisme fiable.
  const isPortraitMobile = () =>
    window.innerWidth < 900 && window.innerHeight > window.innerWidth

  const [portraitBlocked, setPortraitBlocked] = useState(isPortraitMobile)

  useEffect(() => {
    const onResize = () => setPortraitBlocked(isPortraitMobile())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    // Passage en plein écran et verrouillage en paysage : utile sur un
    // téléphone, où la carte est illisible en portrait. Sur un ordinateur
    // c'est une agression — on s'y contentait de saisir tout l'écran sans
    // que personne ne l'ait demandé. On ne le tente donc que sur un appareil
    // tactile à petit écran, et on rend la main en quittant la carte.
    const estMobile = window.matchMedia?.('(pointer: coarse)').matches === true && window.innerWidth < 900
    let pleinEcranDemande = false

    const attemptLock = async () => {
      if (!estMobile) return
      try {
        const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
        const orientation = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } }).orientation
        if (el.requestFullscreen && !document.fullscreenElement) {
          await el.requestFullscreen()
          pleinEcranDemande = true
        }
        if (orientation?.lock) await orientation.lock('landscape')
      } catch {
        // Ignoré — le repli "tourne ton téléphone" prend le relais.
      }
    }
    attemptLock()

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      // On ne referme que ce que l’on a soi-même ouvert : si le joueur était
      // déjà en plein écran avant d’entrer, on ne lui reprend pas.
      const orientation = (screen as Screen & { orientation?: { unlock?: () => void } }).orientation
      try { orientation?.unlock?.() } catch { /* non supporté */ }
      if (pleinEcranDemande && document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => { /* ignoré */ })
      }
    }
  }, [])

  const events         = getActiveEvents(gs)
  const closedStations = new Set(getClosedStations(events))
  const fuelBonus      = getWorldEventFuelBonus(events)
  const questStations  = new Set(gs.activeQuests.map(q => q.targetStation))
  const accessibleNow  = new Set(getAccessibleStations(gs.currentStation).map(s => s.name))
  const bannedNow      = gs.class?.peacefulBan
    ? PEACEFUL_STATIONS
    : new Set<string>()

  const excludedStations = useMemo(() => {
    const ex = new Set(closedStations)
    if (!gs.arcPerduUnlocked) ex.add("L'Arc Perdu")
    for (const s of bannedNow) ex.add(s)
    return ex
  }, [closedStations, gs.arcPerduUnlocked, bannedNow])

  // Point de départ de l’itinéraire. Par défaut la position réelle, mais on
  // peut planifier depuis n’importe quelle station : préparer la suite du
  // trajet sans avoir à s’y rendre d’abord. C’est un outil de planification,
  // donc un état d’écran — rien à persister dans la partie.
  const [origine, setOrigine] = useState<string | null>(null)
  const [modeOrigine, setModeOrigine] = useState(false)
  const depart = origine ?? gs.currentStation

  const waypoint    = gs.waypoint ?? null

  // Voyager rend le départ planifié caduc : on repart de là où l’on est.
  useEffect(() => { setOrigine(null); setModeOrigine(false) }, [gs.currentStation])
  const waypointPath = useMemo(
    () => waypoint ? findPath(depart, waypoint, excludedStations) : [],
    [depart, waypoint, excludedStations]
  )
  const pathSet = new Set(waypointPath)
  // Coût cumulé du trajet : la vraie question quand on planifie, c’est
  // « est-ce que j’ai le carburant pour ça ».
  const coutTrajet = useMemo(
    () => waypointPath.slice(1).reduce((total, etape, i) => total + getFuelCost(waypointPath[i], etape) + fuelBonus, 0),
    [waypointPath, fuelBonus])

  // ── PAN / ZOOM ──────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.min(3, Math.max(0.4, z - e.deltaY * 0.001)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    draggingRef.current  = true
    didDragRef.current   = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    panStartRef.current  = { x: pan.x, y: pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
    if (!draggingRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDragRef.current = true
    setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy })
  }, [])

  const handleMouseUp = useCallback(() => { draggingRef.current = false }, [])

  // ── TACTILE (un doigt = pan + tap sélection, deux doigts = pincement zoom) ─
  const touchDist = (a: React.Touch, b: React.Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      draggingRef.current      = false
      pinchStartDistRef.current = touchDist(e.touches[0], e.touches[1])
      pinchStartZoomRef.current = zoom
      return
    }
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    draggingRef.current  = true
    didDragRef.current   = false
    dragStartRef.current = { x: t.clientX, y: t.clientY }
    panStartRef.current  = { x: pan.x, y: pan.y }
    setMousePos({ x: t.clientX, y: t.clientY })
  }, [pan, zoom])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      if (pinchStartDistRef.current > 0) {
        const ratio = touchDist(e.touches[0], e.touches[1]) / pinchStartDistRef.current
        setZoom(Math.min(3, Math.max(0.4, pinchStartZoomRef.current * ratio)))
      }
      didDragRef.current = true // évite qu'un pincement pose un waypoint en fin de geste
      return
    }
    if (e.touches.length !== 1 || !draggingRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - dragStartRef.current.x
    const dy = t.clientY - dragStartRef.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDragRef.current = true
    setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy })
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    pinchStartDistRef.current = 0
    if (e.touches.length === 1) {
      // Un doigt reste après un pincement à deux doigts — redémarre le pan proprement.
      const t = e.touches[0]
      draggingRef.current  = true
      dragStartRef.current = { x: t.clientX, y: t.clientY }
      panStartRef.current  = { x: pan.x, y: pan.y }
    } else if (e.touches.length === 0) {
      draggingRef.current = false
    }
  }, [pan])

  // ── TOOLTIP ─────────────────────────────────────────────────────────────

  const activeStationName = hovered ?? selected
  const hovStation = activeStationName ? getStations().find(s => s.name === activeStationName) ?? null : null

  // ── RENDER ──────────────────────────────────────────────────────────────

  if (portraitBlocked) {
    return (
      <div style={{
        width: '100%', height: '100vh', background: 'var(--bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '20px', padding: '20px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', animation: 'rotateHint 1.6s ease-in-out infinite' }}>📱</div>
        <style>{`@keyframes rotateHint { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(90deg); } }`}</style>
        <div style={{ fontSize: '11px', color: 'var(--text-bright)', letterSpacing: '1px' }}>{t('portraitBlock.title')}</div>
        <div style={{ fontSize: '9px', color: 'var(--dim)', lineHeight: '1.8', maxWidth: '280px' }}>
          {t('portraitBlock.desc')}
        </div>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>{t('back')}</button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '12px 20px', borderBottom: '2px solid var(--border)', flexShrink: 0 }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>{t('back')}</button>
        <span style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--dim)' }}>{t('title')}</span>
        <span style={{ fontSize: '9px', color: 'var(--cyan)', marginLeft: '8px' }}>{t('hint')}</span>
        {events.length > 0 && (
          <span style={{ fontSize: '8px', color: 'var(--orange)', marginLeft: 'auto', letterSpacing: '1px' }}>
            {t('eventsActive', { count: events.length, plural: events.length > 1 ? 'S' : '' })}
            {fuelBonus > 0 ? t('fuelBonus', { value: fuelBonus }) : ''}
          </span>
        )}
        {/* Point de départ de l’itinéraire */}
        <button
          className="px-btn px-btn--sm"
          style={{ width: 'auto', marginLeft: '8px',
            borderColor: modeOrigine ? 'var(--cyan)' : undefined,
            color: modeOrigine ? 'var(--cyan)' : undefined }}
          onClick={() => setModeOrigine(m => !m)}
        >
          {modeOrigine ? t('pickOrigin') : t('setOrigin')}
        </button>
        {origine && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(64,208,255,0.08)', border: '1px solid var(--cyan)', padding: '4px 10px' }}>
            <span style={{ fontSize: '9px', color: 'var(--cyan)', letterSpacing: '1px' }}>
              {t('routeFrom', { station: translateStationName(origine) })}
            </span>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '11px', padding: '0 2px', lineHeight: 1 }}
              onClick={() => setOrigine(null)}
              title={t('clearOrigin')}
            >✕</button>
          </div>
        )}
        {/* Waypoint actif */}
        {waypoint && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,215,0,0.08)', border: '1px solid #ffd700', padding: '4px 10px', marginLeft: '8px' }}>
            <span style={{ fontSize: '9px', color: '#ffd700', letterSpacing: '1px' }}>
              {t('routeTo', { station: translateStationName(waypoint) })}
              {waypointPath.length > 1 && (
                <span style={{ color: 'var(--dim)', marginLeft: '6px' }}>
                  {t('hops', { count: waypointPath.length - 1, plural: waypointPath.length - 1 > 1 ? 's' : '' })}
                  <span style={{ color: coutTrajet > gs.fuel ? 'var(--red)' : 'var(--green)', marginLeft: '6px' }}>
                    {t('routeFuel', { cost: coutTrajet })}
                  </span>
                </span>
              )}
              {waypoint && waypointPath.length === 0 && (
                <span style={{ color: 'var(--red)', marginLeft: '6px' }}>{t('noRoute')}</span>
              )}
            </span>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '11px', padding: '0 2px', lineHeight: 1 }}
              onClick={() => setWaypoint(null)}
              title={t('clearRoute')}
            >✕</button>
          </div>
        )}
        {/* Légende compacte */}
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {Object.entries(TYPE_COLORS).map(([t, c]) => (
            <span key={t} style={{ fontSize: '8px', color: c, letterSpacing: '1px' }}>● {t}</span>
          ))}
          <span style={{ fontSize: '8px', color: '#40ff80', letterSpacing: '1px' }}>{t('fuelLegend')}</span>
        </div>
      </div>

      {/* SVG Map */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', touchAction: 'none', cursor: draggingRef.current ? 'grabbing' : 'grab', userSelect: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (!didDragRef.current) setSelected(null) }}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

          {/* Grille de fond très subtile */}
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1a1a2a" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect x="-500" y="-500" width="2000" height="2000" fill="url(#grid)" />

          {/* ── ARÊTES ─────────────────────────────────────────────────────── */}
          {EDGES.map(({ from, to, cost }) => {
            const fp = STATION_POSITIONS[from]
            const tp = STATION_POSITIONS[to]
            if (!fp || !tp) return null
            if ((from === "L'Arc Perdu" || to === "L'Arc Perdu") && !gs.arcPerduUnlocked) return null

            const isCurrentEdge = from === gs.currentStation || to === gs.currentStation
            const otherStation  = from === gs.currentStation ? to : to === gs.currentStation ? from : null
            const isAccessible  = otherStation ? accessibleNow.has(otherStation) : false
            const isClosed      = closedStations.has(from) || closedStations.has(to)

            // Arête sur le chemin waypoint : les deux extrémités doivent être dans pathSet
            // et être consécutives dans waypointPath
            const fromIdx = waypointPath.indexOf(from)
            const toIdx   = waypointPath.indexOf(to)
            const isOnPath = fromIdx !== -1 && toIdx !== -1 && Math.abs(fromIdx - toIdx) === 1

            return (
              <g key={`${from}||${to}`}>
                <line
                  x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                  stroke={
                    isOnPath           ? '#ffd700'
                    : isClosed         ? '#440000'
                    : isCurrentEdge && isAccessible ? 'rgba(64,208,255,0.55)'
                    : isCurrentEdge    ? 'rgba(64,208,255,0.25)'
                    : 'rgba(58,58,106,0.55)'
                  }
                  strokeWidth={isOnPath ? 2.5 : isCurrentEdge && isAccessible ? 2 : 1}
                  strokeDasharray={isClosed ? '4 3' : undefined}
                  strokeOpacity={isOnPath ? 0.85 : 1}
                />
                {/* Coût carburant sur les arêtes accessibles depuis la station actuelle */}
                {isCurrentEdge && isAccessible && (
                  <text
                    x={(fp.x + tp.x) / 2} y={(fp.y + tp.y) / 2 - 4}
                    fontSize="8" fill="rgba(64,208,255,0.8)" textAnchor="middle"
                    style={{ fontFamily: 'monospace', pointerEvents: 'none' }}
                  >
                    {cost + fuelBonus}⛽
                  </text>
                )}
              </g>
            )
          })}

          {/* ── NŒUDS ──────────────────────────────────────────────────────── */}
          {getStations().map(station => {
            const pos     = STATION_POSITIONS[station.name]
            if (!pos) return null
            if (station.name === "L'Arc Perdu" && !gs.arcPerduUnlocked) return null

            const isCurrent   = station.name === gs.currentStation
            const isAccessible= accessibleNow.has(station.name)
            const isClosed    = closedStations.has(station.name)
            const isBanned    = bannedNow.has(station.name)
            const hasQuest    = questStations.has(station.name)
            const isHov       = hovered === station.name
            const factionKey  = STATION_FACTION_CONTROL[station.name]
            const factionCol  = factionKey ? FACTION_COLORS[factionKey] ?? null : null
            const typeCol     = TYPE_COLORS[station.type] ?? '#888'
            const r           = isCurrent ? 10 : isHov ? 9 : 7

            const isWaypoint  = station.name === waypoint
            const isOnPath    = pathSet.has(station.name) && !isCurrent

            return (
              <g
                key={station.name}
                style={{ cursor: isCurrent ? 'default' : 'pointer' }}
                onMouseEnter={() => setHovered(station.name)}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (didDragRef.current) return
                  // Tap/clic affiche toujours les infos — utile au tactile, qui n'a pas de survol.
                  setSelected(station.name)
                  if (modeOrigine) {
                    setOrigine(station.name === gs.currentStation ? null : station.name)
                    setModeOrigine(false)
                    return
                  }
                  if (!isCurrent) setWaypoint(isWaypoint ? null : station.name)
                }}
              >
                {/* Glow current */}
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={18} fill="none" stroke={typeCol} strokeWidth="1" opacity="0.3" />
                )}
                {/* Halo waypoint */}
                {isWaypoint && (
                  <circle cx={pos.x} cy={pos.y} r={r + 7} fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.9" />
                )}
                {/* Halo stations sur le chemin */}
                {isOnPath && !isWaypoint && (
                  <circle cx={pos.x} cy={pos.y} r={r + 5} fill="rgba(255,215,0,0.08)" stroke="#ffd700" strokeWidth="1" opacity="0.6" />
                )}
                {/* Ring quête */}
                {hasQuest && !isCurrent && !isWaypoint && (
                  <circle cx={pos.x} cy={pos.y} r={r + 4} fill="none" stroke="#ffd700" strokeWidth="1.5" strokeDasharray="3 2" />
                )}
                {/* Ring faction */}
                {factionCol && (
                  <circle cx={pos.x} cy={pos.y} r={r + 2} fill="none" stroke={factionCol} strokeWidth="1" opacity="0.7" />
                )}
                {/* Nœud principal */}
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={isClosed || isBanned ? '#1a1a2a' : typeCol}
                  fillOpacity={isClosed ? 0.3 : isBanned ? 0.25 : isAccessible ? 1 : 0.65}
                  stroke={isCurrent ? '#ffffff' : isHov ? typeCol : 'rgba(0,0,0,0.5)'}
                  strokeWidth={isCurrent ? 2.5 : isHov ? 1.5 : 1}
                />
                {/* Croix si fermé par événement */}
                {isClosed && (
                  <>
                    <line x1={pos.x - 5} y1={pos.y - 5} x2={pos.x + 5} y2={pos.y + 5} stroke="#ff4444" strokeWidth="1.5" />
                    <line x1={pos.x + 5} y1={pos.y - 5} x2={pos.x - 5} y2={pos.y + 5} stroke="#ff4444" strokeWidth="1.5" />
                  </>
                )}
                {/* Marqueur waypoint */}
                {isWaypoint && (
                  <text x={pos.x} y={pos.y - r - 4} fontSize="10" fill="#ffd700" textAnchor="middle" style={{ pointerEvents: 'none' }}>◎</text>
                )}
                {/* Numéro d'étape sur le chemin */}
                {isOnPath && !isWaypoint && (() => {
                  const step = waypointPath.indexOf(station.name)
                  return step > 0 ? (
                    <text x={pos.x + r + 1} y={pos.y - r + 1} fontSize="7" fill="#ffd700" textAnchor="middle" style={{ pointerEvents: 'none' }}>{step}</text>
                  ) : null
                })()}
                {/* Étoile quête */}
                {hasQuest && (
                  <text x={pos.x + r - 2} y={pos.y - r + 2} fontSize="8" fill="#ffd700" textAnchor="middle" style={{ pointerEvents: 'none' }}>★</text>
                )}
                {/* Pompe à carburant : station qui VEND du carburant */}
                {FUEL_STATIONS.has(station.name) && (
                  <text x={pos.x - r - 1} y={pos.y - r + 3} fontSize="8" textAnchor="middle" style={{ pointerEvents: 'none' }}>⛽</text>
                )}
                {/* Label station */}
                <text
                  x={pos.x} y={pos.y + r + 11}
                  fontSize={isCurrent ? 8 : 7}
                  fill={isCurrent ? '#ffffff' : isClosed || isBanned ? '#444' : isAccessible ? 'rgba(200,200,240,0.9)' : 'rgba(120,120,170,0.7)'}
                  textAnchor="middle"
                  style={{ fontFamily: 'monospace', pointerEvents: 'none', fontWeight: isCurrent ? 'bold' : 'normal' }}
                >
                  {(() => {
                    const label = translateStationName(station.name)
                    return label.length > 18 ? label.slice(0, 16) + '…' : label
                  })()}
                </text>
              </g>
            )
          })}

        </g>
      </svg>

      </div>

      {/* ── TOOLTIP ─────────────────────────────────────────────────────────── */}
      {hovStation && (
        <div style={{
          position: 'fixed',
          left: Math.min(mousePos.x + 14, window.innerWidth - 274),
          top: Math.max(8, Math.min(mousePos.y - 10, window.innerHeight - 200)),
          background: 'var(--bg-panel2)',
          border: `2px solid ${TYPE_COLORS[hovStation.type] ?? 'var(--border)'}`,
          padding: '10px 14px',
          zIndex: 200,
          maxWidth: '260px',
          pointerEvents: 'none',
          boxShadow: `0 0 12px ${TYPE_COLORS[hovStation.type] ?? 'transparent'}44`,
        }}>
          <div style={{ fontSize: '10px', color: TYPE_COLORS[hovStation.type], letterSpacing: '1px', marginBottom: '6px' }}>
            {translateStationName(hovStation.name)}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '8px', color: 'var(--dim)', border: '1px solid var(--border)', padding: '1px 5px' }}>
              {hovStation.type}
            </span>
            <span style={{ fontSize: '8px', color: ['#40ff80','#ffee40','#ff8040','#ff4444'][hovStation.danger] }}>
              {dangerLabels[hovStation.danger]}
            </span>
            {STATION_FACTION_CONTROL[hovStation.name] && (
              <span style={{ fontSize: '8px', color: FACTION_COLORS[STATION_FACTION_CONTROL[hovStation.name]] ?? 'var(--dim)', border: '1px solid currentColor', padding: '1px 5px' }}>
                {STATION_FACTION_CONTROL[hovStation.name]}
              </span>
            )}
          </div>
          {closedStations.has(hovStation.name) && (
            <div style={{ fontSize: '8px', color: 'var(--red)', marginBottom: '4px' }}>{t('tooltip.closedByEvent')}</div>
          )}
          {bannedNow.has(hovStation.name) && (
            <div style={{ fontSize: '8px', color: 'var(--red)', marginBottom: '4px' }}>{t('tooltip.accessBanned')}</div>
          )}
          {questStations.has(hovStation.name) && (
            <div style={{ fontSize: '8px', color: 'var(--gold)', marginBottom: '4px' }}>{t('tooltip.activeQuest')}</div>
          )}
          {accessibleNow.has(hovStation.name) && (
            <div style={{ fontSize: '8px', color: 'var(--cyan)', marginBottom: '4px' }}>
              {t('tooltip.fuelFromHere', { cost: (hovStation.fuelCostFrom[gs.currentStation] ?? 0) + fuelBonus })}
            </div>
          )}
          {FUEL_STATIONS.has(hovStation.name) && (
            <div style={{ fontSize: '8px', color: '#40ff80', marginBottom: '4px' }}>{t('tooltip.sellsFuel')}</div>
          )}
          {hovStation.goods.length > 0 && (
            <div style={{ fontSize: '8px', color: 'var(--dim)', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px' }}>
              {hovStation.goods.slice(0, 4).map(translateGood).join(' · ')}
            </div>
          )}
          {gs.activeQuests.filter(q => q.targetStation === hovStation.name).map(q => (
            <div key={q.id} style={{ fontSize: '8px', color: 'var(--gold)', marginTop: '4px' }}>★ {questTitle(q)}</div>
          ))}
        </div>
      )}

    </div>
  )
}
