import { useState } from 'react'
import { questTitle, questDescription } from '../../engine/questI18n'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { getFactions } from '../../engine/factions'
import {
  getFactionRep, getRepLevel,
  getRepLabels, REP_COLORS, getFactionBonusDesc,
  type FactionKey,
} from '../../engine/factionRep'
import { generateFactionMission } from '../../engine/quests'
import { canJoinFactionThisRun } from '../../data/runModifiers'
import type { GameState } from '../../types'
import { translateStationName } from '../../engine/goodsI18n'

const FACTION_REQUIREMENTS: Record<string, { station: string; npcId: string; npcName: string }> = {
  faucons:  { station: 'Arc Ouest Apocalypse',  npcId: 'cael',   npcName: 'Cael' },
  emporium: { station: 'Emporium Requiem',       npcId: 'pistis', npcName: 'Pistis' },
  gardiens: { station: 'La Citadelle Écarlate',  npcId: 'myrra',  npcName: 'Myrra' },
  culte:    { station: 'Le Purgatoire',          npcId: 'neva',   npcName: 'Neva' },
}

const MORAL_TAG_COLORS: Record<string, string> = {
  cannibal:     'var(--red)',
  trafiquant:   'var(--orange)',
  délateur:     '#aa6633',
  opportuniste: 'var(--dim)',
  pacifiste:    'var(--green)',
  sanguinaire:  'var(--red)',
  héros:        'var(--gold)',
  mercenaire:   'var(--cyan)',
}

type Tab = 'general' | 'pillars' | 'factions'

