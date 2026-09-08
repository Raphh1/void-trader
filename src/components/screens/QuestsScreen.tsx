import { useTranslation } from 'react-i18next'
import { questTitle, questDescription } from '../../engine/questI18n'
import type { TFunction } from 'i18next'
import { useGameStore } from '../../store/gameStore'
import { getNamedNpcs } from '../../engine/npcTracker'
import { getStationsSellingItem, getStation } from '../../data/stations'
import { BOSS_TRIGGER_TYPES, CRAFTED_DELIVERY_ITEMS } from '../../engine/quests'
import { getRecipeForItem } from '../../data/recipes'
import type { MajorQuestCondition, QuestType, GameState } from '../../types'
import { translateGood, translateEnemyName, translateStationName } from '../../engine/goodsI18n'

function stageDestination(cond: MajorQuestCondition, t: TFunction): string | null {
  switch (cond.type) {
    case 'visitStation': return cond.station
    case 'winCombatAt':  return cond.station
    case 'meetNpc':      return getNamedNpcs().find(n => n.name === cond.npcName)?.station ?? null
    case 'hasFaction':   return t('joinFaction', { faction: cond.faction })
    case 'bossKill':     return t('defeatBoss', { boss: translateEnemyName(cond.bossName) })
    default:             return null
  }
}

const TYPE_CLASS: Record<string, string> = {
  delivery:   'tag--cyan',
  kill:       'tag--red',
  revenge:    'tag--orange',
  escort:     'tag--green',
  sabotage:   'tag--red',
  heist:      'tag--purple',
  extraction: 'tag--cyan',
  bounty:     'tag--gold',
  patrol:     'tag--dim',
}

function bossGuidance(q: { type: QuestType; targetStation: string }, gs: GameState, isAtTarget: boolean, t: TFunction) {
  if (!BOSS_TRIGGER_TYPES.includes(q.type)) return null
  const station = getStation(q.targetStation)
  const tooSafe = station.danger < 2

  if (!isAtTarget) {
    return (
      <div className="t-xs" style={{ color: 'var(--cyan)', lineHeight: 1.8 }}>
        {t('guideNotAtTarget').split(t('explore')).map((part, i, arr) => (
          <span key={i}>{part}{i < arr.length - 1 && <span className="t-bright">{t('explore')}</span>}</span>
        ))}
      </div>
    )
  }

  if (tooSafe) {
    return (
      <div className="t-xs t-red" style={{ lineHeight: 1.8 }}>
        {t('tooSafe', { danger: station.danger })}
      </div>
    )
  }

  const depth = gs.zoneDepth ?? 0
  const fights = gs.explorationFightsDone ?? 0
  const depthReady = depth >= 7
  const fightsReady = fights >= 3
  return (
    <div className="t-xs" style={{ lineHeight: 1.8 }}>
      <div style={{ color: 'var(--cyan)' }}>
        {t('guideAtTarget').split(t('explore')).map((part, i, arr) => (
          <span key={i}>{part}{i < arr.length - 1 && <span className="t-bright">{t('explore')}</span>}</span>
        ))}
      </div>
      <div style={{ color: depthReady ? 'var(--green)' : 'var(--orange)' }}>
        {t('depthProgress', { depth, status: depthReady ? t('depthReady') : t('depthNotReady') })}
      </div>
      <div style={{ color: fightsReady ? 'var(--green)' : 'var(--orange)' }}>
        {t('fightsProgress', { fights, status: fightsReady ? t('fightsReady') : t('fightsNotReady') })}
      </div>
      {depthReady && fightsReady && (
        <div className="t-green">{t('conditionsMet')}</div>
      )}
    </div>
  )
}

