import { useTranslation } from 'react-i18next'
import { TypewriterText } from '../../ui/TypewriterText'
import type { GameState } from '../../../types'
import type { NamedNpcDef as NamedNpc } from '../../../engine/npcTracker'
import { getNpcReaction, getNpcGreeting, recordMeeting, getNpcService } from '../../../engine/npcTracker'
import { getMajorQuestForNpc } from '../../../engine/majorQuests'
import { getPillarRumor } from '../../../engine/npcLore'
import { translateNpcRole } from '../../../engine/goodsI18n'

interface Props {
  gs: GameState
  localNpc: NamedNpc
  npcDialogResult: string | null
  onDialogResult: (msg: string) => void
  onCardGame: () => void
  onBack: () => void
  patch: (p: Partial<GameState>) => void
  startCombat: (enemy: import('../../../types').Enemy) => void
  advanceMajorQuests: () => void
  spendAction: () => void
}

const REACTION_COLOR: Record<string, string> = {
  ally: 'var(--gold)', friendly: 'var(--green)', warm: 'var(--cyan)',
  neutral: 'var(--text-dim)', cold: 'var(--orange)', hostile: 'var(--red)',
}

const DECISION_CALLBACK_KEYS: Array<{ decision: string; key: string }> = [
  { decision: 'escaped-interrogation',     key: 'escapedInterrogation' },
  { decision: 'betrayed-at-interrogation', key: 'betrayedAtInterrogation' },
  { decision: 'cooperated-interrogation',  key: 'cooperatedInterrogation' },
  { decision: 'aided-scientist',           key: 'aidedScientist' },
  { decision: 'saved-mercenary',           key: 'savedMercenary' },
  { decision: 'defector-network',          key: 'defectorNetwork' },
]

