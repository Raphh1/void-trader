import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WeaponData } from '../../types'
import {
  BAR_CONFIGS, weaponFamily, cursorPosition, accuracyAt, finalMultiplier, gradeOf, shotMultiplier,
  type HitGrade,
} from '../../engine/attackBar'
import { playClick, playHit, playCrit } from '../../engine/sfx'

interface Props {
  weapon: WeaponData | null
  onResult: (mult: number) => void
}

const GRADE_COLOR: Record<HitGrade, string> = {
  parfait: 'var(--gold)', bien: 'var(--green)', bof: 'var(--orange)', rate: 'var(--red)',
}
const PAUSE_BETWEEN_SHOTS_MS = 160
const SHOW_RESULT_MS = 700

export function AttackBar({ weapon, onResult }: Props) {
  const { t } = useTranslation('minigames')
  const family = weaponFamily(weapon)
  const cfg = BAR_CONFIGS[family]
  // Explosifs : on lance vers une cible décentrée, différente à chaque coup.
  const [target] = useState(() => cfg.bounces ? 0.2 + Math.random() * 0.6 : 0.5)

  const [pos, setPos] = useState(0)
  const [shots, setShots] = useState<{ position: number | null; accuracy: number | null }[]>([])
  const [finalMult, setFinalMult] = useState<number | null>(null)
  const startRef = useRef(performance.now())
  const shotsRef = useRef(shots)
  const waitingRef = useRef(false)
  shotsRef.current = shots

  const done = finalMult !== null

  function record(position: number | null) {
    if (waitingRef.current || done) return
    const accuracy = position === null ? null : accuracyAt(position, target)
    const next = [...shotsRef.current, { position, accuracy }]
    shotsRef.current = next
    setShots(next)
    const grade = gradeOf(accuracy)
    if (grade === 'parfait') playCrit(); else if (grade !== 'rate') playHit(); else playClick()
    if (next.length >= cfg.shots) {
      const mult = finalMultiplier(cfg, next.map(s => s.accuracy))
      setFinalMult(mult)
      setTimeout(() => onResult(mult), SHOW_RESULT_MS)
      return
    }
    waitingRef.current = true
    setTimeout(() => { waitingRef.current = false; startRef.current = performance.now() }, PAUSE_BETWEEN_SHOTS_MS)
  }

  function strike() {
    if (waitingRef.current || done) return
    record(cursorPosition(cfg, performance.now() - startRef.current))
  }

  useEffect(() => {
    if (done) return
    let frame = 0
    const tick = () => {
      if (!waitingRef.current) {
        const p = cursorPosition(cfg, performance.now() - startRef.current)
        if (p === null) record(null)
        else setPos(p)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  })

  // Le clavier appartient à la barre tant qu'elle est ouverte : Espace / Entrée
  // frappent, et aucun raccourci du combat ne part en dessous.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); strike() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  // Zone qui rapporte plus qu'un coup normal (×1 et au-delà), et zone parfaite.
  const seuilUn = Math.pow(Math.max(0, (1 - cfg.min) / (cfg.max - cfg.min)), 1 / cfg.curve)
  const demiBonne = (1 - seuilUn) * 0.5
  const demiParfaite = 0.05 * 0.5
  const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100))}%`
  const restants = cfg.shots - shots.length

  return (
    <div className="layout">
      <div className="t-xs t-center" style={{ color: 'var(--gold)', letterSpacing: '3px' }}>{t(`attackBar.title.${family}`)}</div>
      <div className="px-box">
        <div className="t-xs t-dim mb8" style={{ lineHeight: 1.7 }}>{t(`attackBar.hint.${family}`)}</div>

        <div onPointerDown={strike} style={{ position: 'relative', height: '58px', background: 'rgba(255,60,60,0.12)', border: '2px solid var(--border-hi)', cursor: 'pointer', overflow: 'hidden', touchAction: 'manipulation' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(target - demiBonne), width: pct(demiBonne * 2), background: 'rgba(64,255,128,0.20)', borderLeft: '1px solid var(--green)', borderRight: '1px solid var(--green)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(target - demiParfaite), width: pct(demiParfaite * 2), background: 'rgba(255,215,0,0.45)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(target), width: '2px', marginLeft: '-1px', background: 'var(--gold)' }} />
          {shots.map((s, i) => s.position !== null && (
            <div key={i} style={{ position: 'absolute', top: '6px', bottom: '6px', left: pct(s.position), width: '4px', marginLeft: '-2px', background: GRADE_COLOR[gradeOf(s.accuracy)] }} />
          ))}
          {!done && !waitingRef.current && (
            <div style={{ position: 'absolute', top: '-2px', bottom: '-2px', left: pct(pos), width: '6px', marginLeft: '-3px', background: 'var(--text-bright)', boxShadow: '0 0 8px var(--text-bright)' }} />
          )}
        </div>

        <div className="row mt8" style={{ justifyContent: 'space-between', alignItems: 'center', minHeight: '18px' }}>
          <div className="row" style={{ gap: '8px' }}>
            {shots.map((s, i) => (
              <span key={i} className="t-xs" style={{ color: GRADE_COLOR[gradeOf(s.accuracy)] }}>
                {t(`attackBar.grade.${gradeOf(s.accuracy)}`)} ×{shotMultiplier(cfg, s.accuracy).toFixed(2)}
              </span>
            ))}
          </div>
          {cfg.shots > 1 && !done && <span className="t-xs t-dim">{t('attackBar.shotsLeft', { count: restants })}</span>}
          {cfg.bounces && !done && <span className="t-xs t-orange">{t('attackBar.fuse')}</span>}
        </div>
      </div>

      {done ? (
        <div className="px-box t-center" style={{ borderColor: finalMult! >= 1.3 ? 'var(--gold)' : finalMult! >= 1 ? 'var(--green)' : 'var(--red)' }}>
          <div className="t-sm" style={{ color: finalMult! >= 1.3 ? 'var(--gold)' : finalMult! >= 1 ? 'var(--green)' : 'var(--red)' }}>
            {t('attackBar.result', { mult: finalMult!.toFixed(2) })}
          </div>
        </div>
      ) : (
        <button className="px-btn px-btn--primary" onPointerDown={strike} style={{ fontSize: '12px', padding: '16px', textAlign: 'center' }}>
          {t('attackBar.strike')}
        </button>
      )}
    </div>
  )
}
