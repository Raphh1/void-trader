import { useTranslation } from 'react-i18next'
import { questTitle } from '../../../engine/questI18n'
import type { GameState, Quest } from '../../../types'
import { getGossip } from '../../../engine/quests'

interface Props {
  gs: GameState
  questOffer: Quest | null
  addQuest: (q: Quest) => void
  rerollsLeft: number
  onReroll: () => void
  onReturn: () => void
}

export function QuestOfferPanel({ gs, questOffer, addQuest, rerollsLeft, onReroll, onReturn }: Props) {
  const { t } = useTranslation('hubPanels')
  const gossip = getGossip(gs.currentStation)
  const forced = rerollsLeft <= 0

  return (
    <div className="layout">
      <div className="t-xs t-dim t-center">{t('questOffer.header')}</div>

      <div className="px-box">
        <div className="t-xs t-dim mb4">{t('questOffer.gossip')}</div>
        <div className="t-xs" style={{ lineHeight: '2', fontStyle: 'italic' }}>{gossip}</div>
      </div>

      {questOffer ? (
        <div className="px-box px-box--hi">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
            <div className="t-sm t-bright">{questTitle(questOffer)}</div>
            <div className={`tag t-xs ${questOffer.type === 'kill' ? 'tag--red' : questOffer.type === 'delivery' ? 'tag--cyan' : 'tag--dim'}`}>
              {questOffer.type.toUpperCase()}
            </div>
          </div>
          <div className="t-xs" style={{ lineHeight: '2' }}>{questOffer.description}</div>
          <div className="t-xs t-gold mt8">
            {t('questOffer.reward', { credits: questOffer.creditReward.toLocaleString(), rep: questOffer.repReward })}
          </div>
          {forced && (
            <div className="t-xs t-dim mt4" style={{ fontStyle: 'italic' }}>
              {t('questOffer.forced')}
            </div>
          )}
          <div className="row gap4 mt8">
            <button
              className="px-btn px-btn--primary"
              style={{ flex: 1 }}
              onClick={() => { addQuest(questOffer); onReturn() }}
              disabled={gs.activeQuests.length >= 5}
            >
              {t('questOffer.accept')}
            </button>
            {!forced && (
              <button className="px-btn" style={{ flex: 1 }} onClick={onReroll}>
                {t('questOffer.change', { count: rerollsLeft })}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="px-box t-dim t-xs">{t('questOffer.noWork')}</div>
      )}

      {!forced && <button className="px-btn" onClick={onReturn}>{t('back')}</button>}
    </div>
  )
}