export function QuestsScreen() {
  const { t } = useTranslation('questsScreen')
  const TYPE_LABEL = t('typeLabels', { returnObjects: true }) as unknown as Record<string, string>
  const TYPE_COMPLETE_HINT = t('completeHint', { returnObjects: true }) as unknown as Record<string, string>
  const gs   = useGameStore(s => s.gs!)
  const goTo = useGameStore(s => s.goTo)

  return (
    <div className="layout">
      <div className="row" style={{ alignItems: 'center', gap: '16px' }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>{t('back')}</button>
        <div className="t-sm t-bright">{t('activeQuests', { count: gs.activeQuests.length })}</div>
        {gs.majorQuests.filter(q => !q.completed && !q.failed).length > 0 && (
          <div className="tag tag--purple t-xs">{t('majorMissionsTag', { count: gs.majorQuests.filter(q => !q.completed && !q.failed).length, plural: gs.majorQuests.filter(q => !q.completed && !q.failed).length > 1 ? 's' : '' })}</div>
        )}
        <div className="t-xs t-dim">{t('completedCount', { count: gs.completedQuestIds.length })}</div>
      </div>

      {gs.activeQuests.length === 0 && (
        <div className="px-box t-dim t-xs">
          {t('noActiveQuest')}
        </div>
      )}

      {/* ── QUÊTES MAJEURES ─────────────────────────────────────── */}
      {gs.majorQuests.length > 0 && (
        <div className="col gap4">
          <div className="t-xs t-dim" style={{ letterSpacing: '0.1em' }}>{t('majorMissionsHeader', { count: gs.majorQuests.filter(q => !q.completed && !q.failed).length })}</div>
          {gs.majorQuests.map(mq => {
            const stage = mq.stages[mq.currentStage]
            const pct = Math.round((mq.currentStage / mq.stages.length) * 100)
            return (
              <div key={mq.id} className="px-box" style={{
                borderColor: mq.completed ? 'var(--green)' : mq.failed ? 'var(--red)' : 'var(--purple)',
                background: mq.completed ? '#0a1a0a' : mq.failed ? '#1a0808' : '#0d0a18',
              }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div className="t-sm" style={{ color: mq.completed ? 'var(--green)' : mq.failed ? 'var(--red)' : 'var(--purple)', flex: 1, marginRight: '8px' }}>
                    {mq.completed ? '★★ ' : mq.failed ? '✗ ' : '◆◆ '}{mq.title}
                  </div>
                  <div className="tag t-xs" style={{ borderColor: 'var(--purple)', color: 'var(--purple)' }}>
                    {mq.completed ? t('accomplished') : mq.failed ? t('failed') : t('stageOf', { current: mq.currentStage, total: mq.stages.length })}
                  </div>
                </div>

                <div className="t-xs t-dim mb8" style={{ lineHeight: '1.8', fontStyle: 'italic' }}>
                  {mq.lore.slice(0, 120)}{mq.lore.length > 120 ? '…' : ''}
                </div>

                {!mq.completed && !mq.failed && stage && (
                  <>
                    <div className="t-xs t-bright mb4" style={{ borderLeft: '2px solid var(--purple)', paddingLeft: '8px' }}>
                      {t('stageLabel', { num: mq.currentStage + 1, title: stage.title })}
                    </div>
                    <div className="t-xs mb4" style={{ lineHeight: '1.8' }}>{stage.description}</div>
                    <div className="t-xs t-cyan mb4">
                      ▶ {stage.objective}
                    </div>
                    {(() => {
                      const dest = stageDestination(stage.condition, t)
                      if (!dest) return null
                      const isHere = gs.currentStation === dest
                      return (
                        <div className="t-xs mb8" style={{ color: isHere ? 'var(--green)' : 'var(--gold)', fontWeight: 'bold' }}>
                          {isHere ? t('youAreHere') : t('destination', { station: translateStationName(dest) })}
                        </div>
                      )
                    })()}
                  </>
                )}

                {/* Barre de progression */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ flex: 1, height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: mq.completed ? 'var(--green)' : 'var(--purple)', transition: 'width 0.3s' }} />
                  </div>
                  <div className="t-xs t-dim">{pct}%</div>
                </div>

                {/* Étapes résumé */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {mq.stages.map((s, i) => (
                    <div key={s.id} className="t-xs" style={{
                      padding: '1px 5px',
                      borderRadius: '2px',
                      background: i < mq.currentStage ? 'var(--purple)' : i === mq.currentStage ? 'rgba(140,80,220,0.3)' : 'var(--surface)',
                      color: i < mq.currentStage ? '#fff' : i === mq.currentStage ? 'var(--purple)' : 'var(--text-dim)',
                      border: `1px solid ${i === mq.currentStage ? 'var(--purple)' : 'transparent'}`,
                    }}>
                      {i + 1}
                    </div>
                  ))}
                </div>

                <div className="t-xs t-dim mt8">
                  {t('givenByPrefix')} <span className="t-bright">{mq.giver}</span> {t('givenByMiddle')} <span style={{ color: 'var(--cyan)' }}>{translateStationName(mq.giverStation)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── QUÊTES SIMPLES ──────────────────────────────────────── */}
      {gs.activeQuests.length > 0 && <div className="t-xs t-dim" style={{ letterSpacing: '0.1em' }}>{t('contracts', { count: gs.activeQuests.length })}</div>}
      <div className="col gap4">
        {gs.activeQuests.map(q => {
          const isAtTarget = gs.currentStation === q.targetStation
          const isAtGiver  = gs.currentStation === q.giverStation
          const hasItem    = q.targetItem ? (gs.cargo[q.targetItem] ?? 0) > 0 : false
          const hasPassenger = (gs.cargo['Passager'] ?? 0) > 0

          let statusColor = 'var(--text-dim)'
          let statusText  = `→ ${translateStationName(q.targetStation)}`
          if (q.type === 'extraction') {
            if (!hasItem) statusText = t('toAcquire', { item: q.targetItem ? translateGood(q.targetItem) : q.targetItem })
            else if (hasItem && !isAtGiver) statusText = t('bringBackTo', { station: translateStationName(q.giverStation) })
            else if (hasItem && isAtGiver) { statusText = t('readyHere'); statusColor = 'var(--green)' }
          } else if (isAtTarget) {
            statusText = t('completeHere')
            statusColor = 'var(--gold)'
          }

          return (
            <div key={q.id} className="px-box">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div className="t-sm t-bright" style={{ flex: 1, marginRight: '8px' }}>{questTitle(q)}</div>
                <div className={`tag t-xs ${TYPE_CLASS[q.type]}`}>{TYPE_LABEL[q.type]}</div>
              </div>

              <div className="t-xs" style={{ lineHeight: '2', marginBottom: '8px' }}>{questDescription(q)}</div>

              <div className="t-xs t-dim" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>
                  {t('givenByPrefix')} <span className="t-bright">{q.giver}</span> {t('givenByMiddle')} <span className="t-cyan">{translateStationName(q.giverStation)}</span>
                </div>
                <div style={{ color: statusColor }}>{statusText}</div>
                <div className="t-dim" style={{ fontStyle: 'italic', fontSize: '7px' }}>
                  {TYPE_COMPLETE_HINT[q.type]}
                </div>
                {bossGuidance(q, gs, isAtTarget, t)}
                {q.targetItem && q.type !== 'extraction' && (() => {
                  const sellers = !hasItem && q.type !== 'escort' ? getStationsSellingItem(q.targetItem!) : []
                  return (
                    <div>
                      {t('requiredItem')} <span className="t-orange">{q.targetItem ? translateGood(q.targetItem) : q.targetItem}</span>
                      {' '}
                      {hasItem
                        ? <span className="t-green">{t('inCargo')}</span>
                        : q.type === 'escort'
                          ? hasPassenger ? <span className="t-green">{t('passengerAboard')}</span> : <span className="t-red">{t('passengerNotAboard')}</span>
                          : <span className="t-red">{t('toBeAcquired')}</span>
                      }
                      {sellers.length > 0 && (
                        <div style={{ marginTop: '3px', color: 'var(--cyan)', fontSize: '8px' }}>
                          {t('buyableAt', { list: sellers.slice(0, 4).map(translateStationName).join(', ') + (sellers.length > 4 ? '…' : '') })}
                        </div>
                      )}
                      {!hasItem && sellers.length === 0 && CRAFTED_DELIVERY_ITEMS.includes(q.targetItem!) && (() => {
                        const recipe = getRecipeForItem(q.targetItem!)
                        return (
                          <div style={{ marginTop: '3px', color: 'var(--purple)', fontSize: '8px' }}>
                            {t('craftOnly')}
                            {recipe && (
                              <div style={{ marginTop: '2px' }}>
                                {t('ingredients', { list: Object.entries(recipe.ingredients).map(([item, qty]) => {
                                  const have = gs.cargo[item] ?? 0
                                  return `${translateGood(item)} ${have}/${qty}`
                                }).join(', ') })}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}
                {q.type === 'extraction' && q.targetItem && (() => {
                  const sellers = !hasItem ? getStationsSellingItem(q.targetItem!) : []
                  return (
                    <div>
                      {t('toRetrieve')} <span className="t-orange">{q.targetItem ? translateGood(q.targetItem) : q.targetItem}</span>
                      {' '}
                      {hasItem ? <span className="t-green">{t('inCargo')}</span> : <span className="t-dim">{t('notRetrievedYet')}</span>}
                      {sellers.length > 0 && !hasItem && (
                        <div style={{ marginTop: '3px', color: 'var(--cyan)', fontSize: '8px' }}>
                          {t('buyableAt', { list: sellers.slice(0, 4).map(translateStationName).join(', ') + (sellers.length > 4 ? '…' : '') })}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="t-xs t-gold mt8">
                {t('reward', { credits: q.creditReward.toLocaleString() })}
                {q.repReward > 0 ? t('repSuffix', { value: q.repReward }) : q.repReward < 0 ? t('repSuffix', { value: q.repReward }) : ''}
                {(q.dayMult ?? 1) >= 1.1 && (
                  <span style={{ color: 'var(--orange)', marginLeft: '8px', fontStyle: 'normal' }}>
                    ×{(q.dayMult ?? 1).toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
