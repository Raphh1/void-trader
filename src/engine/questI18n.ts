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
  const params: Record<string, string> = {}
  for (const [nom, valeur] of Object.entries(recette.params)) {
    const traduire = TRADUCTEURS[nom]
    params[nom] = traduire ? traduire(valeur) : valeur
  }
  // Certains chefs de station n'ont pas de nom propre : leur libellé est une
  // tournure à composer (« le chef de X »), dont la clé est transportée dans
  // les paramètres plutôt que le texte déjà rendu.
  if (params.bossKey) {
    params.boss = i18n.t(params.bossKey, { ns: 'quests', target: params.target })
    delete params.bossKey
  }
  return i18n.t(recette.key, { ns: 'quests', ...params, defaultValue: repli })
}

export function questTitle(q: Quest): string {
  return rendre(q.titleI18n, q.title)
}

export function questDescription(q: Quest): string {
  return rendre(q.descI18n, q.description)
}
