// Interface des reliques et des concurrents (data/relics.ts, engine/competitors.ts).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import type { GameState, CompetitorNews, CrewMember } from '../../types'
import { getRelic, grantRelic, type RelicRarity } from '../../data/relics'
import { tradeTip, snubCompetitor, competitorToEnemy, getStandings, getPlayerRank } from '../../engine/competitors'
import { translateGood, translateStationName } from '../../engine/goodsI18n'
import { getRecruits, hireCrew, fireCrew, hiringFee, MAX_CREW } from '../../engine/crew'

const RARITY_COLOR: Record<RelicRarity, string> = { common: 'var(--cyan)', rare: 'var(--gold)', cursed: 'var(--red)' }

// Les écrans où le choix peut s'afficher sans couper une action en cours.
const ECRANS_CHOIX = new Set(['station-hub', 'station-arrival', 'combat-result'])

/** Choix d'une relique parmi trois, par-dessus l'écran courant. */
export function RelicChoiceModal() {
  const { t } = useTranslation('relics')
  const gs = useGameStore(s => s.gs)
  const patch = useGameStore(s => s.patch)
  if (!gs?.pendingRelicChoice || !ECRANS_CHOIX.has(gs.screen)) return null
  const { options, source } = gs.pendingRelicChoice

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="px-box col gap4" style={{ maxWidth: '640px', width: '100%', borderColor: 'var(--gold)', background: 'var(--bg-panel)' }}>
        <div className="t-sm t-gold" style={{ letterSpacing: '2px' }}>{t(`choice.title.${source}`)}</div>
        <div className="t-xs t-dim mb8">{t('choice.subtitle')}</div>
        {options.map(id => {
          const r = getRelic(id)
          if (!r) return null
          return (
            <button key={id} className="px-btn" style={{ textAlign: 'left', borderColor: RARITY_COLOR[r.rarity], padding: '10px 12px' }}
              onClick={() => patch(grantRelic(gs, id))}>
              <div className="t-sm" style={{ color: RARITY_COLOR[r.rarity] }}>
                {r.icon} {r.name} <span className="t-xs" style={{ opacity: 0.8 }}>· {t(`rarity.${r.rarity}`)}</span>
              </div>
              <div className="t-xs mt4" style={{ lineHeight: 1.7, color: 'var(--text)' }}>{r.description}</div>
            </button>
          )
        })}
        <button className="px-btn px-btn--sm mt4" style={{ width: 'auto', alignSelf: 'flex-end' }}
          onClick={() => patch({ pendingRelicChoice: null })}>
          {t('choice.skip')}
        </button>
      </div>
    </div>
  )
}

/** Rend une nouvelle de concurrent dans la langue courante. */
export function useNewsText() {
  const { t } = useTranslation('competitors')
  return (n: CompetitorNews) => {
    const params: Record<string, string | number> = { ...n.params }
    if (typeof params.item === 'string') params.item = translateGood(params.item)
    if (typeof params.station === 'string') params.station = translateStationName(params.station)
    if (typeof params.amount === 'number') params.amount = params.amount.toLocaleString()
    return t(n.key, params)
  }
}

export function CompetitorNewsLines({ news }: { news: CompetitorNews[] }) {
  const { t } = useTranslation('competitors')
  const texte = useNewsText()
  if (news.length === 0) return null
  return (
    <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-dim)' }}>
      <div className="t-xs" style={{ color: 'var(--orange)', letterSpacing: '1px' }}>{t('newsHeader')}</div>
      {news.map((n, i) => <div key={i} className="t-xs mt2" style={{ lineHeight: '1.8' }}>{texte(n)}</div>)}
    </div>
  )
}

