import { useEffect, useRef, useState } from 'react'
import { questTitle, questDescription } from '../../engine/questI18n'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { translateStationName } from '../../engine/goodsI18n'

const GAME_DURATION = 25
const PLAYER_W = 20
const PLAYER_H = 12

interface Asteroid {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  hue: number
}

interface EnemyShip {
  x: number
  y: number
  r: number
  vx: number
  vy: number
}

interface Bullet {
  x: number
  y: number
  vx: number
}

const SHOT_COOLDOWN_MS = 260

export function EscortMiniGameScreen() {
  const { t } = useTranslation('minigames')
  const gs                  = useGameStore(s => s.gs!)
  const completeEscortQuest = useGameStore(s => s.completeEscortQuest)

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const stateRef   = useRef({
    playerX: 80, playerY: 150,
    lives: 3,
    asteroids: [] as Asteroid[],
    ships: [] as EnemyShip[],
    bullets: [] as Bullet[],
    keys: new Set<string>(),
    startTime: 0,
    invincibleUntil: 0,
    lastSpawn: 0,
    lastShipSpawn: 0,
    lastShot: 0,
    shipsDestroyed: 0,
    done: false,
  })

  const [lives, setLives]     = useState(3)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [result, setResult]   = useState<'won' | 'lost' | null>(null)
  const [shipsDestroyed, setShipsDestroyed] = useState(0)

  const quest = gs.activeQuests.find(q => q.id === gs.pendingEscortQuestId)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || result) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height
    const s = stateRef.current
    s.startTime    = Date.now()
    s.done         = false
    s.lives        = 3
    s.playerX      = 80
    s.playerY      = H / 2
    s.asteroids    = []
    s.ships        = []
    s.bullets      = []
    s.lastSpawn    = Date.now()
    s.lastShipSpawn = Date.now()
    s.lastShot     = 0
    s.shipsDestroyed = 0
    s.invincibleUntil = 0

    function shoot() {
      const now = Date.now()
      if (now - s.lastShot < SHOT_COOLDOWN_MS) return
      s.lastShot = now
      s.bullets.push({ x: s.playerX + PLAYER_W, y: s.playerY, vx: 7 })
    }

    const onMove = (e: MouseEvent) => {
      const r  = canvas.getBoundingClientRect()
      s.playerX = Math.max(PLAYER_W, Math.min(W - PLAYER_W, (e.clientX - r.left) * (W / r.width)))
      s.playerY = Math.max(PLAYER_H, Math.min(H - PLAYER_H, (e.clientY - r.top)  * (H / r.height)))
    }
    const onClick = () => shoot()
    const onTouch = (e: TouchEvent) => {
      e.preventDefault()
      const r  = canvas.getBoundingClientRect()
      const touch  = e.touches[0]
      s.playerX = Math.max(PLAYER_W, Math.min(W - PLAYER_W, (touch.clientX - r.left) * (W / r.width)))
      s.playerY = Math.max(PLAYER_H, Math.min(H - PLAYER_H, (touch.clientY - r.top)  * (H / r.height)))
    }
    const onKeyDown = (e: KeyboardEvent) => {
      s.keys.add(e.key)
      if (e.key === ' ') { e.preventDefault(); shoot() }
    }
    const onKeyUp   = (e: KeyboardEvent) => s.keys.delete(e.key)
    const onTouchStartShoot = () => shoot()

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onClick)
    canvas.addEventListener('touchmove', onTouch, { passive: false })
    canvas.addEventListener('touchstart', onTouchStartShoot)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let animId: number

    function loop() {
      if (s.done) return
      const now     = Date.now()
      const elapsed = (now - s.startTime) / 1000
      const remaining = Math.max(0, GAME_DURATION - elapsed)

      // Keyboard movement
      const spd = 4
      if (s.keys.has('ArrowUp')    || s.keys.has('z') || s.keys.has('Z') || s.keys.has('w') || s.keys.has('W')) s.playerY = Math.max(PLAYER_H, s.playerY - spd)
      if (s.keys.has('ArrowDown')  || s.keys.has('s') || s.keys.has('S')) s.playerY = Math.min(H - PLAYER_H, s.playerY + spd)
      if (s.keys.has('ArrowLeft')  || s.keys.has('q') || s.keys.has('Q') || s.keys.has('a') || s.keys.has('A')) s.playerX = Math.max(PLAYER_W, s.playerX - spd)
      if (s.keys.has('ArrowRight') || s.keys.has('d') || s.keys.has('D')) s.playerX = Math.min(W - PLAYER_W, s.playerX + spd)

      // Spawn asteroids — densité croissante
      const spawnInterval = Math.max(400, 1600 - elapsed * 45)
      if (now - s.lastSpawn > spawnInterval) {
        const r   = Math.random() * 16 + 8
        const vy0 = (Math.random() - 0.5) * 1.4
        s.asteroids.push({ x: W + r, y: Math.random() * (H - r * 2) + r, r, vx: -(Math.random() * 2.5 + 1.5), vy: vy0, hue: Math.random() * 30 + 10 })
        s.lastSpawn = now
      }

      // Spawn vaisseaux ennemis — moins fréquents que les astéroïdes, destructibles au tir
      const shipSpawnInterval = Math.max(1800, 3400 - elapsed * 40)
      if (now - s.lastShipSpawn > shipSpawnInterval) {
        const r = 11
        s.ships.push({ x: W + r, y: Math.random() * (H - r * 2) + r, r, vx: -(Math.random() * 1.6 + 1.2), vy: (Math.random() - 0.5) * 1.0 })
        s.lastShipSpawn = now
      }

      // Move & cull asteroids
      s.asteroids = s.asteroids.filter(a => a.x + a.r > 0)
      for (const a of s.asteroids) {
        a.x += a.vx
        a.y += a.vy
        if (a.y - a.r < 0 || a.y + a.r > H) a.vy *= -1
      }

      // Move & cull ships
      s.ships = s.ships.filter(sh => sh.x + sh.r > 0)
      for (const sh of s.ships) {
        sh.x += sh.vx
        sh.y += sh.vy
        if (sh.y - sh.r < 0 || sh.y + sh.r > H) sh.vy *= -1
      }

      // Move & cull bullets
      s.bullets = s.bullets.filter(b => b.x < W)
      for (const b of s.bullets) b.x += b.vx

      // Collision tir ↔ vaisseau — détruit le vaisseau, libère l'espace, pas de combat déclenché
      for (const b of s.bullets) {
        for (const sh of s.ships) {
          const dx = sh.x - b.x
          const dy = sh.y - b.y
          if (dx * dx + dy * dy < sh.r * sh.r) {
            b.x = W + 999 // marque le tir pour suppression
            sh.x = -999   // marque le vaisseau pour suppression
            s.shipsDestroyed++
            setShipsDestroyed(s.shipsDestroyed)
            break
          }
        }
      }
      s.bullets = s.bullets.filter(b => b.x < W)
      s.ships = s.ships.filter(sh => sh.x + sh.r > 0)

      // Hit detection (small ellipse hitbox) — astéroïdes ET vaisseaux non détruits
      if (now > s.invincibleUntil) {
        for (const a of [...s.asteroids, ...s.ships]) {
          const dx = a.x - s.playerX
          const dy = a.y - s.playerY
          if (dx * dx / ((a.r + 10) * (a.r + 10)) + dy * dy / ((a.r + 8) * (a.r + 8)) < 1) {
            s.lives--
            s.invincibleUntil = now + 1600
            setLives(s.lives)
            if (s.lives <= 0) { s.done = true; setResult('lost'); return }
            break
          }
        }
      }

      // Win
      if (remaining <= 0) { s.done = true; setResult('won'); return }
      setTimeLeft(Math.ceil(remaining))

      // ── DRAW ──
      ctx.fillStyle = '#01030a'
      ctx.fillRect(0, 0, W, H)

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      for (let i = 0; i < 55; i++) {
        const sx = ((i * 173 + now * 0.025) % W + W) % W
        const sy = (i * 83) % H
        ctx.fillRect(sx, sy, 1, 1)
      }

      // Asteroids
      for (const a of s.asteroids) {
        ctx.beginPath()
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsl(${a.hue},55%,35%)`
        ctx.fill()
        ctx.strokeStyle = `hsl(${a.hue},40%,55%)`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Enemy ships (destructibles au tir — silhouette distincte des astéroïdes)
      for (const sh of s.ships) {
        ctx.save()
        ctx.translate(sh.x, sh.y)
        ctx.fillStyle = '#ff3355'
        ctx.beginPath()
        ctx.moveTo(-sh.r, 0)
        ctx.lineTo(sh.r, -sh.r * 0.7)
        ctx.lineTo(sh.r * 0.3, 0)
        ctx.lineTo(sh.r, sh.r * 0.7)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#ffaabb'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      }

      // Bullets
      ctx.fillStyle = '#40ffe0'
      for (const b of s.bullets) {
        ctx.fillRect(b.x - 4, b.y - 1.5, 8, 3)
      }

      // Player ship (flicker when invincible)
      const flicker = now < s.invincibleUntil && Math.floor(now / 90) % 2 === 0
      if (!flicker) {
        ctx.save()
        ctx.translate(s.playerX, s.playerY)
        // Engine flame
        ctx.fillStyle = '#ff7700'
        ctx.beginPath(); ctx.ellipse(-PLAYER_W + 2, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill()
        // Hull
        ctx.fillStyle = '#00ccff'
        ctx.beginPath()
        ctx.moveTo(PLAYER_W, 0)
        ctx.lineTo(-PLAYER_W + 4, -PLAYER_H)
        ctx.lineTo(-PLAYER_W + 10, 0)
        ctx.lineTo(-PLAYER_W + 4, PLAYER_H)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#006688'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      }

      // HUD timer bar
      const timerPct = remaining / GAME_DURATION
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(8, 8, W - 16, 6)
      ctx.fillStyle = timerPct > 0.4 ? '#00ff88' : timerPct > 0.2 ? '#ffaa00' : '#ff3333'
      ctx.fillRect(8, 8, (W - 16) * timerPct, 6)

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animId)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onClick)
      canvas.removeEventListener('touchmove', onTouch)
      canvas.removeEventListener('touchstart', onTouchStartShoot)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [result])

  return (
    <div className="layout" style={{ alignItems: 'center' }}>
      <div className="t-center t-dim t-xs" style={{ letterSpacing: '2px' }}>{t('escort.header')}</div>

      {quest && (
        <div className="t-xs t-dim t-center">
          {t('escort.escort')} <span className="t-cyan">{questTitle(quest)}</span>
          <span className="t-dim" style={{ marginLeft: '8px' }}>→ {translateStationName(quest.targetStation)}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px' }}>
        <div className="t-xs">
          {[0, 1, 2].map(i => (
            <span key={i} style={{ color: i < lives ? 'var(--red)' : 'var(--border-dim)', marginRight: '4px', fontSize: '16px' }}>♥</span>
          ))}
        </div>
        <div className="t-xs" style={{ color: 'var(--cyan)' }}>
          {t('escort.destroyed', { count: shipsDestroyed })}
        </div>
        <div className="t-xs" style={{ color: timeLeft <= 5 ? 'var(--red)' : 'var(--text)' }}>
          <span className={timeLeft <= 5 ? 'blink' : ''}>{timeLeft}s</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={520}
        height={300}
        style={{ border: '2px solid var(--cyan)', display: 'block', maxWidth: '100%', cursor: 'none', touchAction: 'none' }}
      />

      <div className="t-xs t-dim t-center">
        {t('escort.instructions', { duration: GAME_DURATION })}
      </div>

      {result && (
        <div className="px-box" style={{ borderColor: result === 'won' ? 'var(--gold)' : 'var(--red)', textAlign: 'center', maxWidth: '520px', width: '100%' }}>
          {result === 'won' ? (
            <>
              <div className="t-lg t-gold mb4">{t('escort.passengerDelivered')}</div>
              <div className="t-xs t-dim">{t('escort.smoothTransit')}</div>
              {quest && <div className="t-xs t-cyan mt4">{t('escort.reward', { credits: quest.creditReward.toLocaleString(), rep: quest.repReward })}</div>}
            </>
          ) : (
            <>
              <div className="t-lg t-red mb4">{t('escort.passengerLost')}</div>
              <div className="t-xs t-dim">{t('escort.tookTooManyHits')}</div>
              <div className="t-xs t-red mt4">{t('escort.questFailed')}</div>
            </>
          )}
          <button
            className="px-btn mt8"
            style={{ borderColor: result === 'won' ? 'var(--gold)' : 'var(--red)', color: result === 'won' ? 'var(--gold)' : 'var(--red)' }}
            onClick={() => completeEscortQuest(result === 'won')}
          >
            {t('escort.continueArrow')}
          </button>
        </div>
      )}
    </div>
  )
}
