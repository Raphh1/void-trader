import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { addDecision, shiftPillar } from '../../engine/memoryEvents'
import { addJournal } from '../../engine/journal'
import { drawInterrogation, interrogatorKind, type InterrogatorKind, INTERROGATION_PASS_SCORE, INTERROGATION_TOTAL, type InterrogationQuestion } from '../../data/interrogationQuestions'
import { translateStationName } from '../../engine/goodsI18n'

type Phase = 'intro' | 'choices' | 'quiz' | 'result'

// Secondes pour répondre. Un interrogatoire où l’on peut réfléchir dix minutes
// n’en est pas un — et rien n’empêchait d’aller chercher les réponses
// ailleurs. Assez large pour lire quatre propositions sans se presser.
const TEMPS_PAR_QUESTION = 20

interface InterrogatorProfile {
  title: string
  description: string
  demandLabel: string
  tone: string
}

function getInterrogatorProfile(kind: InterrogatorKind, t: (key: string) => string): InterrogatorProfile {
  if (kind === 'raphazarus') return {
    title: t('profiles.raphazarus.title'),
    description: t('profiles.raphazarus.description'),
    demandLabel: t('profiles.raphazarus.demandLabel'),
    tone: "var(--orange)",
  }
  if (kind === 'emporium') return {
    title: t('profiles.emporium.title'),
    description: t('profiles.emporium.description'),
    demandLabel: t('profiles.emporium.demandLabel'),
    tone: "var(--cyan)",
  }
  if (kind === 'gardiens') return {
    title: t('profiles.gardiens.title'),
    description: t('profiles.gardiens.description'),
    demandLabel: t('profiles.gardiens.demandLabel'),
    tone: "var(--green)",
  }
  return {
    title: t('profiles.local.title'),
    description: t('profiles.local.description'),
    demandLabel: t('profiles.local.demandLabel'),
    tone: "var(--orange)",
  }
}

