import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { translateWeaponName } from '../../engine/goodsI18n'
import { translateEnemyName } from '../../engine/goodsI18n'

export function CombatOutcomeScreen() {
  const { t } = useTranslation('combatOutcomeScreen')
  const gs   = useGameStore(s => s.gs!)
  const goTo = useGameStore(s => s.goTo)
  const patch = useGameStore(s => s.patch)

  const outcome  = gs.pendingCombatOutcome
  const enemy    = gs.combatEnemy

  if (outcome === 'stunned') {
    const creditsLost = parseInt(gs.pendingMessage ?? '0', 10)
    return (
      <div className="layout scanlines" style={{ justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', width: '100%' }}>

          <div className="t-center mb8" style={{ letterSpacing: '6px', color: 'var(--red)', fontSize: '9px' }}>
            ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
          </div>

          <div className="px-box" style={{ borderColor: 'var(--red)', textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '20px', color: 'var(--red)', letterSpacing: '4px', marginBottom: '16px' }}>
              {t('stunned.title')}
            </div>
            <div className="t-xs t-dim" style={{ lineHeight: '2.2', marginBottom: '16px' }}>
              {enemy
                ? t('stunned.byEnemy', { name: translateEnemyName(enemy.name) })
                : t('stunned.genericFall')}
              <br />
              {t('stunned.wakeUp')}
              <br />
              {t('stunned.pocketsEmpty')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {creditsLost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="t-xs t-dim">{t('stunned.creditsStolen')}</span>
                  <span className="t-xs t-red">−{creditsLost.toLocaleString()} cr</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('stunned.hpRemaining')}</span>
                <span className="t-xs t-red">{gs.playerHp}/{gs.playerMaxHp}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('stunned.creditsRemaining')}</span>
                <span className="t-xs t-gold">{gs.credits.toLocaleString()} cr</span>
              </div>
            </div>
            <div className="t-xs t-dim" style={{ fontStyle: 'italic', marginBottom: '20px' }}>
              {t('stunned.flavor')}
            </div>
          </div>

          <div className="t-center mb8" style={{ letterSpacing: '6px', color: 'var(--red)', fontSize: '9px' }}>
            ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
          </div>

          <button className="px-btn" onClick={() => {
            patch({ pendingCombatOutcome: null, pendingMessage: null })
            goTo(gs.isImprisoned ? 'prison' : 'station-hub')
          }}>
            {gs.isImprisoned ? t('stunned.backToCell') : t('stunned.riseAndContinue')}
          </button>
        </div>
      </div>
    )
  }

  if (outcome === 'captured') {
    let captureInfo: { creditsFine?: number; weaponName?: string | null; cargoLost?: number } = {}
    try { captureInfo = JSON.parse(gs.pendingMessage ?? '{}') } catch {}

    return (
      <div className="layout scanlines" style={{ justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', width: '100%' }}>

          <div className="t-center mb8" style={{ letterSpacing: '6px', color: 'var(--orange)', fontSize: '9px' }}>
            ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓
          </div>

          <div className="px-box" style={{ borderColor: 'var(--orange)', textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '20px', color: 'var(--orange)', letterSpacing: '4px', marginBottom: '16px' }}>
              {t('captured.title')}
            </div>
            <div className="t-xs t-dim" style={{ lineHeight: '2.2', marginBottom: '16px' }}>
              {enemy ? t('captured.byEnemy', { name: translateEnemyName(enemy.name) }) : t('captured.genericNoChoice')}
              <br />
              {t('captured.cuffs')}
              <br />
              {t('captured.theirsNow')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {(captureInfo.creditsFine ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="t-xs t-dim">{t('captured.creditsSeized')}</span>
                  <span className="t-xs t-red">−{(captureInfo.creditsFine ?? 0).toLocaleString()} cr</span>
                </div>
              )}
              {(captureInfo.cargoLost ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="t-xs t-dim">{t('captured.cargoConfiscated')}</span>
                  <span className="t-xs t-red">{t('captured.cargoType', { count: captureInfo.cargoLost, plural: (captureInfo.cargoLost ?? 0) > 1 ? 's' : '' })}</span>
                </div>
              )}
              {captureInfo.weaponName && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="t-xs t-dim">{t('captured.weaponSeized')}</span>
                  <span className="t-xs t-orange">{translateWeaponName(captureInfo.weaponName)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('captured.initialSentence')}</span>
                <span className="t-xs t-orange">{t('captured.threeDays')}</span>
              </div>
            </div>

            <div className="t-xs t-dim" style={{ fontStyle: 'italic', marginBottom: '8px' }}>
              {t('captured.options')}
            </div>
            <div className="t-xs t-red" style={{ fontStyle: 'italic', marginBottom: '20px' }}>
              {t('captured.costWarning')}
            </div>
          </div>

          <div className="t-center mb8" style={{ letterSpacing: '6px', color: 'var(--orange)', fontSize: '9px' }}>
            ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓
          </div>

          <button className="px-btn px-btn--danger" onClick={() => {
            patch({ pendingCombatOutcome: null, pendingMessage: null })
            goTo(gs.pendingInterrogation ? 'interrogation' : 'prison')
          }}>
            {gs.pendingInterrogation ? t('captured.toInterrogation') : t('captured.toCell')}
          </button>
        </div>
      </div>
    )
  }

  if (outcome === 'fled') {
    return (
      <div className="layout scanlines" style={{ justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', width: '100%' }}>

          <div className="t-center mb8" style={{ letterSpacing: '6px', color: 'var(--cyan)', fontSize: '9px' }}>
            ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
          </div>

          <div className="px-box" style={{ borderColor: 'var(--cyan)', textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '20px', color: 'var(--cyan)', letterSpacing: '4px', marginBottom: '16px' }}>
              {t('fled.title')}
            </div>
            <div className="t-xs t-dim" style={{ lineHeight: '2.2', marginBottom: '16px' }}>
              {t('fled.running')}
              <br />
              {enemy ? t('fled.byEnemy', { name: translateEnemyName(enemy.name) }) : t('fled.genericAdrenaline')}
              <br />
              {t('fled.shipStarts')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('fled.fuel')}</span>
                <span className="t-xs t-cyan">{t('fled.fuelRemaining', { value: gs.fuel })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="t-xs t-dim">{t('fled.fleeCount')}</span>
                <span className="t-xs t-dim">{gs.combatsFled}</span>
              </div>
            </div>
            <div className="t-xs t-dim" style={{ fontStyle: 'italic', marginBottom: '20px' }}>
              {t('fled.flavor')}
            </div>
          </div>

          <div className="t-center mb8" style={{ letterSpacing: '6px', color: 'var(--cyan)', fontSize: '9px' }}>
            ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
          </div>

          <button className="px-btn" onClick={() => {
            patch({ pendingCombatOutcome: null })
            goTo(gs.isImprisoned ? 'prison' : 'station-hub')
          }}>
            {gs.isImprisoned ? t('fled.backToCell') : t('fled.continue')}
          </button>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="layout" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <button className="px-btn" onClick={() => goTo('station-hub')}>{t('back')}</button>
    </div>
  )
}
