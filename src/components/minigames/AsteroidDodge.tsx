import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const W = 320
const H = 420
const SHIP_W = 28
const SHIP_H = 16
const SHIP_Y = H - 50
const DURATION_MS = 15000

interface Asteroid {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  spin: number
  rot: number
  points: number[]  // offsets for rough polygon shape
}

interface EnemyShip {
  x: number
  y: number
  vx: number
  vy: number
  hp: number
}

interface Bullet {
  x: number
  y: number
  vy: number
}

interface Props {
  dangerLevel?: number  // 0-3
  // engaged = true si le joueur a abattu un vaisseau ennemi → combat pirate
  onResult: (shipDamage: number, creditBonus: number, engaged: boolean) => void
}

function makeAsteroidPoints(): number[] {
  const pts: number[] = []
  const sides = 7 + Math.floor(Math.random() * 4)
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const jitter = 0.6 + Math.random() * 0.4
    pts.push(Math.cos(angle) * jitter, Math.sin(angle) * jitter)
  }
  return pts
}

// Static star positions (deterministic to avoid flicker)
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 137 + 53) % W,
  y: (i * 97 + i * i * 7) % H,
  s: Math.random() < 0.15 ? 1.5 : 1,
}))

export function AsteroidDodge({ dangerLevel = 1, onResult }: Props) {
  const { t } = useTranslation('minigames')
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const shipXRef     = useRef(W / 2)
  const asteroidsRef = useRef<Asteroid[]>([])
  const enemiesRef   = useRef<EnemyShip[]>([])
  const bulletsRef   = useRef<Bullet[]>([])
  const hitsRef      = useRef(0)
  const killsRef     = useRef(0)      // vaisseaux ennemis abattus
  const engagedRef   = useRef(false)  // un ennemi a été touché → combat pirate
  const frameRef     = useRef<number>(0)
  const lastSpawnRef = useRef(0)
  const lastEnemyRef = useRef(0)
  const lastFireRef  = useRef(0)
  const startRef     = useRef(0)
  const keysRef      = useRef({ left: false, right: false, fire: false })
  const phaseRef     = useRef<'countdown' | 'playing' | 'done'>('countdown')
  const doneCalledRef = useRef(false)

  const [uiPhase, setUiPhase]   = useState<'countdown' | 'playing' | 'done'>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft]   = useState(15)
  const [hits, setHits]           = useState(0)
  const [kills, setKills]         = useState(0)

  // Flèches pour bouger, Espace pour tirer
  useEffect(() => {
    function dn(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); keysRef.current.left  = true }
      if (e.key === 'ArrowRight') { e.preventDefault(); keysRef.current.right = true }
      if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); keysRef.current.fire = true }
    }
    function up(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  keysRef.current.left  = false
      if (e.key === 'ArrowRight') keysRef.current.right = false
      if (e.key === ' ' || e.key === 'ArrowUp') keysRef.current.fire = false
    }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  // Countdown
  useEffect(() => {
    let n = 3
    const iv = setInterval(() => {
      n--
      if (n <= 0) {
        clearInterval(iv)
        phaseRef.current = 'playing'
        setUiPhase('playing')
        startRef.current = performance.now()
      } else {
        setCountdown(n)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const baseSpeed    = 2.4 + dangerLevel * 1.1
    const spawnMs      = Math.max(200, 900 - dangerLevel * 200)

    function spawnAsteroid(now: number) {
      if (now - lastSpawnRef.current < spawnMs) return
      lastSpawnRef.current = now
      const r  = 12 + Math.random() * 16 + dangerLevel * 3
      const x  = r + Math.random() * (W - r * 2)
      const vy = baseSpeed + Math.random() * 2.2
      const vx = (Math.random() - 0.5) * 1.4
      asteroidsRef.current.push({
        x, y: -r, r, vx, vy,
        spin: (Math.random() - 0.5) * 0.06,
        rot: Math.random() * Math.PI * 2,
        points: makeAsteroidPoints(),
      })
    }

    function checkHit(ast: Asteroid): boolean {
      const sx = shipXRef.current
      // Circle vs rect AABB
      const cx = Math.max(sx - SHIP_W / 2, Math.min(ast.x, sx + SHIP_W / 2))
      const cy = Math.max(SHIP_Y - SHIP_H / 2, Math.min(ast.y, SHIP_Y + SHIP_H / 2))
      const dx = ast.x - cx
      const dy = ast.y - cy
      return dx * dx + dy * dy < (ast.r - 2) * (ast.r - 2)
    }

    function drawShip(x: number, flash: boolean) {
      ctx.save()
      ctx.translate(x, SHIP_Y)
      // Thruster glow
      ctx.beginPath()
      ctx.ellipse(0, SHIP_H / 2 + 4, 5, 8 + Math.random() * 4, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(80, 200, 255, 0.35)'
      ctx.fill()
      // Hull
      ctx.beginPath()
      ctx.moveTo(0, -SHIP_H / 2)
      ctx.lineTo(SHIP_W / 2 - 2, SHIP_H / 2)
      ctx.lineTo(0, SHIP_H / 2 - 4)
      ctx.lineTo(-(SHIP_W / 2 - 2), SHIP_H / 2)
      ctx.closePath()
      ctx.fillStyle = flash ? '#ff4444' : '#00e5cc'
      ctx.shadowColor = flash ? '#ff4444' : '#00e5cc'
      ctx.shadowBlur = flash ? 16 : 8
      ctx.fill()
      ctx.restore()
    }

    function drawAsteroid(ast: Asteroid) {
      ctx.save()
      ctx.translate(ast.x, ast.y)
      ctx.rotate(ast.rot)
      ctx.beginPath()
      const pts = ast.points
      ctx.moveTo(pts[0] * ast.r, pts[1] * ast.r)
      for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(pts[i] * ast.r, pts[i + 1] * ast.r)
      }
      ctx.closePath()
      ctx.fillStyle = '#5a4030'
      ctx.strokeStyle = '#a07850'
      ctx.lineWidth = 1.5
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    // ── Vaisseaux ennemis (à abattre au tir) ──
    const enemySpawnMs = Math.max(2200, 4200 - dangerLevel * 600)
    function spawnEnemy(now: number) {
      if (dangerLevel < 1) return
      if (now - lastEnemyRef.current < enemySpawnMs) return
      lastEnemyRef.current = now
      const x = 24 + Math.random() * (W - 48)
      enemiesRef.current.push({
        x, y: -18,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 1.1 + dangerLevel * 0.35 + Math.random() * 0.6,
        hp: 2,
      })
    }

    function fireBullet(now: number) {
      if (!keysRef.current.fire) return
      if (now - lastFireRef.current < 220) return
      lastFireRef.current = now
      bulletsRef.current.push({ x: shipXRef.current, y: SHIP_Y - SHIP_H / 2, vy: -7 })
    }

    function drawEnemy(e: EnemyShip) {
      ctx.save()
      ctx.translate(e.x, e.y)
      ctx.beginPath()
      // Coque hostile pointée vers le bas
      ctx.moveTo(0, 11)
      ctx.lineTo(13, -8)
      ctx.lineTo(0, -3)
      ctx.lineTo(-13, -8)
      ctx.closePath()
      ctx.fillStyle = '#ff3344'
      ctx.shadowColor = '#ff3344'
      ctx.shadowBlur = 8
      ctx.fill()
      ctx.restore()
    }

    function drawBullet(b: Bullet) {
      ctx.fillStyle = '#ffe066'
      ctx.shadowColor = '#ffe066'
      ctx.shadowBlur = 6
      ctx.fillRect(b.x - 1.5, b.y - 6, 3, 8)
      ctx.shadowBlur = 0
    }

    let flashFrames = 0
    let running = true

    // Cap à 60 FPS — on n'avance la simulation que par pas fixes de 1000/60 ms.
    // Sur un écran 144 Hz le vaisseau et les astéroïdes gardent la même vitesse.
    const FRAME_MS = 1000 / 60
    let lastFrameTs = 0

    function loop(now: number) {
      if (!running) return

      if (phaseRef.current !== 'playing') {
        frameRef.current = requestAnimationFrame(loop)
        return
      }

      if (lastFrameTs === 0) lastFrameTs = now
      if (now - lastFrameTs < FRAME_MS) {
        frameRef.current = requestAnimationFrame(loop)
        return
      }
      lastFrameTs = now

      const elapsed = now - startRef.current
      const remaining = Math.max(0, DURATION_MS - elapsed)
      setTimeLeft(Math.ceil(remaining / 1000))

      // Ship move from keyboard
      if (keysRef.current.left)  shipXRef.current = Math.max(SHIP_W / 2,     shipXRef.current - 5)
      if (keysRef.current.right) shipXRef.current = Math.min(W - SHIP_W / 2, shipXRef.current + 5)

      spawnAsteroid(now)
      spawnEnemy(now)
      fireBullet(now)

      // Update + collision
      let newHit = false
      asteroidsRef.current = asteroidsRef.current.filter(ast => {
        ast.x += ast.vx
        ast.y += ast.vy
        ast.rot += ast.spin
        if (ast.y > H + ast.r) return false
        if (checkHit(ast)) {
          hitsRef.current++
          setHits(hitsRef.current)
          newHit = true
          flashFrames = 8
          return false
        }
        return true
      })

      // Balles : remontent et touchent les vaisseaux ennemis
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.y += b.vy
        if (b.y < -10) return false
        for (const e of enemiesRef.current) {
          if (e.hp > 0 && Math.abs(b.x - e.x) < 14 && Math.abs(b.y - e.y) < 12) {
            e.hp--
            engagedRef.current = true   // toucher un ennemi = combat pirate imminent
            return false
          }
        }
        return true
      })

      // Vaisseaux ennemis : descendent, collision joueur, destruction
      enemiesRef.current = enemiesRef.current.filter(e => {
        if (e.hp <= 0) {
          killsRef.current++
          setKills(killsRef.current)
          return false
        }
        e.x += e.vx
        e.y += e.vy
        if (e.x < 16 || e.x > W - 16) e.vx *= -1
        if (e.y > H + 18) return false
        // Collision avec le vaisseau joueur
        if (Math.abs(e.x - shipXRef.current) < SHIP_W / 2 + 12 && Math.abs(e.y - SHIP_Y) < SHIP_H / 2 + 11) {
          hitsRef.current++
          setHits(hitsRef.current)
          engagedRef.current = true
          flashFrames = 8
          return false
        }
        return true
      })

      if (flashFrames > 0) flashFrames--

      // Draw background
      ctx.fillStyle = '#03080e'
      ctx.fillRect(0, 0, W, H)

      // Stars
      STARS.forEach(s => {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + (s.s - 1) * 0.5})`
        ctx.fillRect(s.x, s.y, s.s, s.s)
      })

      // Asteroids
      asteroidsRef.current.forEach(drawAsteroid)

      // Enemies & bullets
      enemiesRef.current.forEach(drawEnemy)
      bulletsRef.current.forEach(drawBullet)

      // Danger zone line
      ctx.strokeStyle = 'rgba(0,229,204,0.12)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 8])
      ctx.beginPath()
      ctx.moveTo(0, SHIP_Y + SHIP_H); ctx.lineTo(W, SHIP_Y + SHIP_H)
      ctx.stroke()
      ctx.setLineDash([])

      // Ship
      drawShip(shipXRef.current, flashFrames > 0)

      // HUD bar
      ctx.fillStyle = 'rgba(3,8,14,0.75)'
      ctx.fillRect(0, 0, W, 26)
      ctx.fillStyle = '#00e5cc'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`${Math.ceil(remaining / 1000)}s`, 10, 17)
      const timerPct = remaining / DURATION_MS
      ctx.fillStyle = timerPct < 0.25 ? '#ff4444' : timerPct < 0.5 ? '#ffaa00' : '#00e5cc'
      ctx.fillRect(34, 9, Math.floor(timerPct * (W - 120)), 6)
      ctx.strokeStyle = '#004433'
      ctx.lineWidth = 1
      ctx.strokeRect(34, 9, W - 120, 6)
      ctx.textAlign = 'right'
      if (killsRef.current > 0) {
        ctx.fillStyle = '#ffe066'
        ctx.font = 'bold 10px monospace'
        ctx.fillText(`${killsRef.current} ABATTU${killsRef.current !== 1 ? 'S' : ''}`, W - 8, 17)
      } else {
        ctx.fillStyle = hitsRef.current > 0 ? '#ff4444' : '#44ff88'
        ctx.font = 'bold 10px monospace'
        ctx.fillText(`${hitsRef.current} IMPACT${hitsRef.current !== 1 ? 'S' : ''}`, W - 8, 17)
      }
      ctx.textAlign = 'left'

      if (elapsed >= DURATION_MS && !doneCalledRef.current) {
        doneCalledRef.current = true
        running = false
        phaseRef.current = 'done'
        setUiPhase('done')
        const dmg   = hitsRef.current * 12
        // Bonus crédits seulement si aucun ennemi engagé (sinon place au combat)
        const bonus = engagedRef.current ? 0 : hitsRef.current === 0 ? 300 : hitsRef.current <= 2 ? 100 : 0
        onResult(dmg, bonus, engagedRef.current)
        return
      }

      frameRef.current = requestAnimationFrame(loop)
    }

    frameRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(frameRef.current) }
  }, [dangerLevel, onResult])

  return (
    <div className="layout" style={{ alignItems: 'center' }}>
      <div className="t-xs t-dim t-center" style={{ letterSpacing: '2px' }}>{t('asteroidDodge.header')}</div>

      <div style={{ position: 'relative', width: W, maxWidth: '100%' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ display: 'block', width: '100%', border: '1px solid var(--border)' }}
        />

        {/* Countdown overlay */}
        {uiPhase === 'countdown' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(3,8,14,0.82)',
          }}>
            <div style={{ fontSize: '72px', color: 'var(--cyan)', fontFamily: 'monospace', lineHeight: 1, textShadow: '0 0 20px var(--cyan)' }}>
              {countdown}
            </div>
            <div className="t-xs t-dim mt8">{t('asteroidDodge.controls')}</div>
            <div className="t-xs t-dim mt4" style={{ color: 'var(--red)' }}>{t('asteroidDodge.warning')}</div>
          </div>
        )}
      </div>

      <div className="px-box" style={{ width: W, maxWidth: '100%', padding: '6px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="t-xs t-dim">{t('asteroidDodge.hudHits')} <span style={{ color: hits > 0 ? 'var(--red)' : 'var(--green)' }}>{hits}</span></span>
          <span className="t-xs t-dim">{t('asteroidDodge.hudKills')} <span style={{ color: kills > 0 ? 'var(--gold)' : 'var(--dim)' }}>{kills}</span></span>
          <span className="t-xs t-dim">{t('asteroidDodge.hudTime')} <span className="t-cyan">{timeLeft}s</span></span>
        </div>
      </div>
    </div>
  )
}
