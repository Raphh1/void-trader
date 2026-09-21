import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getClasses } from '../../data/classes'
import { useGameStore } from '../../store/gameStore'
import { useMetaStore } from '../../store/metaStore'
import { getRunModifiers, getRunModifierById } from '../../data/runModifiers'
import { drawRunObjective, getRunObjective } from '../../data/runObjectives'
import { MetaScreen } from './MetaScreen'
import { translateClassName, translateStationName } from '../../engine/goodsI18n'
import { getDailySetup, getDailyBest } from '../../engine/daily'

// Toutes ces fonctions de tirage ne renvoient que des identifiants stables
// (nom de classe / id de modificateur / id d'objectif), jamais les objets
// traduits eux-mêmes — sinon un useState(...) qui les stocke figerait la
// description/le texte dans la langue active au moment du tirage, et ne
// suivrait plus un changement de langue en cours de partie.
function drawHardModifierIds(): string[] {
  const debuffs = getRunModifiers().filter(m => m.tag === 'debuff')
  const shuffled = [...debuffs].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3).map(m => m.id)
}

const TIER_COLOR: Record<string, string> = {
  bad:      'var(--red)',
  balanced: 'var(--text)',
  good:     'var(--gold)',
}
const TAG_COLOR: Record<string, string> = {
  buff:   'var(--green)',
  debuff: 'var(--red)',
  mixed:  'var(--gold)',
}

// Tirage pondéré : le Seigneur de guerre (classe très forte) est rare.
const CLASS_WEIGHTS: Record<string, number> = {
  'Seigneur de guerre': 0.18,
}
function pickRandomClassName(): string {
  const weighted = getClasses().map(c => ({ name: c.name, w: CLASS_WEIGHTS[c.name] ?? 1 }))
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let r = Math.random() * total
  for (const { name, w } of weighted) {
    r -= w
    if (r <= 0) return name
  }
  return weighted[weighted.length - 1].name
}

function drawConditionIds(): { modIds: string[]; objId: string } {
  const shuffled = [...getRunModifiers()].sort(() => Math.random() - 0.5)
  return { modIds: shuffled.slice(0, 2).map(m => m.id), objId: drawRunObjective().id }
}

