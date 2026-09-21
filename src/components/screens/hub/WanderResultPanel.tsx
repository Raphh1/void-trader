import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TypewriterText } from '../../ui/TypewriterText'
import type { GameState, Quest, Enemy } from '../../../types'
import type { WanderEvent } from '../../../engine/exploration'
import { rollWanderEvent } from '../../../engine/exploration'
import { applyCurse, curseMessage, curseHint, isCursed, isPurelyPositive } from '../../../engine/curse'
import { getEnemyByTier } from '../../../data/enemies'

interface Props {
  gs: GameState
  wanderEvent: WanderEvent
  dangerLevel: number
  onReturn: () => void
  startCombat: (e: Enemy) => void
  patch: (p: Partial<GameState>) => void
  addQuest: (q: Quest) => void
  spendAction: () => void
  onWanderAgain: (next: WanderEvent) => void
  onNegotiation?: () => void
  onNavigation?: () => void
}

export function WanderResultPanel({ gs, wanderEvent, dangerLevel, onReturn, startCombat, patch, addQuest, spendAction, onWanderAgain, onNegotiation, onNavigation }: Props) {
  const { t } = useTranslation('wanderResultPanel')
  const [resultMsg, setResultMsg] = useState<string | null>(null)
  const [cursed, setCursed] = useState(false)

  useEffect(() => { setResultMsg(null); setCursed(false) }, [wanderEvent])

  function computeDeltas(update: Partial<GameState>): string {
    const parts: string[] = []
    if (update.credits !== undefined) {
      const d = update.credits - gs.credits
      if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('creditsUnit')}`)
    }
    if (update.reputation !== undefined) {
      const d = update.reputation - gs.reputation
      if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('repUnit')}`)
    }
    if (update.playerHp !== undefined) {
      const d = update.playerHp - gs.playerHp
      if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('hpUnit')}`)
    }
    if (update.fuel !== undefined) {
      const d = update.fuel - gs.fuel
      if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('fuelUnit')}`)
    }
    return parts.length > 0 ? ` · [${parts.join(', ')}]` : ''
  }

  function previewDeltas(c: WanderEvent['choices'][number]): string | null {
    if (c.hint) return c.hint
    try {
      const savedRandom = Math.random
      let called = false
      Math.random = () => { called = true; return 0.5 }
      const res = c.result(gs)
      Math.random = savedRandom
      if (called || !res.gs) return null
      const u = res.gs as Partial<GameState>
      const parts: string[] = []
      if (u.credits !== undefined) { const d = u.credits - gs.credits; if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('creditsUnit')}`) }
      if (u.reputation !== undefined) { const d = u.reputation - gs.reputation; if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('repUnit')}`) }
      if (u.playerHp !== undefined) { const d = u.playerHp - gs.playerHp; if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('hpUnit')}`) }
      if (u.fuel !== undefined) { const d = u.fuel - gs.fuel; if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('fuelUnitShort')}`) }
      if (u.isImprisoned) parts.push(t('prison'))
      if (parts.length > 0 && isCursed(gs) && isPurelyPositive(gs, u)) parts.push(curseHint())
      return parts.length > 0 ? parts.join(', ') : null
    } catch {
      return null
    }
  }

  function handleChoice(c: WanderEvent['choices'][number]) {
    const res = c.result(gs)
    if (res.type === 'combat') {
      const tier = dangerLevel >= 3 ? 3 : dangerLevel >= 2 ? 2 : 1
      startCombat(getEnemyByTier(tier as 1 | 2 | 3))
      return
    }
    if (res.type === 'negotiation') {
      onNegotiation?.()
      return
    }
    if (res.type === 'navigation') {
      onNavigation?.()
      return
    }
    const brut = res.gs as Partial<GameState> | undefined
    const r = brut ? applyCurse(gs, brut) : { patch: undefined, cursed: false }
    const update = r.patch
    if (update) patch(update)
    if (res.quest && gs.activeQuests.length < 5) addQuest(res.quest)
    const deltas = update ? computeDeltas(update) : ''
    setCursed(r.cursed)
    setResultMsg((r.cursed ? curseMessage() : res.message) + deltas + (res.quest ? t('questAdded', { title: res.quest.title }) : ''))
  }

  function handleWanderAgain() {
    spendAction()
    onWanderAgain(rollWanderEvent(gs))
    setResultMsg(null)
  }

  return (
    <div className="layout">
      <div className="t-xs t-dim t-center">{t('header')}</div>
      <div className="px-box">
        <div className="t-sm t-gold mb4">{wanderEvent.title}</div>
        <div className="t-xs mb8" style={{ lineHeight: '2.2' }}>
          <TypewriterText text={wanderEvent.description} speed={16} />
        </div>
        {resultMsg
          ? <div className="t-xs mt4" style={{ color: cursed ? 'var(--red)' : 'var(--green)', lineHeight: '2' }}>{resultMsg}</div>
          : <div className="col gap4">
              {wanderEvent.choices
                .filter(c => !c.available || c.available(gs))
                .map((c, i) => {
                  const delta = previewDeltas(c)
                  return (
                    <div key={i}>
                      <button className="px-btn" style={{ width: '100%' }} onClick={() => handleChoice(c)}>{c.label}</button>
                      {delta && <div className="t-xs t-dim" style={{ paddingLeft: '8px', marginTop: '2px', fontStyle: 'italic' }}>{delta}</div>}
                    </div>
                  )
                })}
            </div>
        }
      </div>
      <div className="row gap4">
        {resultMsg && (
          <button className="px-btn px-btn--primary" style={{ flex: 1 }} onClick={handleWanderAgain}>
            {t('wanderAgain')}
          </button>
        )}
        <button className="px-btn" style={{ flex: 1 }} onClick={onReturn}>
          {t('backToHub')}
        </button>
      </div>
    </div>
  )
}
