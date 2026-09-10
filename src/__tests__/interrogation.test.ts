import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n, setLanguage } from '../i18n/config'
import { drawInterrogation, interrogatorKind, INTERROGATION_PASS_SCORE, INTERROGATION_TOTAL,
  type InterrogatorKind } from '../data/interrogationQuestions'

// Le quiz d'interrogatoire repose sur des données saisies à la main : une bonne
// réponse mal placée ou un pool trop maigre ne casse rien au démarrage, ça se
// découvre en jeu. Ces tests couvrent la structure ET l'équilibrage.

beforeAll(async () => { await initI18n() })

const KINDS: InterrogatorKind[] = ['local', 'raphazarus', 'emporium', 'gardiens']

describe('interrogatoire', () => {

  it('classe correctement chaque autorité', () => {
    expect(interrogatorKind('Soldats de Raphazarus')).toBe('raphazarus')
    expect(interrogatorKind('Emporium')).toBe('emporium')
    expect(interrogatorKind('Gardiens Écarlates')).toBe('gardiens')
    expect(interrogatorKind('Milice locale')).toBe('local')
    // Les profils Emporium et Gardiens existaient sans qu'aucun déclencheur ne
    // puisse les atteindre : ils sont désormais joignables via la capture.
  })

  it('tire un questionnaire complet et cohérent pour chaque autorité', () => {
    for (const kind of KINDS) {
      const quiz = drawInterrogation(kind)
      expect(quiz.length, kind).toBe(INTERROGATION_TOTAL)
      for (const q of quiz) {
        expect(q.choices.length, kind + ' : ' + q.q).toBe(4)
        expect(q.answer, kind + ' : réponse hors bornes').toBeGreaterThanOrEqual(0)
        expect(q.answer, kind + ' : réponse hors bornes').toBeLessThan(q.choices.length)
        expect(q.q.length, kind + ' : question vide').toBeGreaterThan(0)
      }
      // Pas de doublon dans un même questionnaire.
      const textes = quiz.map(q => q.q)
      expect(new Set(textes).size, kind + ' : question répétée').toBe(textes.length)
    }
  })

  it('mélange réellement la position de la bonne réponse', () => {
    // Les données rangent toujours la bonne réponse en premier : si le mélange
    // ne se faisait pas, elle serait toujours en position 0 et le quiz serait
    // trivial.
    const positions = new Set<number>()
    for (let i = 0; i < 200; i++) {
      for (const q of drawInterrogation('local')) positions.add(q.answer)
    }
    expect(positions.size, 'la bonne réponse est toujours au même endroit').toBeGreaterThan(1)
  })

  it('reste gagnable par qui sait répondre, sans être offert', () => {
    // Joueur qui répond juste à tout ce qui est répondable et devine au hasard
    // sur les questions absurdes.
    let reussites = 0
    const N = 3000
    for (let i = 0; i < N; i++) {
      const quiz = drawInterrogation(KINDS[i % KINDS.length])
      let score = 0
      for (const q of quiz) {
        if (q.impossible) { if (Math.random() < 1 / q.choices.length) score++ }
        else score++
      }
      if (score >= INTERROGATION_PASS_SCORE) reussites++
    }
    const taux = Math.round(reussites / N * 100)
    console.log('\n── ÉQUILIBRAGE DU QUIZ ──')
    console.log('  ' + INTERROGATION_TOTAL + ' questions, seuil ' + INTERROGATION_PASS_SCORE)
    console.log('  joueur qui sait répondre : ' + taux + ' % de réussite')

    // Qui répond juste à tout le répondable doit passer : sinon le mécanisme
    // punit la connaissance, ce qui n'a aucun intérêt.
    expect(taux, 'un joueur compétent échoue trop souvent').toBeGreaterThan(95)
  })

  it('ne se laisse pas passer au hasard', () => {
    let reussites = 0
    const N = 3000
    for (let i = 0; i < N; i++) {
      const quiz = drawInterrogation(KINDS[i % KINDS.length])
      let score = 0
      for (const q of quiz) if (Math.random() < 1 / q.choices.length) score++
      if (score >= INTERROGATION_PASS_SCORE) reussites++
    }
    const taux = reussites / N * 100
    console.log('  répondu totalement au hasard : ' + taux.toFixed(1) + ' %')
    expect(taux, 'le quiz se passe au hasard').toBeLessThan(2)
  })

  it('garde les deux langues alignées', async () => {
    for (const lang of ['fr', 'en'] as const) {
      await setLanguage(lang)
      for (const kind of KINDS) {
        const quiz = drawInterrogation(kind)
        expect(quiz.length, lang + '/' + kind).toBe(INTERROGATION_TOTAL)
        for (const q of quiz) expect(q.choices.length, lang + '/' + kind).toBe(4)
      }
    }
    await setLanguage('fr')
  })
})