function RepBar({ rep }: { rep: number }) {
  const level = getRepLevel(rep)
  const color = REP_COLORS[level]
  const pct = (rep + 100) / 200 * 100
  return (
    <div style={{ position: 'relative', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px',
        background: 'var(--border-hi)', zIndex: 1,
      }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct}%`, background: color, borderRadius: '3px',
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function GeneralTab({ gs }: { gs: GameState }) {
  const { t } = useTranslation('factionsScreen')
  if (!gs) return null
  const repColor = gs.reputation >= 0 ? 'var(--green)' : 'var(--red)'
  const tags = gs.moralTags ?? []

  return (
    <>
      <div className="px-box" style={{ borderColor: 'var(--cyan)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="t-xs t-dim" style={{ letterSpacing: '2px' }}>{t('general.globalRep')}</div>
          <div className="t-sm" style={{ color: repColor }}>
            {gs.reputation > 0 ? '+' : ''}{gs.reputation}
          </div>
        </div>
        <div style={{ background: 'var(--border)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, (gs.reputation + 200) / 400 * 100))}%`,
            height: '100%', background: repColor,
            transition: 'width 0.3s',
          }} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="t-xs" style={{ color: 'var(--red)', fontSize: '8px' }}>-200</span>
          <span className="t-xs t-dim" style={{ fontSize: '8px' }}>0</span>
          <span className="t-xs" style={{ color: 'var(--green)', fontSize: '8px' }}>+200</span>
        </div>
      </div>

      <div className="px-box">
        <div className="t-xs t-dim mb6" style={{ letterSpacing: '2px' }}>{t('general.moralTraits')}</div>
        {tags.length === 0 ? (
          <div className="t-xs t-dim">{t('general.noTraits')}</div>
        ) : (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {tags.map(tag => {
              const color = MORAL_TAG_COLORS[tag] ?? 'var(--dim)'
              const label = t(`moralTags.${tag}`, { defaultValue: tag })
              return (
                <span key={tag} className="tag t-xs" style={{ borderColor: color, color }}>
                  {label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-box">
        <div className="t-xs t-dim mb6" style={{ letterSpacing: '2px' }}>{t('general.stats')}</div>
        <div className="col gap4">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('general.day')}</span>
            <span className="t-xs t-bright">{gs.day}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('general.bossesDefeated')}</span>
            <span className="t-xs t-bright">{gs.bossesDefeated ?? 0}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('general.stationsVisited')}</span>
            <span className="t-xs t-bright">{gs.visitedStations?.length ?? 0}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('general.npcsMet')}</span>
            <span className="t-xs t-bright">{gs.npcsMet?.length ?? 0}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-xs t-dim">{t('general.questsCompleted')}</span>
            <span className="t-xs t-bright">{gs.completedQuestIds?.length ?? 0}</span>
          </div>
          {gs.faction !== 'none' && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('general.factionMissions')}</span>
              <span className="t-xs t-gold">{gs.factionMissions}</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PillarsTab({ gs }: { gs: GameState }) {
  const { t } = useTranslation('factionsScreen')
  if (!gs) return null
  const standing = gs.pillarStanding ?? {} as Record<string, number>
  const angered = gs.nexusAngered ?? []

  const PILLAR_NAMES: Record<string, string> = {
    cesarion: 'Cesarion',
    raphazarus: 'Raphazarus',
    eliotis: 'Eliotis',
    maxance: 'Maxance',
    alanossa: 'Alanossa',
    scotty: 'Scotty',
  }

  return (
    <>
      {(Object.entries(standing) as [string, number][]).map(([key, val]) => {
        const isAngered = angered.includes(key)
        const color = isAngered ? 'var(--red)' : val >= 60 ? 'var(--gold)' : val >= 30 ? 'var(--green)' : val >= 10 ? 'var(--cyan)' : 'var(--dim)'
        const label = isAngered ? t('pillars.enemy') : val >= 60 ? t('pillars.allie') : val >= 30 ? t('pillars.respecte') : val >= 10 ? t('pillars.connu') : t('pillars.inconnu')
        const name = PILLAR_NAMES[key] ?? key

        return (
          <div key={key} className="px-box" style={{ borderColor: color }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div className="t-sm t-bright">{name}</div>
              <div className="row" style={{ gap: '6px', alignItems: 'center' }}>
                <span className="tag t-xs" style={{ borderColor: color, color }}>{label}</span>
                <span className="t-xs" style={{ color }}>{val}/100</span>
              </div>
            </div>
            <div style={{ background: 'var(--border)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, val))}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
            </div>
            {isAngered && (
              <div className="t-xs mt4" style={{ color: 'var(--red)' }}>{t('pillars.angeredNote')}</div>
            )}
          </div>
        )
      })}
      <div className="px-box" style={{ borderColor: 'var(--border)' }}>
        <div className="t-xs t-dim" style={{ lineHeight: '1.8' }}>
          {t('pillars.explanation')}
        </div>
      </div>
    </>
  )
}

function FactionsTab({ gs }: { gs: GameState }) {
  const { t } = useTranslation('factionsScreen')
  if (!gs) return null
  const joinFaction = useGameStore(s => s.joinFaction)
  const addQuest    = useGameStore(s => s.addQuest)
  const actionsLeft = 3 - gs.actionsToday
  const activeFactionQuest = gs.activeQuests.find(q => q.factionId === gs.faction)
  const repLabels = getRepLabels()
  const bonusDesc = getFactionBonusDesc()

  return (
    <>
      {gs.faction !== 'none' && (
        <div className="px-box" style={{ borderColor: 'var(--gold)', background: 'rgba(255,200,0,0.05)' }}>
          <div className="row" style={{ alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div className="t-sm t-gold">{t('factions.missionsTitle')}</div>
            <div className="t-xs t-dim" style={{ marginLeft: 'auto' }}>
              {t('factions.missionsDone', { count: gs.factionMissions })}
            </div>
          </div>
          {activeFactionQuest ? (
            <div className="col gap4">
              <div className="t-xs t-dim mb4">{t('factions.currentMission')}</div>
              <div className="px-box" style={{ padding: '8px 12px', borderColor: 'var(--cyan)' }}>
                <div className="t-xs t-bright mb2">{questTitle(activeFactionQuest)}</div>
                <div className="t-xs t-dim" style={{ lineHeight: '1.8' }}>{activeFactionQuest.description}</div>
                <div className="t-xs t-gold mt4">{t('factions.destination', { station: translateStationName(activeFactionQuest.targetStation) })}</div>
                <div className="t-xs t-dim mt2">{t('factions.reward', { credits: activeFactionQuest.creditReward.toLocaleString(), rep: activeFactionQuest.repReward })}</div>
              </div>
              <div className="t-xs t-dim">{t('factions.completeToTakeNext')}</div>
            </div>
          ) : (
            <div className="col gap4">
              <div className="t-xs t-dim" style={{ lineHeight: '2' }}>
                {t('factions.explanation')}
              </div>
              <button
                className="px-btn px-btn--primary"
                disabled={actionsLeft <= 0 || gs.activeQuests.length >= 5}
                onClick={() => {
                  const mission = generateFactionMission(gs, gs.faction)
                  if (mission) addQuest(mission)
                }}
              >
                {actionsLeft <= 0 ? t('factions.noActionsToday') : gs.activeQuests.length >= 5 ? t('factions.questLogFull') : t('factions.takeMission')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="col gap4">
        {getFactions().map(f => {
          const fKey     = f.id as FactionKey
          const rep      = getFactionRep(gs, fKey)
          const level    = getRepLevel(rep)
          const color    = REP_COLORS[level]
          const isMember = gs.faction === f.id
          const canJoin  = gs.faction === 'none' && canJoinFactionThisRun(gs)
          const req      = FACTION_REQUIREMENTS[f.id]
          const atStation= req && gs.currentStation === req.station
          const metNpc   = req && gs.npcsMet.includes(req.npcName)
          const eligible = atStation && metNpc

          const activeBonus = level === 'exaltee' ? bonusDesc[fKey][2]
            : level === 'honoree' ? bonusDesc[fKey][1]
            : level === 'amicale' ? bonusDesc[fKey][0]
            : null

          return (
            <div key={f.id} className={`px-box ${isMember ? 'px-box--act' : ''}`}
              style={{ borderColor: isMember ? f.color : level === 'hostile' ? 'var(--red)' : undefined }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div className="t-sm t-bright" style={{ color: f.color }}>{f.name}</div>
                <div className="row" style={{ gap: '6px', alignItems: 'center' }}>
                  {isMember && <div className="tag tag--gold t-xs">{t('factions.memberTag')}</div>}
                  <div className="tag t-xs" style={{ borderColor: color, color }}>{repLabels[level]}</div>
                  <div className="t-xs" style={{ color, minWidth: '32px', textAlign: 'right' }}>{rep > 0 ? '+' : ''}{rep}</div>
                </div>
              </div>
              <RepBar rep={rep} />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: '2px', marginBottom: '10px' }}>
                <span className="t-xs" style={{ color: 'var(--red)', fontSize: '8px' }}>{t('factions.hostile')}</span>
                <span className="t-xs" style={{ color: 'var(--text-dim)', fontSize: '8px' }}>{t('factions.neutral')}</span>
                <span className="t-xs" style={{ color: 'var(--gold)', fontSize: '8px' }}>{t('factions.exalted')}</span>
              </div>
              <div className="t-xs t-dim mb8" style={{ lineHeight: '2' }}>{f.description}</div>
              {activeBonus ? (
                <div className="t-xs mb8" style={{ color }}>{t('factions.activeBonus', { bonus: activeBonus })}</div>
              ) : (
                <div className="t-xs t-dim mb8">
                  {t('factions.nextBonuses', { bonuses: bonusDesc[fKey].join(' → ') })}
                </div>
              )}
              {!isMember && canJoin && req && (
                <div className="col gap4">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div className="t-xs" style={{ color: atStation ? 'var(--green)' : 'var(--text-dim)' }}>
                      {atStation ? '✓' : '○'} {t('factions.stationReq', { station: translateStationName(req.station) })}
                    </div>
                    <div className="t-xs" style={{ color: metNpc ? 'var(--green)' : 'var(--text-dim)' }}>
                      {metNpc ? '✓' : '○'} {t('factions.meetNpcReq', { npc: req.npcName })}
                    </div>
                  </div>
                  <button className="px-btn px-btn--sm" disabled={!eligible}
                    style={{ color: eligible ? f.color : undefined, borderColor: eligible ? f.color : undefined }}
                    onClick={() => joinFaction(f.id)}>
                    {eligible ? t('factions.joinFaction', { faction: f.name }) : t('factions.conditionsNotMet')}
                  </button>
                </div>
              )}
              {!isMember && gs.faction !== 'none' && (
                <div className="t-xs t-dim">{t('factions.alreadyMember')}</div>
              )}
              {!isMember && gs.faction === 'none' && !canJoinFactionThisRun(gs) && (
                <div className="t-xs t-red">{t('factions.pariahWarning')}</div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function FactionsScreen() {
  const { t } = useTranslation('factionsScreen')
  const gs   = useGameStore(s => s.gs!)
  const goTo = useGameStore(s => s.goTo)
  const [tab, setTab] = useState<Tab>('general')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general',  label: t('tabs.general') },
    { key: 'pillars',  label: t('tabs.pillars') },
    { key: 'factions', label: t('tabs.factions') },
  ]

  return (
    <div className="layout">
      <div className="row" style={{ alignItems: 'center', gap: '16px' }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>{t('back')}</button>
        <div className="t-sm t-bright">{t('title')}</div>
        {gs.faction !== 'none' && (
          <div className="tag tag--gold t-xs">{t('factionTag', { faction: gs.faction.toUpperCase() })}</div>
        )}
      </div>

      <div className="row" style={{ gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
        {TABS.map(tb => (
          <button key={tb.key} className="px-btn px-btn--sm"
            style={{
              width: 'auto', flex: 1,
              borderColor: tab === tb.key ? 'var(--cyan)' : 'var(--border)',
              color: tab === tb.key ? 'var(--cyan)' : 'var(--dim)',
              background: tab === tb.key ? 'rgba(0,255,255,0.05)' : 'transparent',
            }}
            onClick={() => setTab(tb.key)}>
            <span className="t-xs">{tb.label}</span>
          </button>
        ))}
      </div>

      {tab === 'general'  && <GeneralTab gs={gs} />}
      {tab === 'pillars'  && <PillarsTab gs={gs} />}
      {tab === 'factions' && <FactionsTab gs={gs} />}
    </div>
  )
}
