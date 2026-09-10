// Banque de questions pour l'interrogatoire (cf. InterrogationScreen).
// Quand le joueur tombe entre les mains d'une autorité, ses geôliers lui posent
// une série de questions « culturelles » — la plupart sont faciles, mais dans
// le lot se cachent des questions absurdes que personne ne peut raisonnablement
// savoir. Il faut 8 bonnes réponses sur 12 pour sortir.
//
// Chaque interrogateur a son propre registre : la milice locale demande du
// terre-à-terre, les soldats de Raphazarus parlent sièges et lames, l'Emporium
// teste la comptabilité, les Gardiens le règlement. Sans ces pools distincts,
// la blague s'userait dès le troisième interrogatoire.
//
// Les données rangent TOUJOURS la bonne réponse en première position, et le
// tirage mélange les choix. Auparavant les bonnes réponses vivaient dans des
// tableaux d'index parallèles au texte : ajouter une question quelque part
// décalait silencieusement toutes les réponses suivantes.
import i18n from '../i18n/config'

export type InterrogatorKind = 'local' | 'raphazarus' | 'emporium' | 'gardiens'

export interface InterrogationQuestion {
  q: string
  choices: string[]
  answer: number       // index de la bonne réponse APRÈS mélange
  impossible?: boolean // question piège : personne ne peut raisonnablement savoir
}

interface QuestionBrute { q: string; choices: string[] }

function lire(chemin: string): QuestionBrute[] {
  const brut = i18n.t(chemin, { ns: 'interrogationQuestions', returnObjects: true })
  return Array.isArray(brut) ? brut as QuestionBrute[] : []
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Mélange les choix et retrouve où la bonne réponse a atterri. */
function melangerChoix(q: QuestionBrute, impossible: boolean): InterrogationQuestion {
  const bonne = q.choices[0]
  const choices = shuffle(q.choices)
  return { q: q.q, choices, answer: choices.indexOf(bonne), impossible }
}

// Composition d'un interrogatoire : 6 faciles + 4 thématiques + 2 absurdes.
// Seuil mesuré sur des profils de joueurs plutôt que choisi au doigt mouillé.
// À 8, même un joueur distrait passait deux fois sur trois — aucune tension. À
// 9 : joueur attentif 95 %, moyen 68 %, distrait 38 %. Échouer n'est pas fatal
// (la cellule reste jouable), donc le mécanisme peut se permettre de mordre.
const NB_THEMATIQUES = 4
const NB_FACILES = 6
const NB_ABSURDES = 2

export const INTERROGATION_PASS_SCORE = 9
export const INTERROGATION_TOTAL = NB_THEMATIQUES + NB_FACILES + NB_ABSURDES

export function drawInterrogation(kind: InterrogatorKind = 'local'): InterrogationQuestion[] {
  const thematiques = shuffle(lire(`${kind}.themed`)).slice(0, NB_THEMATIQUES)
  const faciles = shuffle(lire('common.easy')).slice(0, NB_FACILES)
  // Les absurdes propres à l'interrogateur passent avant les génériques : c'est
  // là que sa personnalité s'entend le mieux.
  const absurdes = shuffle([...lire(`${kind}.impossible`), ...lire('common.impossible')]).slice(0, NB_ABSURDES)

  // Filet : deux pools pourraient un jour proposer la même question, et la
  // voir deux fois dans le même interrogatoire ferait amateur.
  const vues = new Set<string>()
  const unique = (liste: InterrogationQuestion[]) => liste.filter(q => !vues.has(q.q) && vues.add(q.q))

  return shuffle(unique([
    ...thematiques.map(q => melangerChoix(q, false)),
    ...faciles.map(q => melangerChoix(q, false)),
    ...absurdes.map(q => melangerChoix(q, true)),
  ]))
}

/** Quelle autorité interroge, d'après le nom de faction porté par la capture. */
export function interrogatorKind(faction: string): InterrogatorKind {
  if (faction.includes('Raphazarus')) return 'raphazarus'
  if (faction.includes('Emporium') || faction.includes('Cesarion') || faction.includes('Pistis')) return 'emporium'
  if (faction.includes('Gardien') || faction.includes('Kharos') || faction.includes('Écarlate')) return 'gardiens'
  return 'local'
}