export function ClassSelect() {
  const { t } = useTranslation('classSelect')
  const TIER_LABEL: Record<string, string> = {
    bad:      t('tier.bad'),
    balanced: t('tier.balanced'),
    good:     t('tier.good'),
  }
  const selectClass   = useGameStore(s => s.selectClass)
  const unlockedIds   = useMetaStore(s => s.meta.unlockedIds)
  const metaPts       = useMetaStore(s => s.availablePoints())

  const [drawnName, setDrawnName]       = useState(pickRandomClassName)
  const [rerolls, setRerolls]           = useState(2)
  const [conditionIds, setConditionIds] = useState(drawConditionIds)
  const [condRerolls, setCondRerolls]   = useState(1)
  const [difficulty, setDifficulty]     = useState<'easy' | 'normal' | 'hard'>('normal')
  const [hardModIds]                    = useState<string[]>(drawHardModifierIds)
  const [showMeta, setShowMeta]         = useState(false)
  const [selectedMeta, setSelectedMeta] = useState<string[]>(() => unlockedIds)

  // Recalculés à chaque rendu à partir des ids stockés — jamais depuis un
  // objet mis en cache — pour que le texte suive un changement de langue.
  const drawn = getClasses().find(c => c.name === drawnName)!
  const hardMods = hardModIds.map(id => getRunModifierById(id)).filter((m): m is NonNullable<typeof m> => !!m)
  const conditions = {
    mods: conditionIds.modIds.map(id => getRunModifierById(id)).filter((m): m is NonNullable<typeof m> => !!m),
    obj: getRunObjective(conditionIds.objId)!,
  }

  const activeMods =
    difficulty === 'easy' ? [] :
    difficulty === 'hard' ? hardMods :
    conditions.mods

  function reroll() {
    if (rerolls <= 0) return
    setDrawnName(pickRandomClassName())
    setRerolls(r => r - 1)
  }

  function rerollConditions() {
    if (condRerolls <= 0) return
    setConditionIds(drawConditionIds())
    setCondRerolls(r => r - 1)
  }

  function toggleMeta(id: string) {
    setSelectedMeta(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  if (showMeta) {
    return (
      <MetaScreen
        onBack={() => setShowMeta(false)}
        selectedForRun={selectedMeta}
        onToggleRun={toggleMeta}
      />
    )
  }

  return (
    <div className="layout scanlines" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        <div className="t-center" style={{ padding: '16px 0 8px' }}>
          <div className="t-xl t-gold" style={{ letterSpacing: '4px' }}>VOID TRADER</div>
          <div className="t-dim t-xs mt4">{t('subtitle')}</div>
        </div>

        {/* Carte de classe */}
        <div className="px-box px-box--hi" style={{ borderColor: drawn.color, marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '28px' }}>{drawn.icon}</span>
            <span className="t-xs" style={{ color: TIER_COLOR[drawn.tier] }}>{TIER_LABEL[drawn.tier]}</span>
          </div>
          <div className="t-lg t-bright mb4" style={{ color: drawn.color }}>{translateClassName(drawn.name)}</div>
          <div className="t-xs" style={{ lineHeight: '2', color: 'var(--text)' }}>{drawn.description}</div>
          <div className="t-xs t-dim mt8">{drawn.bonusDesc}</div>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {drawn.dailyDebt        && <div className="t-xs t-red">{t('warnings.dailyDebt', { amount: drawn.dailyDebt })}</div>}
            {drawn.travelCreditCost && <div className="t-xs t-red">{t('warnings.travelCreditCost', { amount: drawn.travelCreditCost })}</div>}
            {drawn.cargoDegrades    && <div className="t-xs t-red">{t('warnings.cargoDegrades')}</div>}
            {drawn.cursedEvents     && <div className="t-xs t-red">{t('warnings.cursedEvents')}</div>}
            {drawn.piratesDoubled   && <div className="t-xs t-red">{t('warnings.piratesDoubled')}</div>}
            {drawn.cannotBuyWeapons && <div className="t-xs t-red">{t('warnings.cannotBuyWeapons')}</div>}
            {drawn.peacefulBan      && <div className="t-xs t-red">{t('warnings.peacefulBan')}</div>}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <StatRow label={t('stats.credits')}   value={`${drawn.startCredits.toLocaleString()} cr`} color="var(--gold)" />
            <StatRow label={t('stats.fuel')} value={`${drawn.startFuel}/${drawn.maxFuel}`}        color="var(--cyan)" />
            <StatRow label={t('stats.hp')}        value={`${drawn.startHp}`}                           color="var(--green)" />
            <StatRow label={t('stats.stamina')}   value={`${drawn.startStamina}`}                      color="var(--cyan)" />
            <StatRow label={t('stats.station')}   value={translateStationName(drawn.startStation)}      color="var(--text-dim)" />
          </div>
        </div>

        {/* Conditions de run */}
        <div className="px-box" style={{ borderColor: 'var(--border-hi)', marginTop: '12px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div className="t-xs" style={{ letterSpacing: '2px', color: 'var(--text-dim)' }}>{t('runConditionsHeader')}</div>
            {difficulty === 'normal' && (
              <button className="px-btn px-btn--sm" style={{ width: 'auto', fontSize: '9px', opacity: condRerolls > 0 ? 1 : 0.4 }}
                disabled={condRerolls <= 0} onClick={rerollConditions}>
                {t('rerollCount', { count: condRerolls })}
              </button>
            )}
          </div>

          {/* Sélecteur de difficulté */}
          <div className="row gap4 mb10">
            {([
              { id: 'easy',   label: t('difficulty.easy.label'),   desc: t('difficulty.easy.desc'),   color: 'var(--green)' },
              { id: 'normal', label: t('difficulty.normal.label'), desc: t('difficulty.normal.desc'), color: 'var(--text)' },
              { id: 'hard',   label: t('difficulty.hard.label'),   desc: t('difficulty.hard.desc'),   color: 'var(--red)' },
            ] as const).map(d => (
              <button key={d.id} className="px-btn px-btn--sm" style={{
                flex: 1, textAlign: 'center',
                borderColor: difficulty === d.id ? d.color : 'var(--border)',
                color: difficulty === d.id ? d.color : 'var(--text-dim)',
              }} onClick={() => setDifficulty(d.id)}>
                {d.label}
                <div className="t-xs" style={{ fontSize: '8px', opacity: 0.7, marginTop: '2px' }}>{d.desc}</div>
              </button>
            ))}
          </div>

          {/* Modificateurs */}
          {difficulty === 'easy'
            ? <div className="t-xs t-dim t-center" style={{ padding: '8px 0' }}>{t('noModifiers')}</div>
            : <div className="col gap4 mb10">
                {activeMods.map(mod => (
                  <div key={mod.id} className="px-box" style={{ borderColor: TAG_COLOR[mod.tag], padding: '8px 12px', background: 'rgba(0,0,0,0.3)' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div className="t-xs t-bright" style={{ color: mod.color }}>{mod.name}</div>
                      <div className="tag t-xs" style={{ borderColor: TAG_COLOR[mod.tag], color: TAG_COLOR[mod.tag], fontSize: '8px' }}>
                        {mod.tag === 'buff' ? t('tag.buff') : mod.tag === 'debuff' ? t('tag.debuff') : t('tag.mixed')}
                      </div>
                    </div>
                    <div className="t-xs t-dim" style={{ lineHeight: '1.8' }}>{mod.desc}</div>
                  </div>
                ))}
              </div>
          }

          {/* Objectif secret */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <div className="t-xs t-dim mb6" style={{ letterSpacing: '1px' }}>{t('secretObjective')}</div>
            <div className="px-box" style={{ borderColor: 'var(--purple)', padding: '8px 12px', background: 'rgba(160,64,255,0.05)' }}>
              <div className="t-xs t-bright mb4" style={{ color: 'var(--purple)' }}>{conditions.obj.name}</div>
              <div className="t-xs t-dim" style={{ lineHeight: '1.8' }}>{conditions.obj.desc}</div>
              <div className="t-xs mt4" style={{ color: 'var(--gold)' }}>{t('objectiveReward', { pts: conditions.obj.metaPointReward })}</div>
            </div>
          </div>
        </div>

        {/* Défi du jour : mêmes tirages de départ pour tout le monde aujourd'hui */}
        {(() => {
          const defi = getDailySetup()
          const cls = getClasses().find(c => c.name === defi.className)!
          const mods = defi.modIds.map(id => getRunModifierById(id)).filter((m): m is NonNullable<typeof m> => !!m)
          const record = getDailyBest(defi.date)
          return (
            <div className="px-box mt12" style={{ borderColor: 'var(--gold)', background: 'rgba(255,200,0,0.04)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div className="t-xs" style={{ color: 'var(--gold)', letterSpacing: '2px' }}>{t('daily.title', { date: defi.date })}</div>
                <div className="t-xs t-dim">{record !== null ? t('daily.best', { score: record.toLocaleString() }) : t('daily.noBest')}</div>
              </div>
              <div className="t-xs" style={{ lineHeight: 1.9 }}>
                <span style={{ color: cls.color }}>{cls.icon} {translateClassName(cls.name)}</span>
                <span className="t-dim"> · {mods.map(m => m.name).join(' · ')}</span>
              </div>
              <div className="t-xs t-dim mb8" style={{ lineHeight: 1.8 }}>{t('daily.rules')}</div>
              <button className="px-btn" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
                onClick={() => selectClass(cls, mods, [], defi.date)}>
                {t('daily.start')}
              </button>
            </div>
          )
        })()}

        {/* Boutons */}
        <div className="col gap4 mt12">
          <button className="px-btn px-btn--primary" onClick={() => selectClass(drawn, activeMods, selectedMeta)}>
            {t('start', { name: translateClassName(drawn.name).toUpperCase() })}
          </button>
          <button className="px-btn" onClick={reroll} disabled={rerolls <= 0}
            style={{ color: rerolls > 0 ? 'var(--text-dim)' : undefined }}>
            {rerolls > 0 ? t('rerollClass', { count: rerolls }) : t('noRerollsLeft')}
          </button>
          <button className="px-btn" style={{ borderColor: 'var(--purple)', color: 'var(--purple)' }} onClick={() => setShowMeta(true)}>
            {t('legacyButton')}
            {metaPts > 0 && <span className="t-xs" style={{ marginLeft: '8px', color: 'var(--gold)' }}>{t('ptsToSpend', { pts: metaPts })}</span>}
            {selectedMeta.length > 0 && <span className="t-xs t-dim" style={{ marginLeft: '8px' }}>{t('activeCount', { count: selectedMeta.length })}</span>}
          </button>
        </div>

        <div className="t-center t-xs t-dim mt12">
          <span className="blink">_</span> {t('footer')}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
      <span className="t-xs t-dim">{label}</span>
      <span className="t-xs" style={{ color }}>{value}</span>
    </div>
  )
}
