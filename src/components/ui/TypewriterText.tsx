import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const SPEED_KEY = 'voidtrader-text-speed'
const SPEEDS = { normal: 22, fast: 5 } as const
type SpeedMode = keyof typeof SPEEDS

function getSavedSpeed(): SpeedMode {
  return (localStorage.getItem(SPEED_KEY) as SpeedMode) || 'normal'
}

interface Props {
  text: string
  speed?: number
  onDone?: () => void
  className?: string
  style?: React.CSSProperties
}

export function TypewriterText({ text, speed, onDone, className, style }: Props) {
  const { t } = useTranslation('common')
  const [pos, setPos] = useState(0)
  const [mode, setMode] = useState<SpeedMode>(getSavedSpeed)

  const effectiveSpeed = speed ?? SPEEDS[mode]

  useEffect(() => {
    setPos(0)
  }, [text])

  useEffect(() => {
    if (pos >= text.length) {
      onDone?.()
      return
    }
    const t = setTimeout(() => setPos(p => p + 1), effectiveSpeed)
    return () => clearTimeout(t)
  }, [pos, text, effectiveSpeed, onDone])

  function skip() {
    if (pos < text.length) setPos(text.length)
  }

  function toggleSpeed(e: React.MouseEvent) {
    e.stopPropagation()
    const next: SpeedMode = mode === 'normal' ? 'fast' : 'normal'
    setMode(next)
    localStorage.setItem(SPEED_KEY, next)
  }

  return (
    <span
      className={className}
      style={{ ...style, cursor: pos < text.length ? 'pointer' : undefined }}
      onClick={skip}
      title={pos < text.length ? t('typewriterSkip') : undefined}
    >
      {text.slice(0, pos)}
      {pos < text.length && (
        <>
          <span className="blink" style={{ opacity: 0.7 }}>▌</span>
          <button
            onClick={toggleSpeed}
            style={{
              background: 'none', border: '1px solid var(--border-dim)', color: 'var(--dim)',
              fontSize: '9px', padding: '1px 4px', marginLeft: '6px', cursor: 'pointer',
              verticalAlign: 'middle',
            }}
          >
            {mode === 'normal' ? '⏩' : '▶'}
          </button>
        </>
      )}
    </span>
  )
}
