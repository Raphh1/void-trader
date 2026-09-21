// Mise en scène du pile ou face de Rayane (cf. engine/coinFlip.ts).
//
// Le résultat est déjà tiré : tout le travail est de le RETENIR le plus
// longtemps possible sans lasser. La pièce part vite puis ralentit (le
// cliquetis ralentit avec elle), s'arrête sur la tranche et vacille au rythme
// d'un battement de cœur, puis tombe. Seulement alors : verdict, flash doré ou
// secousse rouge. Un clic abrège la scène à tout moment.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { onCoinFlip, type CoinFlipEvent } from '../../engine/coinFlip'
import { playCoinTick, playHeartbeat, playCoinWin, playCoinLose } from '../../engine/sfx'

const SPIN_MS = 1900     // rotation qui ralentit
const EDGE_MS = 900      // hésitation sur la tranche
const FALL_MS = 260      // chute sur la face finale
const REVEAL_MS = 1400   // verdict affiché avant de rendre la main
const TOURS = 9

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const easeInQuad = (x: number) => x * x

export function CoinFlipOverlay() {
  const { t } = useTranslation('coinFlip')
  const [queue, setQueue] = useState<CoinFlipEvent[]>([])
  const [angle, setAngle] = useState(0)
  const [phase, setPhase] = useState<'spin' | 'edge' | 'reveal'>('spin')
  const raf = useRef<number | null>(null)
  const current = queue[0]

  useEffect(() => onCoinFlip(e => setQueue(q => [...q, e])), [])

  useEffect(() => {
    if (!current) return
    // Angle final : PILE face à l'écran (multiple de 360), FACE retournée (+180).
    const final = TOURS * 360 + (current.heads ? 0 : 180)
    const edge = final - 90
    const start = performance.now()
    let lastHalf = 0
    let lastBeat = -1
    setPhase('spin')

    const frame = (now: number) => {
      const el = now - start
      let a: number
      if (el < SPIN_MS) {
        a = edge * easeOutCubic(el / SPIN_MS)
        const half = Math.floor(a / 180)
        if (half !== lastHalf) { lastHalf = half; playCoinTick() }
      } else if (el < SPIN_MS + EDGE_MS) {
        setPhase('edge')
        const p = (el - SPIN_MS) / EDGE_MS
        // Vacille sur la tranche, de plus en plus faiblement.
        a = edge + Math.sin(p * Math.PI * 5) * 14 * (1 - p)
        const beat = Math.floor(p * 2)
        if (beat !== lastBeat) { lastBeat = beat; playHeartbeat() }
      } else if (el < SPIN_MS + EDGE_MS + FALL_MS) {
        a = edge + 90 * easeInQuad((el - SPIN_MS - EDGE_MS) / FALL_MS)
      } else {
        setAngle(final)
        setPhase('reveal')
        if (current.heads) playCoinWin(); else playCoinLose()
        return
      }
      setAngle(a)
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [current])

  // Fin du verdict : on passe à la pièce suivante (ou on rend la main).
  useEffect(() => {
    if (phase !== 'reveal' || !current) return
    const timer = setTimeout(() => setQueue(q => q.slice(1)), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [phase, current])

  if (!current) return null

  function abreger() {
    if (phase === 'reveal') { setQueue(q => q.slice(1)); return }
    if (raf.current) cancelAnimationFrame(raf.current)
    setAngle(TOURS * 360 + (current.heads ? 0 : 180))
    setPhase('reveal')
    if (current.heads) playCoinWin(); else playCoinLose()
  }

  const reveal = phase === 'reveal'
  const couleur = !reveal ? 'var(--gold)' : current.heads ? 'var(--gold)' : 'var(--red)'
  return (
    <div className={`coinflip-backdrop ${phase === 'edge' ? 'coinflip-pulse' : ''} ${reveal && !current.heads ? 'coinflip-shake' : ''} ${reveal && current.heads ? 'coinflip-flash' : ''}`}
      onClick={abreger}>
      <div className="t-xs" style={{ letterSpacing: '4px', color: 'var(--dim)' }}>{t('allOrNothing')}</div>
      <div className="t-sm t-bright mt4" style={{ textAlign: 'center' }}>{t(`stake.${current.stake}.title`, current.params)}</div>
      <div className="coinflip-stage">
        <div className="coinflip-coin" style={{ transform: `rotateY(${angle}deg)` }}>
          <div className="coinflip-face coinflip-heads">{t('heads')}</div>
          <div className="coinflip-face coinflip-tails">{t('tails')}</div>
        </div>
      </div>
      <div className="row t-xs" style={{ gap: '24px', justifyContent: 'center', opacity: reveal ? 0.35 : 1 }}>
        <span style={{ color: 'var(--gold)' }}>{t('heads')} : {t(`stake.${current.stake}.heads`, current.params)}</span>
        <span style={{ color: 'var(--red)' }}>{t('tails')} : {t(`stake.${current.stake}.tails`, current.params)}</span>
      </div>
      <div className="t-sm mt8" style={{ minHeight: '1.6em', color: couleur, letterSpacing: '3px', fontWeight: 'bold' }}>
        {reveal ? (current.heads ? t('verdictHeads') : t('verdictTails')) : phase === 'edge' ? t('edge') : ''}
      </div>
      <div className="t-xs t-dim mt4">{t('skip')}</div>
    </div>
  )
}
