// Animation de voyage : champ d'étoiles qui défile, le vaisseau file à
// l'horizontale, puis accélère d'un coup et sort de l'écran par la droite.
//
// Affichée en ouverture de l'écran d'arrivée (StationArrivalScreen). Les
// voyages qui tournent au combat n'y passent jamais : le mini-jeu d'esquive
// d'astéroïdes et les embuscades gardent leur propre écran.
//
// Une fois le vaisseau parti, le même champ d'étoiles reste en fond, au ralenti,
// derrière le nom et la description de la station.
import { useEffect, useRef } from 'react'
import { playWarp } from '../../engine/sfx'

export const CRUISE_MS = 1500   // croisière
export const BOOST_MS = 750     // accélération et sortie d'écran
export const FLASH_MS = 350     // éclair de saut
export const FLIGHT_MS = CRUISE_MS + BOOST_MS + FLASH_MS

interface Star { x: number; y: number; z: number }

interface Props {
  /** 'flight' : le vaisseau traverse puis onDone ; 'idle' : étoiles seules, lentes. */
  mode: 'flight' | 'idle'
  onDone?: () => void
}

const easeIn = (x: number) => x * x * x

export function WarpTransit({ mode, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shipRef = useRef<HTMLDivElement>(null)
  const flameRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let w = 0, h = 0
    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // z : profondeur (0.2 lointaine → 1 proche) — vitesse, taille et éclat en dépendent.
    const stars: Star[] = Array.from({ length: 220 }, () => ({ x: Math.random() * w, y: Math.random() * h, z: 0.2 + Math.random() * 0.8 }))
    const start = performance.now()
    let raf = 0
    let fini = false
    if (mode === 'flight' && !reduit) playWarp(CRUISE_MS, BOOST_MS)

    const frame = (now: number) => {
      const el = now - start
      // Vitesse de défilement (px/image pour une étoile proche)
      let speed = 1.2
      let boost = 0
      if (mode === 'flight') {
        if (el < CRUISE_MS) speed = 4
        else { boost = Math.min(1, (el - CRUISE_MS) / BOOST_MS); speed = 4 + easeIn(boost) * 90 }
      }

      ctx.fillStyle = mode === 'flight' ? 'rgba(4,6,14,0.55)' : 'rgba(4,6,14,0.9)'
      ctx.fillRect(0, 0, w, h)
      for (const s of stars) {
        const v = speed * s.z
        s.x -= v
        if (s.x < -80) { s.x = w + Math.random() * 60; s.y = Math.random() * h }
        const a = 0.35 + s.z * 0.65
        // Traînée proportionnelle à la vitesse : points en croisière, lignes en saut.
        const trail = Math.max(1, v * (boost > 0 ? 3.5 : 0.6))
        ctx.strokeStyle = `rgba(${200 + s.z * 55}, ${210 + s.z * 45}, 255, ${a})`
        ctx.lineWidth = s.z > 0.8 ? 2 : 1
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x + trail, s.y)
        ctx.stroke()
      }

      if (mode === 'flight' && shipRef.current) {
        const ship = shipRef.current
        // Croisière : léger roulis. Accélération : il file vers la droite et sort.
        const bob = Math.sin(el / 260) * 6
        const recul = boost > 0 && boost < 0.15 ? -boost * 120 : 0     // il se ramasse avant de bondir
        const x = 18 + easeIn(Math.max(0, boost - 0.1) / 0.9) * 120    // en % de la largeur
        ship.style.transform = `translate(calc(${x}vw + ${recul}px), ${boost > 0 ? bob * (1 - boost) : bob}px)`
        if (flameRef.current) {
          const flicker = 0.85 + Math.random() * 0.3
          flameRef.current.style.transform = `scaleX(${(1 + boost * 7) * flicker})`
          flameRef.current.style.opacity = String(0.7 + boost * 0.3)
        }
        if (flashRef.current) {
          const f = el - CRUISE_MS - BOOST_MS
          flashRef.current.style.opacity = f > 0 ? String(Math.max(0, 1 - f / FLASH_MS)) : '0'
        }
        if (el >= FLIGHT_MS && !fini) {
          fini = true
          doneRef.current?.()
          return
        }
      }
      raf = requestAnimationFrame(frame)
    }

    if (mode === 'flight' && reduit) {
      // Mouvement réduit : pas d'animation, on passe directement à l'arrivée.
      const tm = setTimeout(() => doneRef.current?.(), 300)
      return () => { clearTimeout(tm); window.removeEventListener('resize', resize) }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [mode])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, opacity: mode === 'idle' ? 0.55 : 1 }} />
      {mode === 'flight' && (
        <>
          <div ref={shipRef} className="warp-ship" style={{ position: 'absolute', left: 0, top: '46%' }}>
            <div ref={flameRef} className="warp-flame" />
            <svg width="112" height="44" viewBox="0 0 112 44" style={{ position: 'relative', display: 'block' }} aria-hidden>
              {/* Aile arrière */}
              <polygon points="18,4 46,16 46,28 18,40 26,22" fill="#3a4a6a" stroke="#8fb4ff" strokeWidth="1.5" />
              {/* Coque */}
              <polygon points="8,16 70,12 106,22 70,32 8,28" fill="#c9d4e8" stroke="#ffffff" strokeWidth="1.5" />
              <polygon points="8,20 70,18 104,22 70,26 8,24" fill="#9aa8c4" />
              {/* Cockpit */}
              <polygon points="62,15 84,19 84,25 62,29 58,22" fill="#4fd1ff" stroke="#bff0ff" strokeWidth="1" />
              {/* Réacteur */}
              <rect x="2" y="17" width="8" height="10" fill="#ff8c3a" />
            </svg>
          </div>
          <div ref={flashRef} style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 75% 50%, #ffffff, rgba(160,210,255,0.6) 40%, rgba(0,0,0,0) 75%)', opacity: 0 }} />
        </>
      )}
    </div>
  )
}
