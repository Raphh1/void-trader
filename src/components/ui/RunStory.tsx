// Écran de fin de run : l'histoire de la partie en quelques lignes.
//
// Les statistiques brutes (jours, combats, quêtes) disent combien ; ceci dit
// comment : le build (classe, reliques), l'équipage (qui est resté, qui est
// tombé ou a déserté), le rang face aux concurrents, le meilleur coup et la
// pire perte. C'est ce qu'on a envie de battre à la run suivante.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameState } from '../../types'
import { getRelic } from '../../data/relics'
import { getStandings, getPlayerRank } from '../../engine/competitors'
import { translateClassName, translateStationName } from '../../engine/goodsI18n'
import { recordDailyScore, getDailyBest, dailyScore } from '../../engine/daily'

export function RunStory({ gs }: { gs: GameState }) {
  const { t } = useTranslation('runStory')
  const { t: tc } = useTranslation('crew')
  const relics = (gs.relics ?? []).map(getRelic).filter((r): r is NonNullable<typeof r> => !!r)
  const crew = gs.crew ?? []
  const perdus = gs.runHighlights?.crewLost ?? []
  const rang = (gs.competitors ?? []).length > 0 ? getPlayerRank(gs) : null
  const total = (gs.competitors ?? []).length + 1
  const premier = getStandings(gs)[0]
  const best = gs.runHighlights?.bestGain
  const worst = gs.runHighlights?.worstLoss
  const score = dailyScore(gs)

  // Défi du jour : le score est gardé une seule fois, à l'affichage de l'écran.
  useEffect(() => {
    if (gs.dailyChallenge) recordDailyScore(gs.dailyChallenge, score)
  }, [gs.dailyChallenge, score])
  const record = gs.dailyChallenge ? getDailyBest(gs.dailyChallenge) : null

  const ligne = (label: string, contenu: React.ReactNode) => (
    <div className="row t-xs" style={{ gap: '10px', lineHeight: 1.9, alignItems: 'baseline' }}>
      <span className="t-dim" style={{ minWidth: '120px' }}>{label}</span>
      <span style={{ flex: 1 }}>{contenu}</span>
    </div>
  )

  return (
    <div className="px-box mb8" style={{ borderColor: 'var(--gold)' }}>
      <div className="t-xs mb8" style={{ color: 'var(--gold)', letterSpacing: '2px' }}>{t('title')}</div>

      {gs.dailyChallenge && ligne(t('daily'), <>
        <span className="t-gold">{t('dailyScore', { score: score.toLocaleString() })}</span>
        {record !== null && <span className="t-dim"> · {record > score ? t('dailyBest', { best: record.toLocaleString() }) : t('dailyNewBest')}</span>}
      </>)}

      {ligne(t('build'), <>
        <span style={{ color: gs.class.color }}>{gs.class.icon} {translateClassName(gs.class.name)}</span>
        {relics.length > 0
          ? <span> · {relics.map(r => `${r.icon} ${r.name}`).join(' · ')}</span>
          : <span className="t-dim"> · {t('noRelics')}</span>}
      </>)}

      {ligne(t('crew'), <>
        {crew.length === 0 && perdus.length === 0 && <span className="t-dim">{t('soloFlight')}</span>}
        {crew.length > 0 && <span className="t-green">{crew.map(m => `${m.name} (${tc(`role.${m.role}`)})`).join(', ')}</span>}
        {perdus.length > 0 && <span className="t-red">{crew.length > 0 ? ' · ' : ''}{t('lost', { names: perdus.join(', ') })}</span>}
      </>)}

      {rang !== null && ligne(t('ranking'), rang === 1
        ? <span className="t-gold">{t('rankFirst', { total })}</span>
        : <span>{t('rankOther', { rank: rang, total })} <span className="t-dim">{t('leader', { name: premier.name, credits: premier.credits.toLocaleString() })}</span></span>)}

      {best && ligne(t('bestMove'), <span className="t-green">{t('moment', { amount: `+${best.amount.toLocaleString()}`, day: best.day, station: translateStationName(best.station) })}</span>)}
      {worst && ligne(t('worstMove'), <span className="t-red">{t('moment', { amount: `−${worst.amount.toLocaleString()}`, day: worst.day, station: translateStationName(worst.station) })}</span>)}
    </div>
  )
}
