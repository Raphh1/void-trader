import i18n from '../i18n/config'
import type { Quest, QuestText } from '../types'
import { translateGood, translateStationName, translateEnemyName } from './goodsI18n'

// Les textes de quête étaient rendus une fois, à la génération, puis persistés
// tels quels dans la sauvegarde : une quête créée en français restait en
// français après un passage en anglais, au milieu d'une interface traduite.
//
// On stocke désormais la recette (clé i18n + paramètres BRUTS, c'est-à-dire les
// noms français qui servent aussi de clés de données) et on rend le texte à
// l'affichage. `title` et `description` restent renseignés : ils servent de
// repli pour les sauvegardes antérieures, qui n'ont pas de recette.

/** Chaque paramètre est traduit selon ce qu'il désigne, d'après son nom. */
const TRADUCTEURS: Record<string, (v: string) => string> = {
  item: translateGood,
  station: translateStationName,
  target: translateStationName,
  boss: translateEnemyName,
  enemy: translateEnemyName,
}

function rendre(recette: QuestText | undefined, repli: string): string {
  if (!recette) return repli
  const ns = recette.ns ?? 'quests'
  // Titre de suite : la recette du contrat d'origine est imbriquée sous `titleKey`.
  if (recette.params.titleKey) {
    const { titleKey, ...inner } = recette.params
    return i18n.t(recette.key, { ns, title: rendre({ key: titleKey, params: inner, ns: recette.ns }, repli), defaultValue: repli })
  }
  const params: Record<string, string> = {}
  for (const [nom, valeur] of Object.entries(recette.params)) {
    const traduire = TRADUCTEURS[nom]
    params[nom] = traduire ? traduire(valeur) : valeur
  }
  // Certains chefs de station n'ont pas de nom propre : leur libellé est une
  // tournure à composer (« le chef de X »), dont la clé est transportée dans
  // les paramètres plutôt que le texte déjà rendu.
  // Le repli ne sert que si le chef n'a pas de nom : sinon on écrasait le vrai
  // nom du boss par « le chef de X » à chaque affichage.
  if (params.bossKey) {
    if (!params.boss) params.boss = i18n.t(params.bossKey, { ns: 'quests', target: params.target })
    delete params.bossKey
  }
  // Autres fragments déjà rédigés (saveur d'un rôle, « un colis »…) : la clé
  // est transportée sous `<nom>Key` et rendue ici dans la langue courante.
  for (const nom of Object.keys(params)) {
    if (!nom.endsWith('Key') || nom === 'titleKey') continue
    params[nom.slice(0, -3)] = i18n.t(params[nom], { ns })
    delete params[nom]
  }
  return i18n.t(recette.key, { ns, ...params, defaultValue: repli })
}

export function questTitle(q: Quest): string {
  return rendre(q.titleI18n, q.title)
}

export function questDescription(q: Quest): string {
  return rendre(q.descI18n, q.description)
}

// Donneurs génériques écrits en dur dans le code (quêtes de rencontre, de
// faction) : le nom français sert d'identifiant, traduit à l'affichage. Les
// noms propres ne sont pas dans la table et passent tels quels.
const DONNEURS: Record<string, string> = {
  'Expéditeur inconnu': 'expediteurInconnu',
  'Vieux Drela': 'vieuxDrela',
  'Vieux Doss': 'vieuxDoss',
  'Marchande': 'marchande',
  'Marchand reconnaissant': 'marchandReconnaissant',
  'Mécanicien local': 'mecanicienLocal',
  'Source anonyme': 'sourceAnonyme',
  'Source anonyme (Faucons)': 'sourceAnonymeFaucons',
  'Chasseur Besh': 'chasseurBesh',
  'Contact anonyme': 'contactAnonyme',
  'Caïd Orva': 'caidOrva',
  'Transfuge': 'transfuge',
  'Informateur Fen': 'informateurFen',
  'Source : assassin capturé': 'sourceAssassinCapture',
  'Faction locale': 'factionLocale',
  'Double agent': 'doubleAgent',
  'Mercenaire Cador': 'mercenaireCador',
  "Source proche d'Alanossa": 'sourceProcheAlanossa',
  'Pilote rencontré': 'piloteRencontre',
  'Ancien prisonnier': 'ancienPrisonnier',
  'Recrue désertrice': 'recrueDesertrice',
  'Hacker en fuite': 'hackerEnFuite',
  'Officier Faucon': 'officierFaucon',
  'Commandante Garde': 'commandanteGarde',
  'Agent Emporium': 'agentEmporium',
  'Disciple du Vide': 'discipleDuVide',
  'Officier': 'officier',
}

export function questGiver(q: Pick<Quest, 'giver' | 'giverI18n'>): string {
  if (q.giverI18n) return rendre(q.giverI18n, q.giver)
  const cle = DONNEURS[q.giver]
  return cle ? i18n.t(`givers.${cle}`, { ns: 'quests', defaultValue: q.giver }) : q.giver
}
