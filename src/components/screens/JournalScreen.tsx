import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import type { JournalEntry } from '../../types'
import { translateStationName } from '../../engine/goodsI18n'

const CATEGORY_COLORS: Record<JournalEntry['category'], string> = {
  combat:   'var(--red)',
  decision: 'var(--orange)',
  travel:   'var(--cyan)',
  nexus:    'var(--purple)',
  prison:   'var(--dim)',
  event:    'var(--green)',
}

export function JournalScreen() {
  const { t } = useTranslation('journalScreen')
  const gs   = useGameStore(s => s.gs!)
  const goTo = useGameStore(s => s.goTo)

  const entries = [...(gs.journal ?? [])].reverse()

  return (
    <div className="layout">
      <div className="row" style={{ alignItems: 'center', gap: '12px' }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>
          {t('back')}
        </button>
        <div className="t-sm t-bright" style={{ flex: 1 }}>{t('title')}</div>
        <div className="t-xs t-dim">{t('entries', { count: entries.length })}</div>
      </div>

      {entries.length === 0 && (
        <div className="px-box" style={{ borderColor: 'var(--border)' }}>
          <div className="t-xs t-dim t-center" style={{ padding: '16px 0', lineHeight: '2.2' }}>
            {t('emptyLine1')}<br />
            {t('emptyLine2')}
          </div>
        </div>
      )}

      <div className="col" style={{ gap: '6px' }}>
        {entries.map(entry => {
          const color = CATEGORY_COLORS[entry.category]
          return (
            <div key={entry.id} className="px-box" style={{ borderColor: color, padding: '10px 14px' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="tag" style={{ borderColor: color, color, fontSize: '8px', letterSpacing: '1px' }}>
                    {t(`categories.${entry.category}`)}
                  </span>
                  <span className="t-xs t-dim">{translateStationName(entry.station)}</span>
                </div>
                <span className="t-xs t-dim">{t('day', { day: entry.day })}</span>
              </div>
              <div className="t-xs" style={{ lineHeight: '2', color: 'var(--text)', fontStyle: 'italic' }}>
                {entry.text}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
