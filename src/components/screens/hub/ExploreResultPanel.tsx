import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TypewriterText } from '../../ui/TypewriterText'
import type { GameState } from '../../../types'
import type { ExploreResult, ExploreChoice } from '../../../engine/exploration'
import { getFragment, getFragmentTypeLabels, FRAGMENT_TYPE_COLORS, LORE_TOTAL } from '../../../data/loreFragments'
import { playCollectClue } from '../../../engine/sfx'
import { translateGood } from '../../../engine/goodsI18n'
import { applyCurse, curseMessage, curseHint, isCursed, isPurelyPositive } from '../../../engine/curse'
import { getPassiveMods, drawRelicChoices } from '../../../data/relics'

interface Props {
  gs: GameState
  exploreResult: ExploreResult
  initialResultMsg?: string | null
  onContinue: () => void
  onReturn: () => void
  onStartLockpick: (reward: Partial<GameState>) => void
  patch: (p: Partial<GameState>) => void
}

export function ExploreResultPanel({ gs, exploreResult, initialResultMsg, onContinue, onReturn, onStartLockpick, patch }: Props) {
  const { t } = useTranslation('exploreResultPanel')
  const [resultMsg, setResultMsg] = useState<string | null>(initialResultMsg ?? null)
  const [cursed, setCursed] = useState(false)

  // Maudit : applique la malédiction à un gain, et affiche le message adapté.
  function gagner(update: Partial<GameState>, messageReussite: string) {
    const r = applyCurse(gs, update)
    patch(r.patch)
    setCursed(r.cursed)
    setResultMsg(r.cursed ? curseMessage() + computeDeltas(r.patch) : messageReussite)
  }

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

  function previewDeltas(choice: ExploreChoice): string | null {
    if (choice.hint) return choice.hint
    try {
      const savedRandom = Math.random
      let called = false
      Math.random = () => { called = true; return 0.5 }
      const result = choice.result(gs)
      Math.random = savedRandom
      if (called) return null
      const parts: string[] = []
      const u = result.gs
      if (u.credits !== undefined) { const d = u.credits - gs.credits; if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('creditsUnit')}`) }
      if (u.reputation !== undefined) { const d = u.reputation - gs.reputation; if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('repUnit')}`) }
      if (u.playerHp !== undefined) { const d = u.playerHp - gs.playerHp; if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('hpUnit')}`) }
      if (u.fuel !== undefined) { const d = u.fuel - gs.fuel; if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${t('fuelUnitShort')}`) }
      if (u.isImprisoned) parts.push(t('prison'))
      if ((u as Record<string, unknown>).screen === 'interrogation') parts.push(t('interrogation'))
      if (parts.length > 0 && isCursed(gs) && isPurelyPositive(gs, u)) parts.push(curseHint())
      return parts.length > 0 ? parts.join(', ') : null
    } catch {
      return null
    }
  }

  function applyChoice(choice: ExploreChoice) {
    const result = choice.result(gs)
    if (result.minigame === 'lockpick') {
      onStartLockpick(result.minigameReward ?? {})
      return
    }
    const r = applyCurse(gs, result.gs)
    patch(r.patch)
    setCursed(r.cursed)
    setResultMsg((r.cursed ? curseMessage() : result.message) + computeDeltas(r.patch))
  }

  return (
    <div className="layout">
      <div className="t-xs t-dim t-center">{t('header', { depth: gs.zoneDepth })}</div>

      {'description' in exploreResult && (
        <div className={`px-box ${'rare' in exploreResult && exploreResult.rare ? 'rare-event' : ''}`}>
          {'rare' in exploreResult && exploreResult.rare && (
            <div className="t-xs mb4" style={{ color: 'var(--gold)', letterSpacing: '2px' }}>{t('rareEvent')}</div>
          )}
          <div className="t-sm t-gold mb8">
            <TypewriterText text={exploreResult.description} speed={14} />
          </div>

          {exploreResult.type === 'loot' && !resultMsg && (
            <button className="px-btn px-btn--primary" onClick={() => {
              const e = exploreResult as Extract<ExploreResult, { type: 'loot' }>
              const mult = (gs.pillageBonusActive ? 1.5 : 1) * getPassiveMods(gs).exploreLootMult
              const gained = Math.floor(e.credits * mult)
              // Exploration profonde : une fois sur cinq, le butin cache une relique.
              const cache = gs.zoneDepth >= 5 && !gs.pendingRelicChoice && Math.random() < 0.2
                ? { pendingRelicChoice: { options: drawRelicChoices(gs), source: 'explore' as const } }
                : {}
              gagner({ credits: gs.credits + gained, pillageBonusActive: false, ...cache }, t('lootGained', { amount: gained, pillage: gs.pillageBonusActive ? t('pillageBonus') : '' }))
            }}>
              {t('pickUp', { amount: (exploreResult as Extract<ExploreResult, { type: 'loot' }>).credits, mult: gs.pillageBonusActive ? t('pickUpMult') : '' })}
            </button>
          )}

          {exploreResult.type === 'item' && !resultMsg && (
            <button className="px-btn px-btn--primary" onClick={() => {
              const e = exploreResult as Extract<ExploreResult, { type: 'item' }>
              gagner({ cargo: { ...gs.cargo, [e.item]: (gs.cargo[e.item] ?? 0) + e.qty } }, t('itemGained', { qty: e.qty, item: translateGood(e.item) }))
            }}>
              {t('take', { item: translateGood((exploreResult as Extract<ExploreResult, { type: 'item' }>).item) })}
            </button>
          )}

          {exploreResult.type === 'fuel' && !resultMsg && (
            <button className="px-btn px-btn--primary" onClick={() => {
              const e = exploreResult as Extract<ExploreResult, { type: 'fuel' }>
              gagner({ fuel: Math.min(gs.maxFuel, gs.fuel + e.amount) }, t('fuelGained', { amount: e.amount }))
            }}>
              {t('takeFuel')}
            </button>
          )}

          {'choices' in exploreResult && exploreResult.choices && !resultMsg && (
            <div className="col gap4 mt8">
              {(exploreResult as Extract<ExploreResult, { type: 'event' }>).choices
                .filter((c: ExploreChoice) => !c.available || c.available(gs))
                .map((c: ExploreChoice, i: number) => {
                  const delta = previewDeltas(c)
                  return (
                    <div key={i}>
                      <button className="px-btn" style={{ width: '100%' }} onClick={() => applyChoice(c)}>{c.label}</button>
                      {delta && <div className="t-xs t-dim" style={{ paddingLeft: '8px', marginTop: '2px', fontStyle: 'italic' }}>{delta}</div>}
                    </div>
                  )
                })
              }
            </div>
          )}

          {resultMsg && <div className={`${cursed ? 't-red' : 't-green'} t-sm mt8`}>{resultMsg}</div>}

          {'loreFragmentId' in exploreResult && exploreResult.loreFragmentId && (() => {
            const frag = getFragment(exploreResult.loreFragmentId!)
            if (!frag) return null
            const alreadyKnown = (gs.discoveredLore ?? []).includes(frag.id)
            return (
              <div className="px-box mt8" style={{ borderColor: FRAGMENT_TYPE_COLORS[frag.type], background: 'rgba(0,0,0,0.4)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div className="tag t-xs" style={{ borderColor: FRAGMENT_TYPE_COLORS[frag.type], color: FRAGMENT_TYPE_COLORS[frag.type] }}>
                    {getFragmentTypeLabels()[frag.type]}
                  </div>
                  {alreadyKnown && <span className="t-xs t-dim">{t('alreadyArchived')}</span>}
                </div>
                <div className="t-xs t-bright mb4">{frag.title}</div>
                <div className="t-xs t-dim mb6" style={{ fontStyle: 'italic', fontSize: '9px' }}>{frag.source}</div>
                <div className="t-xs" style={{ lineHeight: '2', color: 'var(--text)' }}>{frag.content}</div>
                {!alreadyKnown && (
                  <button
                    className="px-btn px-btn--sm mt8"
                    style={{ width: 'auto', color: FRAGMENT_TYPE_COLORS[frag.type], borderColor: FRAGMENT_TYPE_COLORS[frag.type] }}
                    onClick={() => {
                      playCollectClue()
                      const newLore = [...(gs.discoveredLore ?? []), frag.id]
                      const cur = gs.pillarStanding ?? { cesarion: 0, raphazarus: 0, eliotis: 0, maxance: 0, alanossa: 0, scotty: 0 }
                      const bonus: Partial<GameState> = {}
                      const pct = newLore.length / LORE_TOTAL
                      const prevPct = (gs.discoveredLore ?? []).length / LORE_TOTAL
                      if (pct >= 0.25 && prevPct < 0.25) { bonus.credits = (gs.credits ?? 0) + 500; bonus.reputation = (gs.reputation ?? 0) + 10 }
                      else if (pct >= 0.50 && prevPct < 0.50) { bonus.credits = (gs.credits ?? 0) + 1000; bonus.reputation = (gs.reputation ?? 0) + 20 }
                      else if (pct >= 0.75 && prevPct < 0.75) { bonus.credits = (gs.credits ?? 0) + 2000; bonus.reputation = (gs.reputation ?? 0) + 30 }
                      else if (pct >= 1.0 && prevPct < 1.0) { bonus.credits = (gs.credits ?? 0) + 5000; bonus.reputation = (gs.reputation ?? 0) + 50 }
                      patch({
                        ...bonus,
                        discoveredLore: newLore,
                        pillarStanding: { ...cur, eliotis: Math.min(100, (cur.eliotis ?? 0) + 2) },
                      })
                    }}
                  >
                    {t('archiveFragment')}
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      <div className="row gap4 mt8">
        <button className="px-btn" style={{ flex: 1 }} onClick={onContinue}>
          {t('continueDepth', { depth: gs.zoneDepth + 1 })}
        </button>
        <button className="px-btn px-btn--danger" style={{ flex: 1 }} onClick={onReturn}>
          {t('returnToStation')}
        </button>
      </div>
    </div>
  )
}
