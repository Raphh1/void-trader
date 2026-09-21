import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { playEquip } from '../../engine/sfx'
import { translateGood, translateWeaponName, translateArmorName } from '../../engine/goodsI18n'
import { getArmors } from '../../data/armors'

export function InventoryScreen() {
  const { t } = useTranslation('inventoryScreen')
  const gs          = useGameStore(s => s.gs!)
  const goTo        = useGameStore(s => s.goTo)
  const equipWeapon = useGameStore(s => s.equipWeapon)
  const unequipWeapon = useGameStore(s => s.unequipWeapon)
  const equipArmor  = useGameStore(s => s.equipArmor)
  const unequipArmor  = useGameStore(s => s.unequipArmor)

  return (
    <div className="layout">
      <div className="row" style={{ alignItems: 'center', gap: '16px' }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>{t('back')}</button>
        <div className="t-sm t-bright">{t('title')}</div>
      </div>

      {/* Cargo */}
      {Object.keys(gs.cargo).length > 0 && (
        <div className="px-box" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="t-xs t-dim">{t('cargoHold', { count: Object.keys(gs.cargo).length, plural: Object.keys(gs.cargo).length > 1 ? 's' : '' })}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(gs.cargo).map(([item, qty]) => (
              <div key={item} className="tag t-xs" style={{ borderColor: item === 'Passager' ? 'var(--gold)' : 'var(--cyan)', color: item === 'Passager' ? 'var(--gold)' : 'var(--cyan)' }}>
                {translateGood(item)} ×{qty}
              </div>
            ))}
          </div>
        </div>
      )}
      {Object.keys(gs.cargo).length === 0 && (
        <div className="px-box t-dim t-xs">{t('cargoEmpty')}</div>
      )}

      <div className="grid2">
        {/* Weapons */}
        <div className="col list-zebra">
          <div className="t-xs t-dim">{t('weapons', { count: gs.weapons.length })}</div>
          {gs.weapons.length === 0 && <div className="px-box t-dim t-xs">{t('noWeapon')}</div>}
          {gs.weapons.map((w, i) => {
            const equipped = gs.equippedWeapon?.name === w.name
            return (
              <div key={i} className={`px-box ${equipped ? 'px-box--act' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="t-sm t-orange">{translateWeaponName(w.name)}</span>
                  <span className={`tag tier-${w.tier} t-xs`}>Tier {w.tier}</span>
                </div>
                <div className="t-xs t-dim">
                  {t('damage', { min: w.damageMin, max: w.damageMax, crit: w.critChance })}
                </div>
                {w.effect !== 'none' && (
                  <div className="t-xs t-purple" style={{ color: 'var(--purple)' }}>
                    {w.effectDesc} ({w.effectChance}%)
                  </div>
                )}
                {w.selfDmgChance > 0 && (
                  <div className="t-xs t-red">{t('selfDamage', { value: w.selfDmgChance, min: w.selfDmgMax/2, max: w.selfDmgMax })}</div>
                )}
                <button
                  className={`px-btn px-btn--sm ${equipped ? 'px-btn--danger' : 'px-btn--primary'}`}
                  onClick={() => { if (!equipped) playEquip(); equipped ? unequipWeapon() : equipWeapon(i) }}
                >
                  {equipped ? t('unequip') : t('equip')}
                </button>
              </div>
            )
          })}
        </div>

        {/* Armors */}
        <div className="col list-zebra">
          <div className="t-xs t-dim">{t('armors', { count: gs.armors.length })}</div>
          {gs.armors.length === 0 && <div className="px-box t-dim t-xs">{t('noArmor')}</div>}
          {gs.armors.map((a, i) => {
            const equipped = gs.equippedArmor?.name === a.name
            return (
              <div key={i} className={`px-box ${equipped ? 'px-box--act' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="t-sm" style={{ color: 'var(--blue)' }}>{translateArmorName(a.name)}</span>
                  <span className={`tag tier-${a.tier} t-xs`} style={{ color: 'var(--blue)', borderColor: '#224488' }}>Tier {a.tier}</span>
                </div>
                <div className="t-xs t-dim">
                  {t('defense', { value: a.defense })}
                  {a.hpBonus > 0 && t('hpBonus', { value: a.hpBonus })}
                </div>
                {a.effect !== 'none' && (
                  <div className="t-xs t-cyan">
                    {a.effect === 'regen'        && t('armorEffect.regen', { value: a.effectValue })}
                    {a.effect === 'thorns'       && t('armorEffect.thorns', { value: a.effectValue })}
                    {a.effect === 'immunity'     && t('armorEffect.immunity')}
                    {a.effect === 'staminaBoost' && t('armorEffect.staminaBoost', { value: a.effectValue })}
                  </div>
                )}
                <div className="t-xs t-dim">{getArmors().find(x => x.name === a.name)?.description ?? a.description}</div>
                <button
                  className={`px-btn px-btn--sm ${equipped ? 'px-btn--danger' : 'px-btn--primary'}`}
                  onClick={() => { if (!equipped) playEquip(); equipped ? unequipArmor() : equipArmor(i) }}
                >
                  {equipped ? t('unequip') : t('equip')}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