export function NpcEncounterPanel({ gs, localNpc, npcDialogResult, onDialogResult, onCardGame, onBack, patch, startCombat, advanceMajorQuests, spendAction }: Props) {
  const { t } = useTranslation('npcEncounterPanel')
  const npcState   = gs.knownNpcs[localNpc.id]
  const reaction   = npcState ? getNpcReaction(npcState, gs) : 'neutral'
  const greeting   = npcState ? getNpcGreeting(npcState, reaction, gs) : t('defaultGreeting', { name: localNpc.name })
  const timesMet   = npcState?.timesMet ?? 0
  const service    = getNpcService(localNpc.role)
  const serviceUsed = (npcState?.lastServiceDay ?? -1) === gs.day
  const talkUsed    = (npcState?.lastTalkDay   ?? -1) === gs.day

  function openNpc() {
    const base = npcState ?? { id: localNpc.id, name: localNpc.name, station: localNpc.station, firstMetDay: gs.day, timesMet: 0, repDelta: 0, isAlly: false, isEnemy: false, tags: [] }
    const updated = recordMeeting(base)
    const names = new Set(gs.npcsMet)
    names.add(localNpc.name)
    patch({ knownNpcs: { ...gs.knownNpcs, [localNpc.id]: updated }, npcsMet: Array.from(names) })
    advanceMajorQuests()
  }

  function patchNpc(extra: Record<string, unknown>) {
    const base = npcState ?? { id: localNpc.id, name: localNpc.name, station: localNpc.station, firstMetDay: gs.day, timesMet: 0, repDelta: 0, isAlly: false, isEnemy: false, tags: [] }
    patch({ knownNpcs: { ...gs.knownNpcs, [localNpc.id]: { ...base, ...extra } } })
  }

  function handleTalk() {
    const base = npcState ?? { id: localNpc.id, name: localNpc.name, station: localNpc.station, firstMetDay: gs.day, timesMet: 0, repDelta: 0, isAlly: false, isEnemy: false, tags: [] }
    const updated = recordMeeting({ ...base, lastTalkDay: gs.day })
    const names = new Set(gs.npcsMet)
    names.add(localNpc.name)

    const rep = base.repDelta ?? 0
    const decisions = gs.pastDecisions ?? []

    // Callbacks narratifs (T7) — réactions basées sur les décisions passées
    const matchedCallback = DECISION_CALLBACK_KEYS.find(cb => decisions.includes(cb.decision))

    // Sélection du dialogue de base
    const lorelines = t(`npcLore.${localNpc.id}`, { returnObjects: true, defaultValue: null }) as unknown as string[] | null
    const useLoRe = lorelines && Math.random() < 0.65
    const usePillarRumor = !lorelines && Math.random() < 0.30
    const pool = useLoRe
      ? lorelines
      : (t(`talkLines.${localNpc.role}`, { returnObjects: true, defaultValue: [t('genericTalkLine')] }) as unknown as string[])
    const baseLine = usePillarRumor ? getPillarRumor() : pool[base.timesMet % pool.length]

    // Préfixe callback si une décision connue est détectée (30% de chance de trigger)
    const callbackPrefix = matchedCallback && Math.random() < 0.30
      ? t(`decisionCallbacks.${matchedCallback.key}`) + '\n\n'
      : ''

    let gsUpdate: Partial<GameState> = {}
    let msg = callbackPrefix + baseLine
    if (rep >= 20) {
      gsUpdate = { credits: gs.credits + 50, reputation: gs.reputation + 3 }
      msg += t('repGoodSuffix')
    } else if (rep <= -20) {
      msg = t('conversationOver', { name: localNpc.name })
    } else {
      gsUpdate = { reputation: gs.reputation + 2 }
      msg += t('repNeutralSuffix')
    }
    patch({ ...gsUpdate, knownNpcs: { ...gs.knownNpcs, [localNpc.id]: updated }, npcsMet: Array.from(names) })
    advanceMajorQuests()
    onDialogResult(msg)
  }

  function handleService() {
    if (!service) return
    spendAction()
    const { patch: newGs, message } = service.execute(gs)
    patch(newGs)
    patchNpc({ lastServiceDay: gs.day })
    onDialogResult(message)
  }

  function handleProvoke() {
    openNpc()
    const base = npcState ?? { id: localNpc.id, name: localNpc.name, station: localNpc.station, firstMetDay: gs.day, timesMet: 1, repDelta: 0, isAlly: false, isEnemy: false, tags: [] }
    const updated = { ...base, isEnemy: true, repDelta: -50 }
    patch({ knownNpcs: { ...gs.knownNpcs, [localNpc.id]: updated }, reputation: gs.reputation - 5 })
    startCombat({
      name: localNpc.name,
      maxHp: 40 + Math.floor(gs.day * 2),
      damageMin: 8, damageMax: 18,
      lootMin: 150, lootMax: 500,
      description: t('provokeEnemyDescription', { role: localNpc.role }),
      captureChance: 15, killChance: 15, isBoss: false, role: 'normal' as const,
    })
  }

  return (
    <div className="layout">
      <div className="t-xs t-dim t-center">— {localNpc.name.toUpperCase()} —</div>

      <div className="px-box px-box--hi" style={{ borderColor: 'var(--cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <div className="t-sm t-bright">{localNpc.name}</div>
            <div className="t-xs t-dim">{translateNpcRole(localNpc.role)}</div>
          </div>
          <div className="t-xs" style={{ color: REACTION_COLOR[reaction] }}>{t(`reactionLabels.${reaction}`)}</div>
        </div>
        <div className="t-xs t-dim mb8" style={{ lineHeight: '1.8' }}>
          <TypewriterText text={localNpc.description} speed={14} />
        </div>
        {timesMet > 0 && (
          <div className="t-xs t-dim mb8">{t('meetingsCount', { count: timesMet, plural: timesMet > 1 ? 's' : '', day: npcState?.firstMetDay ?? gs.day })}</div>
        )}
        <div className="t-xs t-cyan" style={{ fontStyle: 'italic' }}>
          "<TypewriterText text={greeting} speed={28} />"
        </div>
      </div>

      {npcDialogResult ? (
        <div className="px-box" style={{ borderColor: 'var(--green)' }}>
          <div className="t-xs" style={{ lineHeight: '2' }}>
            <TypewriterText text={npcDialogResult} speed={14} />
          </div>
        </div>
      ) : (
        <div className="col gap4">
          {reaction !== 'hostile' && (
            <button className="px-btn" disabled={talkUsed} style={{ opacity: talkUsed ? 0.4 : 1 }} onClick={handleTalk}>
              {t('talk')}
              {talkUsed && <span className="t-dim" style={{ marginLeft: '8px', fontSize: '9px' }}>{t('alreadyTalkedToday')}</span>}
            </button>
          )}

          {service && reaction !== 'hostile' && (
            <button
              className="px-btn"
              style={{
                color: serviceUsed ? undefined : 'var(--cyan)',
                borderColor: serviceUsed ? undefined : 'var(--cyan)',
                opacity: serviceUsed || !service.canUse(gs) ? 0.5 : 1,
              }}
              disabled={serviceUsed || !service.canUse(gs) || gs.actionsToday >= 3}
              onClick={handleService}
            >
              {service.label}
              <span className="t-dim" style={{ marginLeft: '8px', fontSize: '9px' }}>
                {serviceUsed ? t('alreadyUsed') : t('serviceCost', { cost: service.costText })}
              </span>
              {!serviceUsed && !service.canUse(gs) && (
                <span className="t-red" style={{ marginLeft: '6px', fontSize: '9px' }}>
                  {service.whyNot(gs)}
                </span>
              )}
            </button>
          )}

          {reaction !== 'hostile' && (() => {
            const mq = getMajorQuestForNpc(gs, localNpc.name)
            if (!mq) return null
            return (
              <button className="px-btn" style={{ color: 'var(--purple)', borderColor: 'var(--purple)' }} onClick={() => {
                openNpc()
                patch({ majorQuests: [...gs.majorQuests, { ...mq }] })
                onDialogResult(t('majorMissionResult', { title: mq.title, lore: mq.lore, objective: mq.stages[0].objective }))
              }}>
                {t('majorMission', { title: mq.title })}
              </button>
            )
          })()}

          {localNpc.role === 'Organisateur' && reaction !== 'hostile' && (
            <button className="px-btn px-btn--primary" onClick={() => { openNpc(); onCardGame() }}>
              {t('playCards')}
            </button>
          )}

          {reaction === 'ally' && (
            <button className="px-btn px-btn--green" onClick={() => {
              openNpc()
              patch({ playerHp: Math.min(gs.playerMaxHp, gs.playerHp + 20), reputation: gs.reputation + 5 })
              onDialogResult(t('allyHelpResult', { name: localNpc.name }))
            }}>
              {t('askAllyHelp')}
            </button>
          )}

          {reaction === 'hostile' && (
            <button className="px-btn px-btn--danger" onClick={handleProvoke}>
              {t('fightHostile')}
            </button>
          )}
          {reaction !== 'hostile' && reaction !== 'ally' && (
            <button className="px-btn" style={{ color: 'var(--orange)', borderColor: 'var(--orange)' }} onClick={handleProvoke}>
              {t('provoke')}
            </button>
          )}
        </div>
      )}

      <button className="px-btn" onClick={onBack}>{t('back')}</button>
    </div>
  )
}