export function InterrogationScreen() {
  const { t } = useTranslation('interrogationScreen')
  const gs    = useGameStore(s => s.gs!)
  const patch = useGameStore(s => s.patch)
  const goTo  = useGameStore(s => s.goTo)

  const [phase, setPhase]   = useState<Phase>('intro')
  const [result, setResult] = useState<{ text: string; free: boolean }>({ text: '', free: false })

  const info = gs.pendingInterrogation ?? { faction: 'Autorités locales', captureStation: gs.currentStation }
  const kind = interrogatorKind(info.faction)

  // ── Quiz d'interrogatoire ──
  // Tiré une seule fois : re-tirer à chaque rendu changerait les questions
  // sous les doigts du joueur. Le pool dépend de qui interroge.
  const [quiz] = useState<InterrogationQuestion[]>(() => drawInterrogation(kind))
  const [qIdx, setQIdx]       = useState(0)
  const [score, setScore]     = useState(0)
  const [picked, setPicked]   = useState<number | null>(null)
  // Chaque classe peut peser une fois sur l’interrogatoire, à sa manière.
  const [atoutUtilise, setAtoutUtilise] = useState(false)
  const [revele, setRevele]   = useState<number | null>(null)
  const [reste, setReste]     = useState(TEMPS_PAR_QUESTION)

  // Le compte à rebours repart à chaque question…
  useEffect(() => { setReste(TEMPS_PAR_QUESTION) }, [qIdx])
  // …et s’arrête dès qu’une réponse est donnée, pour laisser lire le verdict.
  useEffect(() => {
    if (phase !== 'quiz' || picked !== null) return
    if (reste <= 0) { setPicked(-1); return }   // temps écoulé = réponse fausse
    const minuteur = setTimeout(() => setReste(r => r - 1), 1000)
    return () => clearTimeout(minuteur)
  }, [phase, picked, reste])
  const profile = getInterrogatorProfile(kind, t)
  // Le Marchand fait son métier : il négocie le prix de sa liberté.
  const remiseMarchand = gs.class.tradeBonusPercent ? 0.6 : 1
  const bribeAmount = Math.floor((600 + gs.day * 25) * remiseMarchand)

  function free(text: string, extraPatch?: Partial<typeof gs>) {
    // Plaider depuis la cellule et convaincre, c'est sortir pour de bon.
    const sortieDeCellule = info.fromPrison ? { isImprisoned: false, prisonDaysLeft: 0 } : {}
    patch({ pendingInterrogation: null, interrogationsSurvived: gs.interrogationsSurvived + 1, ...sortieDeCellule, ...extraPatch })
    setResult({ text, free: true })
    setPhase('result')
  }

  function prison(text: string, days: number, extraPatch?: Partial<typeof gs>) {
    // Un plaidoyer raté depuis la cellule ALLONGE la peine, il ne la remplace pas.
    const peine = info.fromPrison ? (gs.prisonDaysLeft ?? 0) + days : days
    patch({ pendingInterrogation: null, isImprisoned: true, prisonDaysLeft: peine, ...extraPatch })
    setResult({ text, free: false })
    setPhase('result')
  }

  // ── INTRO ────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="layout">
        <div className="t-xs t-dim t-center" style={{ letterSpacing: '3px' }}>
          — {profile.title} —
        </div>

        <div className="px-box" style={{ borderColor: profile.tone }}>
          <div className="t-sm mb8" style={{ color: profile.tone, letterSpacing: '1px' }}>{t('detained')}</div>
          <div className="t-xs t-dim mb8" style={{ lineHeight: '2.2' }}>{profile.description}</div>
          <div className="px-box mt4" style={{ borderColor: 'var(--dim)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="t-xs t-dim" style={{ fontStyle: 'italic', lineHeight: '2' }}>
              "{profile.demandLabel}"
            </div>
          </div>
        </div>

        <div className="px-box" style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('capturedAt')}</span>
              <span className="t-xs">{info.captureStation}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('faction')}</span>
              <span className="t-xs" style={{ color: profile.tone }}>{info.faction}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-xs t-dim">{t('currentHp')}</span>
              <span className="t-xs" style={{ color: gs.playerHp < gs.playerMaxHp * 0.3 ? 'var(--red)' : 'var(--green)' }}>{gs.playerHp}/{gs.playerMaxHp}</span>
            </div>
          </div>
        </div>

        <div className="px-box" style={{ padding: '8px 12px', borderColor: 'var(--dim)' }}>
          <div className="t-xs t-dim" style={{ lineHeight: '1.9' }}>
            {t('introText', { total: INTERROGATION_TOTAL, pass: INTERROGATION_PASS_SCORE })}
          </div>
        </div>

        <button className="px-btn px-btn--primary" onClick={() => setPhase('quiz')}>
          {t('startQuiz', { pass: INTERROGATION_PASS_SCORE, total: INTERROGATION_TOTAL })}
        </button>
        <button className="px-btn" onClick={() => setPhase('choices')}>
          {t('otherApproach')}
        </button>
      </div>
    )
  }

  // ── QUIZ ─────────────────────────────────────────────────────────────────
  if (phase === 'quiz') {
    const question = quiz[qIdx]
    const answered = picked !== null
    const isLast   = qIdx >= quiz.length - 1

    function choose(i: number) {
      if (picked !== null) return
      setPicked(i)
      if (i === question.answer) setScore(s => s + 1)
    }

    // Chaque classe pèse sur l’interrogatoire selon ce qu’elle sait faire :
    // le Hackeur lit le terminal, le Seigneur de guerre fait taire la
    // question, Rayane rejoue son échec à pile ou face.
    const atout = gs.class.name === 'Hackeur' ? 'reveal'
      : gs.class.name === 'Seigneur de guerre' ? 'skip'
      : gs.class.name === 'Rayane' ? 'flip'
      : null

    function jouerAtout() {
      if (atoutUtilise || atout === null) return
      setAtoutUtilise(true)
      if (atout === 'reveal') { setRevele(question.answer); return }
      if (atout === 'skip') { setPicked(question.answer); setScore(n => n + 1); return }
      // Rayane : pile, la réponse ratée devient bonne ; face, tant pis.
      if (atout === 'flip' && picked !== null && picked !== question.answer && Math.random() < 0.5) {
        setScore(n => n + 1)
        setRevele(question.answer)
      }
    }

    function next() {
      if (isLast) {
        const finalScore = score
        const passed = finalScore >= INTERROGATION_PASS_SCORE
        if (passed) {
          free(
            t('quiz.passMessage', { score: finalScore, total: INTERROGATION_TOTAL }),
            { journal: addJournal(gs, t('quiz.passJournal', { faction: info.faction, score: finalScore, total: INTERROGATION_TOTAL }), 'prison') }
          )
        } else {
          prison(
            t('quiz.failMessage', { score: finalScore, total: INTERROGATION_TOTAL }),
            rng(3, 6),
            { journal: addJournal(gs, t('quiz.failJournal', { faction: info.faction, score: finalScore, total: INTERROGATION_TOTAL }), 'prison') }
          )
        }
        return
      }
      setQIdx(i => i + 1)
      setPicked(null)
    }

    return (
      <div className="layout">
        <div className="t-xs t-dim t-center" style={{ letterSpacing: '3px' }}>
          {t('quiz.header')}
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="t-xs t-dim">{t('quiz.questionOf', { current: qIdx + 1, total: quiz.length })}</span>
          <span className="t-xs" style={{ color: reste <= 5 ? 'var(--red)' : 'var(--orange)' }}>
            {answered ? t('quiz.timeStopped') : t('quiz.timeLeft', { s: reste })}
          </span>
          <span className="t-xs">{t('quiz.score', { score, pass: INTERROGATION_PASS_SCORE })}</span>
        </div>

        <div className="px-box" style={{ borderColor: profile.tone }}>
          <div className="t-sm" style={{ lineHeight: '1.9' }}>{question.q}</div>
        </div>

        <div className="col gap4">
          {question.choices.map((c, i) => {
            const correct = answered && i === question.answer
            const wrong   = answered && i === picked && i !== question.answer
            return (
              <button
                key={i}
                className="px-btn"
                disabled={answered}
                style={{
                  borderColor: correct ? 'var(--green)' : wrong ? 'var(--red)' : undefined,
                  color: correct ? 'var(--green)' : wrong ? 'var(--red)' : undefined,
                  opacity: answered && !correct && !wrong ? 0.5 : 1,
                }}
                onClick={() => choose(i)}
              >
                {c}
              </button>
            )
          })}
        </div>

        {atout && !atoutUtilise && (
          <button className="px-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
            disabled={atout === 'flip' ? picked === null || picked === question.answer : answered}
            onClick={jouerAtout}>
            {t('classPerk.' + atout)}
          </button>
        )}
        {revele !== null && (
          <div className="t-xs" style={{ color: 'var(--cyan)' }}>
            {t('classPerk.revealed', { answer: question.choices[revele] })}
          </div>
        )}

        {picked === -1 && (
          <div className="t-xs t-red">{t('quiz.timeOut')}</div>
        )}

        {answered && (
          <>
            <div className="px-box" style={{ padding: '6px 12px', borderColor: picked === question.answer ? 'var(--green)' : 'var(--red)' }}>
              <span className="t-xs" style={{ color: picked === question.answer ? 'var(--green)' : 'var(--red)' }}>
                {picked === question.answer ? t('quiz.correct') : t('quiz.wrong')}
                {question.impossible ? t('quiz.impossibleNote') : ''}
              </span>
            </div>
            <button className="px-btn px-btn--primary" onClick={next}>
              {isLast ? t('quiz.seeVerdict') : t('quiz.nextQuestion')}
            </button>
          </>
        )}
      </div>
    )
  }

  // ── RÉSULTAT ─────────────────────────────────────────────────────────────
  if (phase === 'result') {
    return (
      <div className="layout" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <div className="t-xs t-dim t-center mb8">{t('result.header')}</div>
          <div className="px-box" style={{ borderColor: result.free ? 'var(--green)' : 'var(--red)' }}>
            <div className="t-sm mb8" style={{ color: result.free ? 'var(--green)' : 'var(--red)' }}>
              {result.free ? t('result.released') : t('result.incarcerated')}
            </div>
            <div className="t-xs t-dim" style={{ lineHeight: '2.2' }}>{result.text}</div>
          </div>
          {result.free
            ? <button className="px-btn px-btn--primary mt8" onClick={() => goTo('station-hub')}>{t('result.backToStation')}</button>
            : <button className="px-btn px-btn--danger mt8" onClick={() => goTo('prison')}>{t('result.joinCell')}</button>
          }
        </div>
      </div>
    )
  }

  // ── CHOIX ────────────────────────────────────────────────────────────────
  return (
    <div className="layout">
      <div className="t-xs t-dim t-center" style={{ letterSpacing: '3px' }}>
        {t('choices.header')}
      </div>

      <div className="px-box" style={{ borderColor: profile.tone }}>
        <div className="t-xs t-dim" style={{ lineHeight: '2' }}>
          {t('choices.waiting')}
        </div>
      </div>

      <div className="col gap4">

        {/* PARLER LIBREMENT */}
        <div className="px-box" style={{ padding: '8px 12px' }}>
          <div className="t-xs t-dim" style={{ lineHeight: '1.8' }}>
            {t('choices.talkWarning')}
          </div>
        </div>
        <button className="px-btn" onClick={() => {
          const confiscated = Math.min(gs.credits, Math.floor(gs.credits * 0.25))
          const pillarDelta = info.faction.includes('Raphazarus') ? shiftPillar(gs, 'raphazarus', +5)
            : info.faction.includes('Emporium') ? shiftPillar(gs, 'cesarion', +5)
            : gs.pillarStanding
          free(
            t('choices.talkResult', { amount: confiscated }),
            { credits: gs.credits - confiscated, reputation: gs.reputation - 10, pastDecisions: addDecision(gs, 'cooperated-interrogation'), pillarStanding: pillarDelta, journal: addJournal(gs, t('choices.talkJournal', { faction: info.faction }), 'decision') }
          )
        }}>
          {t('choices.talkFreely')}
        </button>

        {/* NIER TOUT */}
        <button className="px-btn" onClick={() => {
          const roll = Math.random()
          if (roll < 0.45) {
            free(
              t('choices.denySuccess'),
              { reputation: gs.reputation - 5, journal: addJournal(gs, t('choices.denySuccessJournal'), 'decision') }
            )
          } else if (roll < 0.75) {
            prison(
              t('choices.denyMidFail'),
              rng(2, 4),
              { reputation: gs.reputation - 15, journal: addJournal(gs, t('choices.denyMidFailJournal'), 'prison') }
            )
          } else {
            prison(
              t('choices.denyBadFail'),
              rng(4, 7),
              { reputation: gs.reputation - 20, journal: addJournal(gs, t('choices.denyBadFailJournal'), 'prison') }
            )
          }
        }}>
          {t('choices.denyAll')}
        </button>

        {/* SOUDOYER */}
        <button
          className="px-btn"
          disabled={gs.credits < bribeAmount}
          onClick={() => {
            const roll = Math.random()
            if (roll < 0.65) {
              free(
                t('choices.bribeSuccess', { amount: bribeAmount }),
                { credits: gs.credits - bribeAmount, journal: addJournal(gs, t('choices.bribeSuccessJournal', { station: translateStationName(gs.currentStation), amount: bribeAmount }), 'decision') }
              )
            } else {
              patch({ credits: gs.credits - bribeAmount })
              prison(
                t('choices.bribeFail', { amount: bribeAmount }),
                rng(3, 5),
                { journal: addJournal(gs, t('choices.bribeFailJournal'), 'prison') }
              )
            }
          }}>
          {t('choices.bribe', { amount: bribeAmount.toLocaleString(), missing: gs.credits < bribeAmount ? t('choices.bribeMissing', { amount: (bribeAmount - gs.credits).toLocaleString() }) : '' })}
        </button>

        {/* RÉSISTER PHYSIQUEMENT */}
        <button className="px-btn" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => {
          const roll = Math.random()
          if (roll < 0.15) {
            free(
              t('choices.resistSuccess'),
              { playerHp: Math.max(1, gs.playerHp - rng(30, 55)), prisonEscapes: gs.prisonEscapes + 1, reputation: gs.reputation + 20, pastDecisions: addDecision(gs, 'escaped-interrogation'), journal: addJournal(gs, t('choices.resistSuccessJournal'), 'prison') }
            )
          } else {
            prison(
              t('choices.resistFail'),
              rng(4, 8),
              { playerHp: Math.max(1, gs.playerHp - rng(35, 65)), journal: addJournal(gs, t('choices.resistFailJournal'), 'prison') }
            )
          }
        }}>
          {t('choices.resist')}
        </button>

        {/* DONNER UN NOM — option morale noire */}
        <button className="px-btn" style={{ color: 'var(--dim)' }} onClick={() => {
          free(
            t('choices.betrayResult'),
            {
              reputation: gs.reputation - 25,
              moralTags: [...(gs.moralTags ?? []), 'délateur'],
              credits: gs.credits + 500,
              pastDecisions: addDecision(gs, 'betrayed-at-interrogation'),
              journal: addJournal(gs, t('choices.betrayJournal'), 'decision'),
            }
          )
        }}>
          {t('choices.betray')}
        </button>

      </div>
    </div>
  )

  function rng(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
