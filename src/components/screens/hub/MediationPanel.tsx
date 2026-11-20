import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../../store/gameStore'
import { questDescription } from '../../../engine/questI18n'
import { mediationPersuadeChance, mediationBribe, mediationPaidQuest } from '../../../engine/quests'
import { getEnemyForStation, scaleEnemy } from '../../../data/enemies'
import { translateStationName } from '../../../engine/goodsI18n'
import type { GameState, Quest } from '../../../types'

interface Props {
  gs: GameState
  quest: Quest
  onDone: () => void
}

export function MediationPanel({ gs, quest, onDone }: Props) {
  const { t } = useTranslation('stationHub')
  const patch               = useGameStore(s => s.patch)
  const spendAction         = useGameStore(s => s.spendAction)
  const manualCompleteQuest = useGameStore(s => s.manualCompleteQuest)
  const startCombat         = useGameStore(s => s.startCombat)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  const chance = mediationPersuadeChance(gs)
  const bribe  = mediationBribe(quest)

  function persuade() {
    spendAction()
    if (Math.random() < chance) {
      manualCompleteQuest(quest.id)
      setResult({ text: t('mediation.persuadeSuccess'), ok: true })
    } else {
      const current = useGameStore.getState().gs!
      patch({
        reputation: current.reputation - 5,
        activeQuests: current.activeQuests.map(q => q.id === quest.id ? { ...q, persuasionFailed: true } : q),
      })
      setResult({ text: t('mediation.persuadeFail'), ok: false })
    }
  }

  function pay() {
    spendAction()
    const current = useGameStore.getState().gs!
    patch({
      credits: current.credits - bribe,
      activeQuests: current.activeQuests.map(q => q.id === quest.id ? mediationPaidQuest(q) : q),
    })
    manualCompleteQuest(quest.id)
    setResult({ text: t('mediation.paid'), ok: true })
  }

  function force() {
    spendAction()
    const enforcer = scaleEnemy(getEnemyForStation(quest.targetStation, 4, gs.day), 2)
    startCombat({ ...enforcer, questId: quest.id })
  }

  return (
    <div className="layout">
      <div className="px-box px-box--hi" style={{ borderColor: 'var(--gold)' }}>
        <div className="t-xs mb8" style={{ color: 'var(--gold)', letterSpacing: '2px' }}>{t('mediation.header', { target: translateStationName(quest.targetStation) })}</div>
        <div className="t-xs mb8" style={{ lineHeight: 2 }}>{questDescription(quest)}</div>
        <div className="t-xs t-dim" style={{ lineHeight: 1.8, fontStyle: 'italic' }}>{t('mediation.scene')}</div>
      </div>

      {result ? (
        <>
          <div className="px-box t-xs" style={{ lineHeight: 1.8, borderColor: result.ok ? 'var(--green)' : 'var(--red)', color: result.ok ? 'var(--green)' : 'var(--red)' }}>{result.text}</div>
          <button className="px-btn" onClick={onDone}>{t('mediation.continue')}</button>
        </>
      ) : (
        <div className="col gap4">
          <button className="px-btn" disabled={quest.persuasionFailed} onClick={persuade}>
            {quest.persuasionFailed ? t('mediation.persuadeUsed') : t('mediation.persuade', { pct: Math.round(chance * 100) })}
          </button>
          <button className="px-btn" disabled={gs.credits < bribe} onClick={pay}>
            {gs.credits < bribe ? t('mediation.payTooExpensive', { amount: bribe.toLocaleString() }) : t('mediation.pay', { amount: bribe.toLocaleString() })}
          </button>
          <button className="px-btn px-btn--danger" onClick={force}>{t('mediation.force')}</button>
          <button className="px-btn" onClick={onDone}>{t('mediation.later')}</button>
        </div>
      )}
    </div>
  )
}