/** Rencontre avec un concurrent à la station : tuyau, défi ou ignorer. */
export function CompetitorEncounter({ gs }: { gs: GameState }) {
  const { t } = useTranslation('competitors')
  const patch = useGameStore(s => s.patch)
  const startCombat = useGameStore(s => s.startCombat)
  const texte = useNewsText()
  const [resultat, setResultat] = useState<string | null>(null)
  const c = (gs.competitors ?? []).find(x => x.id === gs.pendingCompetitorId)
  if (!c) return null

  const humeur = c.mood >= 40 ? t('mood.friendly') : c.mood <= -50 ? t('mood.hostile') : c.mood <= -15 ? t('mood.cold') : t('mood.neutral')
  return (
    <div className="px-box" style={{ borderColor: 'var(--orange)' }}>
      <div className="t-xs mb4" style={{ color: 'var(--orange)', letterSpacing: '2px' }}>{t('encounter.header')}</div>
      <div className="t-sm t-bright">{c.name} <span className="t-xs t-dim">· {t(`style.${c.style}`)} · {humeur}</span></div>
      <div className="t-xs mt4 mb8" style={{ lineHeight: 1.8 }}>{t(`encounter.intro.${c.style}`)}</div>
      {resultat ? (
        <>
          <div className="t-xs t-green mb8" style={{ lineHeight: 1.8 }}>{resultat}</div>
          <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => { setResultat(null); patch({ pendingCompetitorId: null }) }}>{t('encounter.ok')}</button>
        </>
      ) : (
        <div className="col gap4">
          <button className="px-btn" onClick={() => {
            const r = tradeTip(gs, c.id)
            // La rencontre reste ouverte jusqu'au « OK », sinon le tuyau disparaîtrait aussitôt.
            patch({ competitors: r.competitors, marketPressure: r.marketPressure })
            setResultat(texte(r.tip))
          }}>{t('encounter.tip')}</button>
          <button className="px-btn px-btn--danger" onClick={() => {
            patch({ pendingCompetitorId: null })
            startCombat(competitorToEnemy(c, gs.day))
          }}>{t('encounter.duel', { share: 25 })}</button>
          <button className="px-btn" onClick={() => {
            patch({ ...snubCompetitor(gs, c.id), pendingCompetitorId: null })
          }}>{t('encounter.ignore')}</button>
        </div>
      )}
    </div>
  )
}

/** Classement par fortune. */
function StandingsList({ gs }: { gs: GameState }) {
  const { t } = useTranslation('competitors')
  return (
    <div className="col gap4">
      {getStandings(gs).map((s, i) => {
        const c = s.isPlayer ? null : (gs.competitors ?? []).find(x => x.name === s.name)
        return (
          <div key={i} className="t-xs row" style={{ gap: '8px', color: s.isPlayer ? 'var(--cyan)' : 'var(--text)' }}>
            <span style={{ width: '18px' }}>{i + 1}.</span>
            <span style={{ flex: 1 }}>
              {s.isPlayer ? t('board.you') : s.name}
              {c && <span className="t-dim"> · {t(`style.${c.style}`)} · {(c.outUntilDay ?? 0) > gs.day ? t('board.out') : translateStationName(c.station)}</span>}
            </span>
            <span className="t-gold">{s.credits.toLocaleString()} cr</span>
          </div>
        )
      })}
    </div>
  )
}

/** Équipage : membres actuels et recrues du bar de la station. */
function CrewBody({ gs }: { gs: GameState }) {
  const { t } = useTranslation('crew')
  const patch = useGameStore(s => s.patch)
  const [renvoi, setRenvoi] = useState<string | null>(null)
  const crew = gs.crew ?? []
  const recrues = getRecruits(gs.currentStation, gs.day, crew).filter(m => !(gs.crewHired ?? []).includes(m.id))

  const ligne = (m: CrewMember) => (
    <>
      <span className="t-bright">{m.name}</span>
      <span className="t-dim"> · {t(`role.${m.role}`)} · {t(`trait.${m.trait}`)} · {t('salary', { amount: m.salary })}</span>
      <div className="t-xs mt2" style={{ color: 'var(--cyan)' }}>{t(`effect.${m.role}`)}{m.trait === 'veteran' || m.trait === 'cupide' ? ` ${t('effectStrong')}` : m.trait === 'novice' ? ` ${t('effectWeak')}` : ''}</div>
    </>
  )

  return (
    <div className="col gap4">
      {crew.length === 0 && <div className="t-xs t-dim">{t('empty')}</div>}
      {crew.map(m => (
        <div key={m.id} className="t-xs" style={{ lineHeight: 1.7, borderLeft: `2px solid ${m.loyalty < 25 ? 'var(--red)' : m.loyalty < 50 ? 'var(--orange)' : 'var(--green)'}`, paddingLeft: '8px' }}>
          {ligne(m)}
          <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
            <span style={{ color: m.loyalty < 25 ? 'var(--red)' : 'var(--dim)' }}>{t('loyalty', { value: m.loyalty })}{m.loyalty < 25 ? ` — ${t('desertionRisk')}` : ''}</span>
            <button className="px-btn px-btn--sm" style={{ width: 'auto', marginLeft: 'auto', color: 'var(--red)' }}
              onClick={() => { if (renvoi === m.id) { patch(fireCrew(gs, m.id)); setRenvoi(null) } else setRenvoi(m.id) }}>
              {renvoi === m.id ? t('fireConfirm') : t('fire')}
            </button>
          </div>
        </div>
      ))}
      <div className="t-xs mt4" style={{ color: 'var(--orange)', letterSpacing: '1px' }}>{t('barHeader')}</div>
      {recrues.length === 0 && <div className="t-xs t-dim">{t('noRecruits')}</div>}
      {recrues.map(m => {
        const embauche = hireCrew(gs, m)
        return (
          <div key={m.id} className="t-xs" style={{ lineHeight: 1.7, paddingLeft: '8px', borderLeft: '2px solid var(--border)' }}>
            {ligne(m)}
            <button className="px-btn px-btn--sm mt4" style={{ width: 'auto' }} disabled={!embauche}
              onClick={() => embauche && patch(embauche)}>
              {crew.length >= MAX_CREW ? t('full') : t('hire', { fee: hiringFee(m) })}
            </button>
          </div>
        )
      })}
    </div>
  )
}

