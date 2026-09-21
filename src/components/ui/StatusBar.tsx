import { useEffect, useRef } from 'react'
import type { GameState } from '../../types'
import { useFloatingNumbers, FloatingNumbersLayer } from './FloatingNumber'
import { getFactionMap } from '../../engine/factions'
import { useTranslation } from 'react-i18next'
import { translateWeaponName, translateArmorName } from '../../engine/goodsI18n'

interface Props { gs: GameState }

export function StatusBar({ gs }: Props) {
  const { t } = useTranslation()
  const hpPct   = (gs.playerHp / gs.playerMaxHp) * 100
  const staPct  = (gs.stamina  / gs.maxStamina)  * 100
  const shipPct = (gs.shipHp   / gs.shipMaxHp)   * 100
  const low     = hpPct < 30
  const shipLow = shipPct < 20

  const showFolie = gs.class.name === 'Accro' || gs.moralTags.includes('cannibal')
  const folie     = gs.folieLevel ?? 0
  const folieColor = folie >= 80 ? 'var(--red)' : folie >= 50 ? 'var(--orange)' : 'var(--purple)'
  const folieLabel = gs.moralTags.includes('cannibal') && gs.class.name === 'Accro'
    ? t('statusbar.folieDouble')
    : gs.moralTags.includes('cannibal') ? t('statusbar.folieBlood') : t('statusbar.folie')

  const repColor = gs.reputation >= 40 ? 'var(--green)' : gs.reputation <= -40 ? 'var(--red)' : 'var(--text)'
  const faction = gs.faction !== 'none' ? getFactionMap()[gs.faction] : null
  const factionRep = faction ? gs.factionReputation[faction.id as keyof typeof gs.factionReputation] : null
  const factionRepColor = factionRep !== null && factionRep >= 40 ? 'var(--green)' : factionRep !== null && factionRep <= -40 ? 'var(--red)' : 'var(--text)'

  return (
    <div className={`px-box status-grid ${showFolie ? 'status-grid--folie' : ''}`}>
      <div>
        <div className="t-dim t-xs mb4">{t('statusbar.hp')}</div>
        <div className={`bar bar--hp ${low ? 'low' : ''}`}>
          <div className="bar__fill" style={{ width: `${hpPct}%` }} />
        </div>
        <div className="t-sm mt4" style={{ color: low ? 'var(--red)' : 'var(--green)' }}>
          {gs.playerHp}/{gs.playerMaxHp}
        </div>
      </div>
      <div>
        <div className="t-dim t-xs mb4">{t('statusbar.stamina')}</div>
        <div className="bar bar--sta">
          <div className="bar__fill" style={{ width: `${staPct}%` }} />
        </div>
        <div className="t-sm mt4 t-cyan">{gs.stamina}/{gs.maxStamina}</div>
      </div>
      <div>
        <div className="t-dim t-xs mb4">{t('statusbar.ship')}</div>
        <div className={`bar bar--ship ${shipLow ? 'low' : ''}`}>
          <div className="bar__fill" style={{ width: `${shipPct}%` }} />
        </div>
        <div className="t-sm mt4" style={{ color: shipLow ? 'var(--red)' : 'var(--blue)' }}>
          {gs.shipHp}/{gs.shipMaxHp}{shipLow ? ' ⚠' : ''}
        </div>
      </div>

      {showFolie && (
        <div>
          <div className="t-xs mb4" style={{ color: folieColor }}>{folieLabel}</div>
          <div className="bar" style={{ borderColor: folieColor }}>
            <div style={{ height: '100%', width: `${folie}%`, background: folieColor, transition: 'width 0.4s, background 0.4s' }} />
          </div>
          <div className="t-sm mt4" style={{ color: folieColor }}>
            {folie}/100{folie >= 80 ? ' ⚠' : ''}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div><span className="t-dim t-xs">{t('statusbar.cr')} </span><span className="t-gold t-sm">{gs.credits.toLocaleString()}</span></div>
        <div><span className="t-dim t-xs">{t('statusbar.fuel')} </span><span className="t-cyan t-sm">{gs.fuel}/{gs.maxFuel}</span></div>
        <div><span className="t-dim t-xs">{t('statusbar.day')} </span><span className="t-sm">{gs.day}</span></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div><span className="t-dim t-xs">{t('statusbar.rep')} </span><span className="t-sm" style={{ color: repColor }}>{gs.reputation > 0 ? '+' : ''}{gs.reputation}</span></div>
        {faction && factionRep !== null && (
          <div>
            <span className="t-xs" style={{ color: faction.color }}>{faction.name.replace(/^(Les |L'|Le )/, '')} </span>
            <span className="t-sm" style={{ color: factionRepColor }}>{factionRep > 0 ? '+' : ''}{factionRep}</span>
          </div>
        )}
      </div>

      {(gs.equippedWeapon || gs.equippedArmor) && (
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="t-xs t-dim">{t('statusbar.equipped')}</span>
          {gs.equippedWeapon && (
            <span className={`tag tier-${gs.equippedWeapon.tier} t-xs`}>
              ⚔ {translateWeaponName(gs.equippedWeapon.name)}
            </span>
          )}
          {gs.equippedArmor && (
            <span className={`tag tier-${gs.equippedArmor.tier} t-xs`} style={{ color: 'var(--blue)', borderColor: '#224488' }}>
              🛡 {translateArmorName(gs.equippedArmor.name)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Barre d'état qui fait flotter les variations (+70 cr, −12 PV…) au moment où
 * elles arrivent. Sans ça, un gain de quête ou une perte d'équipage passait
 * inaperçu : le chiffre changeait en silence.
 */
export function StatusBarWithDeltas({ gs }: Props) {
  const { containerRef, entries, fire } = useFloatingNumbers()
  const prev = useRef({ credits: gs.credits, hp: gs.playerHp, rep: gs.reputation, fuel: gs.fuel })

  useEffect(() => {
    const p = prev.current
    const w = containerRef.current?.getBoundingClientRect().width ?? 600
    const signe = (n: number) => (n > 0 ? '+' : '−') + Math.abs(n).toLocaleString()
    if (gs.playerHp !== p.hp) fire(`${signe(gs.playerHp - p.hp)} PV`, gs.playerHp > p.hp ? 'var(--green)' : 'var(--red)', w * 0.12, 30)
    if (gs.credits !== p.credits) fire(`${signe(gs.credits - p.credits)} cr`, gs.credits > p.credits ? 'var(--gold)' : 'var(--red)', w * 0.62, 30)
    if (gs.fuel !== p.fuel) fire(`${signe(gs.fuel - p.fuel)} ⛽`, gs.fuel > p.fuel ? 'var(--cyan)' : 'var(--red)', w * 0.62, 60)
    if (gs.reputation !== p.rep) fire(`${signe(gs.reputation - p.rep)} rép`, gs.reputation > p.rep ? 'var(--green)' : 'var(--red)', w * 0.85, 30)
    prev.current = { credits: gs.credits, hp: gs.playerHp, rep: gs.reputation, fuel: gs.fuel }
  }, [gs.credits, gs.playerHp, gs.reputation, gs.fuel, fire, containerRef])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <StatusBar gs={gs} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
        <FloatingNumbersLayer entries={entries} />
      </div>
    </div>
  )
}