type DockTab = 'relics' | 'crew' | 'rivals'

/**
 * Barre de run : reliques, équipage et concurrents réunis en une ligne de
 * pastilles, détail au clic. Ils s'empilaient en trois blocs sous la barre
 * d'état et repoussaient le contenu de la station hors de l'écran.
 */
export function RunDock({ gs }: { gs: GameState }) {
  const { t: tr } = useTranslation('relics')
  const { t: tc } = useTranslation('crew')
  const { t: tk } = useTranslation('competitors')
  const [tab, setTab] = useState<DockTab | null>(null)
  const relics = (gs.relics ?? []).map(getRelic).filter((r): r is NonNullable<typeof r> => !!r)
  const crew = gs.crew ?? []
  const recrues = getRecruits(gs.currentStation, gs.day, crew).filter(m => !(gs.crewHired ?? []).includes(m.id))
  const salaires = crew.reduce((n, m) => n + m.salary, 0)
  const loyauteBasse = crew.some(m => m.loyalty < 25)
  const rang = getPlayerRank(gs)
  const total = (gs.competitors ?? []).length + 1

  const chip = (id: DockTab, contenu: React.ReactNode, accent?: string) => (
    <button className="px-btn px-btn--sm" onClick={() => setTab(x => x === id ? null : id)}
      style={{ width: 'auto', padding: '4px 10px', borderColor: tab === id ? 'var(--gold)' : accent ?? 'var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
      {contenu}
    </button>
  )

  return (
    <div className="px-box" style={{ padding: '6px 8px' }}>
      <div className="row" style={{ gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {chip('relics', <>
          <span className="t-xs t-dim">◈ {relics.length}</span>
          {relics.length === 0
            ? <span className="t-xs t-dim">{tr('bar.none')}</span>
            : relics.map(r => <span key={r.id} title={`${r.name} — ${r.description}`} style={{ fontSize: '13px' }}>{r.icon}</span>)}
        </>)}
        {chip('crew', <>
          <span className="t-xs">{tc('chip', { count: crew.length, max: MAX_CREW })}</span>
          {crew.length > 0 && <span className="t-xs t-gold">−{salaires}/j</span>}
          {loyauteBasse && <span className="t-xs t-red">⚠</span>}
          {recrues.length > 0 && <span className="t-xs" style={{ color: 'var(--green)' }}>+{recrues.length}</span>}
        </>, loyauteBasse ? 'var(--red)' : recrues.length > 0 ? 'var(--green)' : undefined)}
        {(gs.competitors ?? []).length > 0 && chip('rivals', <span className="t-xs" style={{ color: rang === 1 ? 'var(--gold)' : 'var(--text)' }}>{tk('board.rank', { rank: rang, total })}</span>)}
      </div>
      {tab && (
        <div className="mt8" style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '8px' }}>
          {tab === 'relics' && (relics.length === 0
            ? <div className="t-xs t-dim">{tr('bar.empty')}</div>
            : <div className="col gap4">{relics.map(r => (
                <div key={r.id} className="t-xs" style={{ lineHeight: 1.7 }}>
                  <span style={{ color: RARITY_COLOR[r.rarity] }}>{r.icon} {r.name}</span> — {r.description}
                </div>
              ))}</div>)}
          {tab === 'crew' && <CrewBody gs={gs} />}
          {tab === 'rivals' && <StandingsList gs={gs} />}
        </div>
      )}
    </div>
  )
}
