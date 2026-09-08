import type { Enemy } from '../types'
import i18n from '../i18n/config'

const en = (key: string) => i18n.t(key, { ns: 'enemies' })

// Ces getters reconstruisent leurs tableaux à chaque appel pour suivre la langue
// active. C'est nécessaire, mais coûteux : stationPoolMap() reconstruisait les
// 161 ennemis des dizaines de fois par tirage (~79 ms par rencontre, soit un gel
// visible sur mobile). On mémoïse par langue : le cache est invalidé dès que la
// langue change, donc le texte reste correct. Sûr car aucun objet Enemy n'est
// muté en place (les PV de combat vivent dans CombatState, scaleEnemy copie).
function memoByLang<T>(build: () => T): () => T {
  let cachedLang: string | null = null
  let cached: T
  return () => {
    if (cachedLang !== i18n.language) {
      cached = build()
      cachedLang = i18n.language
    }
    return cached
  }
}

function buildTierLow(): Enemy[] {
  return [
  { name: 'Pickpocket désespéré',     maxHp: 20, damageMin: 3,  damageMax: 8,  lootMin: 50,  lootMax: 180, description: en('lowTier.pickpocketDesespere'),                  captureChance: 20, killChance: 5,  isBoss: false, role: 'normal' },
  { name: 'Ivrogne agressif',         maxHp: 25, damageMin: 2,  damageMax: 7,  lootMin: 40,  lootMax: 120, description: en('lowTier.ivrogneAgressif'),                      captureChance: 20, killChance: 5,  isBoss: false, role: 'normal' },
  { name: 'Garde corrompu',           maxHp: 35, damageMin: 5,  damageMax: 12, lootMin: 120,  lootMax: 360, description: en('lowTier.gardeCorrompu'),                 captureChance: 25, killChance: 10, isBoss: false, role: 'normal' },
  { name: 'Vagabond armé',            maxHp: 30, damageMin: 4,  damageMax: 10, lootMin: 60,  lootMax: 240, description: en('lowTier.vagabondArme'),                            captureChance: 20, killChance: 8,  isBoss: false, role: 'normal' },
  { name: 'Scavenger opportuniste',   maxHp: 28, damageMin: 4,  damageMax: 11, lootMin: 90,  lootMax: 300, description: en('lowTier.scavengerOpportuniste'),             captureChance: 20, killChance: 8,  isBoss: false, role: 'normal' },
  { name: 'Milicien de pacotille',    maxHp: 32, damageMin: 4,  damageMax: 10, lootMin: 70,  lootMax: 270, description: en('lowTier.milicienDePacotille'),   captureChance: 30, killChance: 8,  isBoss: false, role: 'normal' },
  { name: 'Chasseur de primes novice',maxHp: 38, damageMin: 5,  damageMax: 13, lootMin: 110,  lootMax: 330, description: en('lowTier.chasseurDePrimesNovice'),           captureChance: 35, killChance: 10, isBoss: false, role: 'normal' },
  { name: 'Gamin de la zone',         maxHp: 18, damageMin: 2,  damageMax: 6,  lootMin: 20,  lootMax: 110, description: en('lowTier.gaminDeLaZone'),       captureChance: 10, killChance: 3,  isBoss: false, role: 'normal' },
  { name: 'Ouvrier en colère',        maxHp: 40, damageMin: 5,  damageMax: 11, lootMin: 50,  lootMax: 210, description: en('lowTier.ouvrierEnColere'),        captureChance: 25, killChance: 5,  isBoss: false, role: 'normal' },
  { name: 'Mendiant armé',            maxHp: 22, damageMin: 3,  damageMax: 8,  lootMin: 20,  lootMax: 100, description: en('lowTier.mendiantArme'),          captureChance: 15, killChance: 4,  isBoss: false, role: 'normal' },
  { name: 'Pilote raté',              maxHp: 28, damageMin: 3,  damageMax: 9,  lootMin: 60,  lootMax: 240, description: en('lowTier.piloteRate'), captureChance: 20, killChance: 7,  isBoss: false, role: 'normal' },
  { name: 'Toxicomane sous injection',maxHp: 15, damageMin: 4,  damageMax: 14, lootMin: 30,  lootMax: 150, description: en('lowTier.toxicomaneSousInjection'),  captureChance: 10, killChance: 8,  isBoss: false, role: 'normal' },
  { name: 'Rat de cargaison',         maxHp: 24, damageMin: 2,  damageMax: 7,  lootMin: 40,  lootMax: 180, description: en('lowTier.ratDeCargaison'),      captureChance: 20, killChance: 5,  isBoss: false, role: 'normal' },
  { name: 'Sous-officier véreux',     maxHp: 36, damageMin: 6,  damageMax: 12, lootMin: 120,  lootMax: 360, description: en('lowTier.sousOfficierVereux'),                captureChance: 30, killChance: 10, isBoss: false, role: 'normal' },
  { name: 'Fuyarde paniquée',         maxHp: 20, damageMin: 3,  damageMax: 9,  lootMin: 50,  lootMax: 180, description: en('lowTier.fuyardePaniquee'),          captureChance: 15, killChance: 3,  isBoss: false, role: 'normal' },
  { name: 'Réparateur jaloux',        maxHp: 33, damageMin: 4,  damageMax: 10, lootMin: 70,  lootMax: 250, description: en('lowTier.reparateurJaloux'),  captureChance: 20, killChance: 6,  isBoss: false, role: 'normal' },
  { name: 'Drogué au Synth',          maxHp: 26, damageMin: 5,  damageMax: 15, lootMin: 40,  lootMax: 130, description: en('lowTier.drogueAuSynth'),           captureChance: 10, killChance: 9,  isBoss: false, role: 'normal' },
  { name: 'Éclaireur Faucon',         maxHp: 32, damageMin: 4,  damageMax: 11, lootMin: 90,  lootMax: 300, description: en('lowTier.eclaireurFaucon'),  captureChance: 20, killChance: 8,  isBoss: false, role: 'normal' },
  { name: 'Recrue Gardienne',         maxHp: 35, damageMin: 5,  damageMax: 11, lootMin: 80,  lootMax: 290, description: en('lowTier.recrueGardienne'),      captureChance: 25, killChance: 7,  isBoss: false, role: 'normal' },
  { name: 'Vigile Emporium',          maxHp: 30, damageMin: 3,  damageMax: 10, lootMin: 70,  lootMax: 250, description: en('lowTier.vigileEmporium'), captureChance: 25, killChance: 6, isBoss: false, role: 'normal' },
  { name: 'Mineur agressif',          maxHp: 42, damageMin: 5,  damageMax: 12, lootMin: 60,  lootMax: 230, description: en('lowTier.mineurAgressif'),                      captureChance: 20, killChance: 8,  isBoss: false, role: 'tank'   },
  { name: 'Survivant des ruines',     maxHp: 26, damageMin: 4,  damageMax: 11, lootMin: 50,  lootMax: 190, description: en('lowTier.survivantDesRuines'),             captureChance: 15, killChance: 9,  isBoss: false, role: 'normal' },
  { name: 'Déserteur en errance',     maxHp: 35, damageMin: 5,  damageMax: 12, lootMin: 80,  lootMax: 270, description: en('lowTier.deserteurEnErrance'), captureChance: 15, killChance: 8,  isBoss: false, role: 'normal' },
  { name: 'Junkie aux implants',      maxHp: 28, damageMin: 6,  damageMax: 16, lootMin: 50,  lootMax: 180, description: en('lowTier.junkieAuxImplants'), captureChance: 10, killChance: 12, isBoss: false, role: 'normal' },
  { name: 'Messager intercepté',      maxHp: 24, damageMin: 3,  damageMax: 8,  lootMin: 90,  lootMax: 300, description: en('lowTier.messagerIntercepte'), captureChance: 20, killChance: 5,  isBoss: false, role: 'normal' },
  { name: 'Récupérateur de dettes',   maxHp: 38, damageMin: 6,  damageMax: 14, lootMin: 120,  lootMax: 360, description: en('lowTier.recuperateurDeDettes'), captureChance: 30, killChance: 8, isBoss: false, role: 'normal' },
  { name: 'Contrebandier junior',     maxHp: 30, damageMin: 4,  damageMax: 10, lootMin: 70,  lootMax: 240, description: en('lowTier.contrebandierJunior'), captureChance: 20, killChance: 7, isBoss: false, role: 'normal' },
  { name: 'Garde-frontière véreux',   maxHp: 36, damageMin: 5,  damageMax: 12, lootMin: 110,  lootMax: 330, description: en('lowTier.gardeFrontiereVereux'), captureChance: 25, killChance: 9,  isBoss: false, role: 'normal' },
  { name: 'Pilote sabordé',           maxHp: 28, damageMin: 4,  damageMax: 10, lootMin: 60,  lootMax: 230, description: en('lowTier.piloteSaborde'), captureChance: 18, killChance: 7, isBoss: false, role: 'normal' },
  { name: 'Enfant soldat recyclé',    maxHp: 22, damageMin: 5,  damageMax: 14, lootMin: 40,  lootMax: 130, description: en('lowTier.enfantSoldatRecycle'), captureChance: 10, killChance: 10, isBoss: false, role: 'normal' },
  { name: 'Garde pénitentiaire rogue',maxHp: 40, damageMin: 5,  damageMax: 13, lootMin: 100,  lootMax: 300, description: en('lowTier.gardePenitentiaireRogue'), captureChance: 25, killChance: 8,  isBoss: false, role: 'normal' },
  { name: 'Chasseur de tête local',   maxHp: 34, damageMin: 6,  damageMax: 14, lootMin: 120,  lootMax: 360, description: en('lowTier.chasseurDeTeteLocal'), captureChance: 20, killChance: 10, isBoss: false, role: 'normal' },
  { name: 'Soldat de faction blessé', maxHp: 32, damageMin: 4,  damageMax: 11, lootMin: 80,  lootMax: 270, description: en('lowTier.soldatDeFactionBlesse'), captureChance: 20, killChance: 7,  isBoss: false, role: 'normal' },
]
}

function buildTierMid(): Enemy[] {
  return [
  { name: 'Pirate solitaire',          maxHp: 50, damageMin: 8,  damageMax: 18, lootMin: 240,  lootMax: 540,  description: en('midTier.pirateSolitaire'),              captureChance: 25, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Mercenaire bas de gamme',   maxHp: 55, damageMin: 9,  damageMax: 20, lootMin: 300,  lootMax: 600, description: en('midTier.mercenaireBasDeGamme'),                      captureChance: 20, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Contrebandier défensif',    maxHp: 45, damageMin: 7,  damageMax: 16, lootMin: 210,  lootMax: 480,  description: en('midTier.contrebandierDefensif'),       captureChance: 20, killChance: 15, isBoss: false, role: 'normal' },
  { name: 'Chasseur de primes',        maxHp: 60, damageMin: 10, damageMax: 22, lootMin: 360,  lootMax: 720, description: en('midTier.chasseurDePrimes'),                  captureChance: 35, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Gang de rue spatial',       maxHp: 65, damageMin: 8,  damageMax: 19, lootMin: 270,  lootMax: 570,  description: en('midTier.gangDeRueSpatial'),                             captureChance: 20, killChance: 18, isBoss: false, role: 'normal' },
  { name: 'Déserteur armé',            maxHp: 58, damageMin: 9,  damageMax: 21, lootMin: 290,  lootMax: 600, description: en('midTier.deserteurArme'),        captureChance: 15, killChance: 25, isBoss: false, role: 'normal' },
  { name: 'Assassin de bas étage',     maxHp: 48, damageMin: 12, damageMax: 25, lootMin: 330,  lootMax: 660, description: en('midTier.assassinDeBasEtage'),                 captureChance: 10, killChance: 30, isBoss: false, role: 'normal' },
  { name: 'Pirate reconverti',         maxHp: 52, damageMin: 8,  damageMax: 17, lootMin: 240,  lootMax: 510,  description: en('midTier.pirateReconverti'),     captureChance: 25, killChance: 15, isBoss: false, role: 'normal' },
  { name: 'Officier renégat',          maxHp: 70, damageMin: 11, damageMax: 23, lootMin: 360,  lootMax: 780, description: en('midTier.officierRenegat'),captureChance: 20, killChance: 22, isBoss: false, role: 'normal' },
  { name: 'Trafiquant d\'organes',     maxHp: 55, damageMin: 9,  damageMax: 20, lootMin: 420,  lootMax: 900, description: en('midTier.trafiquantDOrganes'), captureChance: 30, killChance: 25, isBoss: false, role: 'normal' },
  { name: 'Tireur embusqué',           maxHp: 42, damageMin: 13, damageMax: 28, lootMin: 300,  lootMax: 600, description: en('midTier.tireurEmbusque'),                             captureChance: 10, killChance: 30, isBoss: false, role: 'ranged' },
  { name: 'Sergent des bas-fonds',     maxHp: 75, damageMin: 10, damageMax: 20, lootMin: 330,  lootMax: 660, description: en('midTier.sergentDesBasFonds'),  captureChance: 25, killChance: 18, isBoss: false, role: 'tank' },
  { name: 'Hacker de rue',             maxHp: 44, damageMin: 7,  damageMax: 15, lootMin: 270,  lootMax: 540,  description: en('midTier.hackerDeRue'), captureChance: 20, killChance: 15, isBoss: false, role: 'ranged' },
  { name: 'Dresseur de bêtes mutantes',maxHp: 62, damageMin: 10, damageMax: 22, lootMin: 300,  lootMax: 600, description: en('midTier.dresseurDeBetesMutantes'),                captureChance: 15, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Caïd de station',           maxHp: 68, damageMin: 9,  damageMax: 19, lootMin: 360,  lootMax: 720, description: en('midTier.caidDeStation'), captureChance: 20, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Agent double',              maxHp: 50, damageMin: 10, damageMax: 22, lootMin: 390,  lootMax: 840, description: en('midTier.agentDouble'), captureChance: 15, killChance: 25, isBoss: false, role: 'normal' },
  { name: 'Gladiateur sans contrat',   maxHp: 80, damageMin: 12, damageMax: 24, lootMin: 300,  lootMax: 600, description: en('midTier.gladiateurSansContrat'),       captureChance: 10, killChance: 20, isBoss: false, role: 'tank' },
  { name: 'Agent Faucon infiltré',     maxHp: 52, damageMin: 10, damageMax: 22, lootMin: 330,  lootMax: 660, description: en('midTier.agentFauconInfiltre'),          captureChance: 15, killChance: 25, isBoss: false, role: 'normal' },
  { name: 'Soldat Gardien Écarlate',   maxHp: 68, damageMin: 9,  damageMax: 20, lootMin: 300,  lootMax: 630, description: en('midTier.soldatGardienEcarlate'),       captureChance: 25, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Garde Emporium armé',       maxHp: 60, damageMin: 11, damageMax: 23, lootMin: 360,  lootMax: 720, description: en('midTier.gardeEmporiumArme'),             captureChance: 30, killChance: 18, isBoss: false, role: 'normal' },
  { name: 'Scavenger vétéran',         maxHp: 55, damageMin: 8,  damageMax: 19, lootMin: 290,  lootMax: 600, description: en('midTier.scavengerVeteran'),      captureChance: 20, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Mercenaire des ruines',     maxHp: 62, damageMin: 10, damageMax: 22, lootMin: 310,  lootMax: 630, description: en('midTier.mercenaireDesRuines'),   captureChance: 20, killChance: 22, isBoss: false, role: 'normal' },
  { name: 'Chasseur de reliques',      maxHp: 58, damageMin: 9,  damageMax: 20, lootMin: 330,  lootMax: 660, description: en('midTier.chasseurDeReliques'),          captureChance: 15, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Vétéran de la Purge',       maxHp: 72, damageMin: 12, damageMax: 24, lootMin: 360,  lootMax: 720, description: en('midTier.veteranDeLaPurge'),           captureChance: 10, killChance: 28, isBoss: false, role: 'normal' },
  { name: 'Technomercenaire',          maxHp: 52, damageMin: 10, damageMax: 22, lootMin: 300,  lootMax: 630, description: en('midTier.technomercenaire'), captureChance: 15, killChance: 22, isBoss: false, role: 'ranged' },
  { name: 'Recéleur défensif',         maxHp: 45, damageMin: 8,  damageMax: 17, lootMin: 360,  lootMax: 780, description: en('midTier.receleurDefensif'),   captureChance: 25, killChance: 15, isBoss: false, role: 'normal' },
  { name: 'Soldat de fortune Faucon',  maxHp: 65, damageMin: 11, damageMax: 22, lootMin: 310,  lootMax: 630, description: en('midTier.soldatDeFortuneFaucon'),                     captureChance: 15, killChance: 22, isBoss: false, role: 'normal' },
  { name: 'Ingénieur de sabotage',     maxHp: 55, damageMin: 10, damageMax: 22, lootMin: 310,  lootMax: 630, description: en('midTier.ingenieurDeSabotage'), captureChance: 15, killChance: 20, isBoss: false, role: 'ranged' },
  { name: 'Trafiquant en réseau',      maxHp: 50, damageMin: 9,  damageMax: 19, lootMin: 360,  lootMax: 750, description: en('midTier.trafiquantEnReseau'), captureChance: 20, killChance: 18, isBoss: false, role: 'normal' },
  { name: 'Espion retourné',           maxHp: 52, damageMin: 10, damageMax: 21, lootMin: 350,  lootMax: 690, description: en('midTier.espionRetourne'), captureChance: 15, killChance: 22, isBoss: false, role: 'normal' },
  { name: 'Commandant de milice',      maxHp: 70, damageMin: 11, damageMax: 23, lootMin: 360,  lootMax: 720, description: en('midTier.commandantDeMilice'), captureChance: 20, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Chasseur mutant',           maxHp: 65, damageMin: 13, damageMax: 26, lootMin: 290,  lootMax: 590,  description: en('midTier.chasseurMutant'), captureChance: 10, killChance: 28, isBoss: false, role: 'normal' },
  { name: 'Artilleur de section',      maxHp: 60, damageMin: 12, damageMax: 25, lootMin: 330,  lootMax: 660, description: en('midTier.artilleurDeSection'), captureChance: 15, killChance: 25, isBoss: false, role: 'ranged' },
]
}

function buildTierHigh(): Enemy[] {
  return [
  { name: 'Élite des Faucons Noirs',     maxHp: 120, damageMin: 20, damageMax: 40, lootMin: 600,  lootMax: 1500, description: en('highTier.eliteDesFauconsNoirs'),               captureChance: 15, killChance: 25, isBoss: false, role: 'normal' },
  { name: 'Garde de l\'Emporium',        maxHp: 130, damageMin: 18, damageMax: 38, lootMin: 480,  lootMax: 1200, description: en('highTier.gardeDeLEmporium'),              captureChance: 40, killChance: 5,  isBoss: false, role: 'tank' },
  { name: 'Assassin du Conclave',        maxHp: 100, damageMin: 25, damageMax: 48, lootMin: 900,  lootMax: 2100, description: en('highTier.assassinDuConclave'),                captureChance: 10, killChance: 35, isBoss: false, role: 'ranged' },
  { name: 'Garde du corps impitoyable',  maxHp: 140, damageMin: 22, damageMax: 42, lootMin: 720,  lootMax: 1800, description: en('highTier.gardeDuCorpsImpitoyable'),  captureChance: 20, killChance: 25, isBoss: false, role: 'normal' },
  { name: 'Soldat de Noctis',            maxHp: 115, damageMin: 20, damageMax: 38, lootMin: 540,  lootMax: 1320, description: en('highTier.soldatDeNoctis'),                               captureChance: 10, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Médecin de guerre ennemi',    maxHp: 90,  damageMin: 15, damageMax: 30, lootMin: 600,  lootMax: 1500, description: en('highTier.medecinDeGuerreEnnemi'),      captureChance: 20, killChance: 15, isBoss: false, role: 'support' },
  { name: 'Chasseur de trophées',        maxHp: 110, damageMin: 22, damageMax: 44, lootMin: 660,  lootMax: 1680, description: en('highTier.chasseurDeTrophees'),            captureChance: 5,  killChance: 40, isBoss: false, role: 'ranged' },
  { name: 'Ingénieur de guerre',         maxHp: 105, damageMin: 18, damageMax: 36, lootMin: 600,  lootMax: 1440, description: en('highTier.ingenieurDeGuerre'), captureChance: 20, killChance: 20, isBoss: false, role: 'normal' },
  { name: 'Commandant renégat',          maxHp: 150, damageMin: 24, damageMax: 45, lootMin: 840,  lootMax: 2100, description: en('highTier.commandantRenegat'), captureChance: 20, killChance: 28, isBoss: false, role: 'normal' },
  { name: 'Fantôme de la Garde Noire',   maxHp: 95,  damageMin: 26, damageMax: 50, lootMin: 960,  lootMax: 2280, description: en('highTier.fantomeDeLaGardeNoire'), captureChance: 5, killChance: 40, isBoss: false, role: 'ranged' },
  { name: 'Berserker augmenté',          maxHp: 160, damageMin: 25, damageMax: 50, lootMin: 720,  lootMax: 1800, description: en('highTier.berserkerAugmente'), captureChance: 5, killChance: 35, isBoss: false, role: 'tank' },
  { name: 'Exécuteur du Tribunal',       maxHp: 125, damageMin: 22, damageMax: 42, lootMin: 780,  lootMax: 1920, description: en('highTier.executeurDuTribunal'), captureChance: 20, killChance: 30, isBoss: false, role: 'normal' },
  { name: 'Pilote de combat au sol',     maxHp: 108, damageMin: 20, damageMax: 40, lootMin: 570,  lootMax: 1380, description: en('highTier.piloteDeCombatAuSol'), captureChance: 10, killChance: 25, isBoss: false, role: 'normal' },
  { name: 'Sniper des abysses',          maxHp: 85,  damageMin: 28, damageMax: 55, lootMin: 900,  lootMax: 2100, description: en('highTier.sniperDesAbysses'), captureChance: 5, killChance: 45, isBoss: false, role: 'ranged' },
  { name: 'Garde d\'honneur brisé',      maxHp: 135, damageMin: 20, damageMax: 40, lootMin: 660,  lootMax: 1620, description: en('highTier.gardeDHonneurBrise'), captureChance: 15, killChance: 28, isBoss: false, role: 'tank' },
  { name: 'Ancien du Vide',              maxHp: 118, damageMin: 22, damageMax: 43, lootMin: 720,  lootMax: 1740, description: en('highTier.ancienDuVide'), captureChance: 10, killChance: 30, isBoss: false, role: 'normal' },
  { name: 'Traqueur de factions',        maxHp: 102, damageMin: 23, damageMax: 46, lootMin: 780,  lootMax: 1860, description: en('highTier.traqueurDeFactions'), captureChance: 10, killChance: 35, isBoss: false, role: 'normal' },
  { name: 'Commandant Faucon Noir',      maxHp: 135, damageMin: 22, damageMax: 44, lootMin: 780,  lootMax: 1920, description: en('highTier.commandantFauconNoir'),  captureChance: 15, killChance: 30, isBoss: false, role: 'normal' },
  { name: 'Capitaine Gardien Écarlate',  maxHp: 145, damageMin: 20, damageMax: 40, lootMin: 720,  lootMax: 1800, description: en('highTier.capitaineGardienEcarlate'),       captureChance: 20, killChance: 25, isBoss: false, role: 'tank'   },
  { name: "Exécuteur de l'Emporium",    maxHp: 120, damageMin: 25, damageMax: 48, lootMin: 900,  lootMax: 2100, description: en('highTier.executeurDeLEmporium'),    captureChance: 10, killChance: 35, isBoss: false, role: 'ranged' },
  { name: 'Baron des bas-fonds',         maxHp: 130, damageMin: 22, damageMax: 43, lootMin: 840,  lootMax: 1980, description: en('highTier.baronDesBasFonds'), captureChance: 15, killChance: 30, isBoss: false, role: 'normal' },
  { name: 'Vétéran des ruines',          maxHp: 110, damageMin: 24, damageMax: 46, lootMin: 720,  lootMax: 1740, description: en('highTier.veteranDesRuines'), captureChance: 10, killChance: 32, isBoss: false, role: 'normal' },
  { name: 'Thanatonaute',               maxHp: 108, damageMin: 24, damageMax: 47, lootMin: 720,  lootMax: 1740, description: en('highTier.thanatonaute'),             captureChance: 5,  killChance: 38, isBoss: false, role: 'normal' },
  { name: 'Fanatique de la Fracture',   maxHp: 115, damageMin: 22, damageMax: 44, lootMin: 660,  lootMax: 1680, description: en('highTier.fanatiqueDeLaFracture'), captureChance: 10, killChance: 32, isBoss: false, role: 'normal' },
  { name: 'Garde augmenté du Nexus',    maxHp: 128, damageMin: 20, damageMax: 40, lootMin: 600,  lootMax: 1500, description: en('highTier.gardeAugmenteDuNexus'),           captureChance: 20, killChance: 20, isBoss: false, role: 'tank'   },
  { name: 'Lame fantôme',              maxHp: 92,  damageMin: 28, damageMax: 54, lootMin: 840,  lootMax: 2040, description: en('highTier.lameFantome'),               captureChance: 5,  killChance: 42, isBoss: false, role: 'ranged' },
  { name: 'Artificier dérangé',         maxHp: 105, damageMin: 22, damageMax: 42, lootMin: 660,  lootMax: 1620, description: en('highTier.artificierDerange'),     captureChance: 10, killChance: 30, isBoss: false, role: 'normal' },
  { name: 'Général de la Dernière Guerre', maxHp: 140, damageMin: 23, damageMax: 45, lootMin: 780,  lootMax: 1860, description: en('highTier.generalDeLaDerniereGuerre'),   captureChance: 10, killChance: 32, isBoss: false, role: 'normal' },
  { name: 'Bioingénieur de combat',    maxHp: 112, damageMin: 20, damageMax: 40, lootMin: 660,  lootMax: 1620, description: en('highTier.bioingenieurDeCombat'), captureChance: 15, killChance: 28, isBoss: false, role: 'normal' },
  { name: 'Chevalier Écarlate renégat',maxHp: 145, damageMin: 22, damageMax: 44, lootMin: 720,  lootMax: 1800, description: en('highTier.chevalierEcarlateRenegat'), captureChance: 10, killChance: 35, isBoss: false, role: 'tank'   },
  { name: 'Infiltrateur de haut rang', maxHp: 98,  damageMin: 26, damageMax: 50, lootMin: 900,  lootMax: 2100, description: en('highTier.infiltrateurDeHautRang'), captureChance: 8, killChance: 40, isBoss: false, role: 'ranged' },
  { name: 'Exécuteur de la Purge',     maxHp: 130, damageMin: 22, damageMax: 43, lootMin: 720,  lootMax: 1800, description: en('highTier.executeurDeLaPurge'),                captureChance: 10, killChance: 35, isBoss: false, role: 'normal' },
  { name: 'Pilote Nexus au sol',       maxHp: 118, damageMin: 20, damageMax: 40, lootMin: 600,  lootMax: 1500, description: en('highTier.piloteNexusAuSol'),       captureChance: 15, killChance: 28, isBoss: false, role: 'normal' },
]
}

function buildTierBoss(): Enemy[] {
  return [
  { name: 'Alanossa',                    maxHp: 200, damageMin: 30, damageMax: 55, lootMin: 2400,  lootMax: 4800, description: en('bossTier.alanossa'),      captureChance: 10, killChance: 40, isBoss: true, role: 'normal' },
  { name: 'La Faucon',                   maxHp: 180, damageMin: 28, damageMax: 52, lootMin: 2100,  lootMax: 4200, description: en('bossTier.laFaucon'),        captureChance: 15, killChance: 35, isBoss: true, role: 'normal' },
  { name: 'Directeur Pale',              maxHp: 160, damageMin: 25, damageMax: 48, lootMin: 1800,  lootMax: 3600, description: en('bossTier.directeurPale'),                             captureChance: 30, killChance: 25, isBoss: true, role: 'normal' },
  { name: 'Garde du Corps d\'Eliotis',   maxHp: 150, damageMin: 22, damageMax: 45, lootMin: 1500,  lootMax: 3300, description: en('bossTier.gardeDuCorpsDEliotis'),                              captureChance: 5,  killChance: 45, isBoss: true, role: 'tank' },
  { name: 'Le Boucher de Velkor',        maxHp: 220, damageMin: 32, damageMax: 58, lootMin: 2700,  lootMax: 5400, description: en('bossTier.leBoucherDeVelkor'), captureChance: 5,  killChance: 50, isBoss: true, role: 'tank' },
  { name: 'Oracle de la Singularité',   maxHp: 140, damageMin: 35, damageMax: 65, lootMin: 3000,  lootMax: 6000, description: en('bossTier.oracleDeLaSingularite'),         captureChance: 10, killChance: 40, isBoss: true, role: 'ranged' },
  { name: 'Amiral Voss-Kheran',         maxHp: 190, damageMin: 28, damageMax: 50, lootMin: 2280,  lootMax: 4500, description: en('bossTier.amiralVossKheran'),       captureChance: 20, killChance: 30, isBoss: true, role: 'normal' },
  { name: 'La Curatrice',              maxHp: 170, damageMin: 26, damageMax: 48, lootMin: 2400,  lootMax: 4800, description: en('bossTier.laCuratrice'),    captureChance: 25, killChance: 30, isBoss: true, role: 'support' },
  { name: 'Frère Ossian le Dernier',   maxHp: 210, damageMin: 30, damageMax: 54, lootMin: 2520,  lootMax: 5100, description: en('bossTier.frereOssianLeDernier'),     captureChance: 10, killChance: 42, isBoss: true, role: 'normal' },
  { name: 'La Mère Mecanique',         maxHp: 250, damageMin: 25, damageMax: 45, lootMin: 3000,  lootMax: 7200, description: en('bossTier.laMereMecanique'),        captureChance: 5,  killChance: 35, isBoss: true, role: 'tank' },
  { name: 'Veilleur du Bout du Monde',  maxHp: 175, damageMin: 33, damageMax: 60, lootMin: 2700,  lootMax: 5400, description: en('bossTier.veilleurDuBoutDuMonde'), captureChance: 8, killChance: 45, isBoss: true, role: 'normal' },
  { name: 'L\'Architecte du Chaos',    maxHp: 165, damageMin: 30, damageMax: 58, lootMin: 2880,  lootMax: 5700, description: en('bossTier.lArchitecteDuChaos'),  captureChance: 15, killChance: 38, isBoss: true, role: 'ranged' },
  { name: 'Commandante Zara Sable',    maxHp: 185, damageMin: 27, damageMax: 50, lootMin: 2100,  lootMax: 4200, description: en('bossTier.commandanteZaraSable'),     captureChance: 20, killChance: 32, isBoss: true, role: 'normal' },
  { name: 'Le Colosse de Ferraille',   maxHp: 280, damageMin: 28, damageMax: 50, lootMin: 2400,  lootMax: 4800, description: en('bossTier.leColosseDeFerraille'),          captureChance: 5,  killChance: 30, isBoss: true, role: 'tank' },
  { name: 'Le Fantôme des Ombres',    maxHp: 130, damageMin: 35, damageMax: 62, lootMin: 1920,  lootMax: 3900, description: en('bossTier.leFantomeDesOmbres'), captureChance: 5,  killChance: 40, isBoss: true, role: 'ranged' },
  { name: 'La Bête Noire',            maxHp: 230, damageMin: 35, damageMax: 60, lootMin: 2100,  lootMax: 4200, description: en('bossTier.laBeteNoire'),         captureChance: 3,  killChance: 50, isBoss: true, role: 'tank' },
  { name: 'La Veuve de Vega',         maxHp: 155, damageMin: 28, damageMax: 52, lootMin: 2280,  lootMax: 4500, description: en('bossTier.laVeuveDeVega'),   captureChance: 12, killChance: 35, isBoss: true, role: 'normal' },
  { name: "L'Exilé Écarlate",         maxHp: 195, damageMin: 26, damageMax: 48, lootMin: 1800,  lootMax: 3600, description: en('bossTier.lExileEcarlate'), captureChance: 10, killChance: 32, isBoss: true, role: 'normal' },
  { name: 'Patient Zéro',             maxHp: 145, damageMin: 22, damageMax: 44, lootMin: 1680,  lootMax: 3300, description: en('bossTier.patientZero'),  captureChance: 20, killChance: 28, isBoss: true, role: 'support' },
  { name: "L'Ombre du Vide",          maxHp: 160, damageMin: 30, damageMax: 55, lootMin: 2100,  lootMax: 4200, description: en('bossTier.lOmbreDuVide'),                    captureChance: 8,  killChance: 42, isBoss: true, role: 'ranged' },
  { name: 'Le Roi de Nuit',              maxHp: 175, damageMin: 25, damageMax: 46, lootMin: 2400,  lootMax: 4800, description: en('bossTier.leRoiDeNuit'),          captureChance: 15, killChance: 30, isBoss: true, role: 'normal' },
  { name: 'Le Ferrailleur des Épaves',  maxHp: 170, damageMin: 26, damageMax: 48, lootMin: 1920,  lootMax: 3900, description: en('bossTier.leFerrailleurDesEpaves'),   captureChance: 10, killChance: 38, isBoss: true, role: 'tank'   },
  { name: "L'Inspecteur Véreux",        maxHp: 155, damageMin: 24, damageMax: 46, lootMin: 1800,  lootMax: 3600, description: en('bossTier.lInspecteurVereux'), captureChance: 20, killChance: 30, isBoss: true, role: 'normal' },
  { name: 'Le Baron de Vega',           maxHp: 190, damageMin: 28, damageMax: 52, lootMin: 2280,  lootMax: 4500, description: en('bossTier.leBaronDeVega'), captureChance: 10, killChance: 40, isBoss: true, role: 'normal' },
  { name: 'Le Général de Fer',          maxHp: 200, damageMin: 28, damageMax: 50, lootMin: 2100,  lootMax: 4200, description: en('bossTier.leGeneralDeFer'),           captureChance: 25, killChance: 30, isBoss: true, role: 'tank'   },
  { name: 'Protocole ΔX-7',            maxHp: 145, damageMin: 35, damageMax: 62, lootMin: 2700,  lootMax: 5400, description: en('bossTier.protocoleX7'), captureChance: 5, killChance: 45, isBoss: true, role: 'ranged' },
  { name: 'Le Geôlier des Morts',       maxHp: 175, damageMin: 27, damageMax: 50, lootMin: 1980,  lootMax: 3900, description: en('bossTier.leGeolierDesMorts'),captureChance: 15, killChance: 35, isBoss: true, role: 'normal' },
  { name: 'La Matriarche de Perséphone',maxHp: 165, damageMin: 25, damageMax: 47, lootMin: 1800,  lootMax: 3600, description: en('bossTier.laMatriarcheDePersephone'), captureChance: 20, killChance: 28, isBoss: true, role: 'support' },
  { name: 'Le Titan Mineur',            maxHp: 220, damageMin: 30, damageMax: 55, lootMin: 2400,  lootMax: 4800, description: en('bossTier.leTitanMineur'), captureChance: 5, killChance: 40, isBoss: true, role: 'tank' },
  { name: 'Le Maître-Forgeron Maudit',  maxHp: 185, damageMin: 29, damageMax: 53, lootMin: 2280,  lootMax: 4500, description: en('bossTier.leMaitreForgeronMaudit'), captureChance: 10, killChance: 38, isBoss: true, role: 'normal' },
  { name: "L'Archiviste sans Visage",   maxHp: 150, damageMin: 32, damageMax: 58, lootMin: 2400,  lootMax: 4800, description: en('bossTier.lArchivisteSansVisage'),captureChance: 8, killChance: 42, isBoss: true, role: 'ranged' },
  { name: 'Le Vigie Immortel',          maxHp: 160, damageMin: 28, damageMax: 52, lootMin: 1920,  lootMax: 3900, description: en('bossTier.leVigieImmortel'), captureChance: 8, killChance: 40, isBoss: true, role: 'ranged' },
  { name: "Le Ravitailleur de l'Ombre", maxHp: 170, damageMin: 26, damageMax: 48, lootMin: 1980,  lootMax: 3960, description: en('bossTier.leRavitailleurDeLOmbre'),captureChance: 15, killChance: 32, isBoss: true, role: 'normal' },
  { name: 'Commandant Garant',          maxHp: 195, damageMin: 27, damageMax: 50, lootMin: 2160,  lootMax: 4320, description: en('bossTier.commandantGarant'),            captureChance: 20, killChance: 30, isBoss: true, role: 'tank'   },
  { name: 'La Marchande de Mort',       maxHp: 155, damageMin: 30, damageMax: 55, lootMin: 2100,  lootMax: 4200, description: en('bossTier.laMarchandeDeMort'), captureChance: 12, killChance: 38, isBoss: true, role: 'ranged' },
  { name: 'Le Directeur Fantôme',       maxHp: 140, damageMin: 27, damageMax: 50, lootMin: 1800,  lootMax: 3600, description: en('bossTier.leDirecteurFantome'), captureChance: 15, killChance: 35, isBoss: true, role: 'normal' },
  { name: 'Le Passeur Sanguinaire',     maxHp: 165, damageMin: 27, damageMax: 50, lootMin: 1980,  lootMax: 3900, description: en('bossTier.lePasseurSanguinaire'), captureChance: 10, killChance: 36, isBoss: true, role: 'normal' },
  { name: 'Lord Daekar',                maxHp: 180, damageMin: 28, damageMax: 52, lootMin: 2400,  lootMax: 4800, description: en('bossTier.lordDaekar'),         captureChance: 15, killChance: 34, isBoss: true, role: 'normal' },
  { name: 'Le Maître des Ombres',       maxHp: 160, damageMin: 32, damageMax: 58, lootMin: 2700,  lootMax: 5400, description: en('bossTier.leMaitreDesOmbres'),  captureChance: 10, killChance: 40, isBoss: true, role: 'ranged' },
  { name: 'Le Survivant des Cendres',   maxHp: 175, damageMin: 27, damageMax: 50, lootMin: 2100,  lootMax: 4200, description: en('bossTier.leSurvivantDesCendres'),    captureChance: 8,  killChance: 40, isBoss: true, role: 'tank'   },
  { name: 'Le Gardien Originel',        maxHp: 200, damageMin: 30, damageMax: 55, lootMin: 2700,  lootMax: 5400, description: en('bossTier.leGardienOriginel'),captureChance: 10, killChance: 38, isBoss: true, role: 'normal' },
  { name: 'Le Capitaine Amalgame',      maxHp: 210, damageMin: 28, damageMax: 50, lootMin: 2400,  lootMax: 4800, description: en('bossTier.leCapitaineAmalgame'), captureChance: 5, killChance: 35, isBoss: true, role: 'tank' },
  { name: 'Le Médiateur de Fer',        maxHp: 170, damageMin: 26, damageMax: 48, lootMin: 1920,  lootMax: 3900, description: en('bossTier.leMediateurDeFer'), captureChance: 18, killChance: 30, isBoss: true, role: 'normal' },
  { name: 'Le Gardien du Signal',       maxHp: 155, damageMin: 24, damageMax: 45, lootMin: 1800,  lootMax: 3600, description: en('bossTier.leGardienDuSignal'),            captureChance: 20, killChance: 28, isBoss: true, role: 'normal' },
  { name: 'Le Seigneur des Routes',     maxHp: 180, damageMin: 27, damageMax: 50, lootMin: 2100,  lootMax: 4200, description: en('bossTier.leSeigneurDesRoutes'), captureChance: 15, killChance: 32, isBoss: true, role: 'normal' },
  { name: 'Le Chercheur Fracturé',      maxHp: 150, damageMin: 30, damageMax: 55, lootMin: 2280,  lootMax: 4500, description: en('bossTier.leChercheurFracture'),      captureChance: 12, killChance: 38, isBoss: true, role: 'support' },
  { name: "L'Astronome des Abysses",    maxHp: 165, damageMin: 33, damageMax: 60, lootMin: 2400,  lootMax: 4800, description: en('bossTier.lAstronomeDesAbysses'), captureChance: 8, killChance: 42, isBoss: true, role: 'ranged' },
  { name: 'La Créature de Mira',        maxHp: 230, damageMin: 32, damageMax: 58, lootMin: 2700,  lootMax: 5400, description: en('bossTier.laCreatureDeMira'), captureChance: 3, killChance: 50, isBoss: true, role: 'tank' },
  { name: 'Le Contremaître Infernal',   maxHp: 195, damageMin: 28, damageMax: 52, lootMin: 2280,  lootMax: 4500, description: en('bossTier.leContremaitreInfernal'), captureChance: 10, killChance: 38, isBoss: true, role: 'tank' },
  { name: 'Le Fantôme des Brumes',     maxHp: 170, damageMin: 30, damageMax: 55, lootMin: 2280,  lootMax: 4500, description: en('bossTier.leFantomeDesBrumes'), captureChance: 5, killChance: 40, isBoss: true, role: 'ranged' },
  { name: 'Le Contremaître de Forge',  maxHp: 185, damageMin: 27, damageMax: 50, lootMin: 2100,  lootMax: 4200, description: en('bossTier.leContremaitreDeForge'), captureChance: 10, killChance: 35, isBoss: true, role: 'tank' },
  { name: 'Sœur Valkara',             maxHp: 155, damageMin: 24, damageMax: 46, lootMin: 1920,  lootMax: 3900, description: en('bossTier.soeurValkara'), captureChance: 20, killChance: 28, isBoss: true, role: 'support' },
  { name: 'ARIA-9 Protocole Noir',     maxHp: 145, damageMin: 35, damageMax: 62, lootMin: 2700,  lootMax: 5400, description: en('bossTier.aria9ProtocoleNoir'), captureChance: 5, killChance: 45, isBoss: true, role: 'ranged' },
  { name: 'Docteur Flinch',            maxHp: 160, damageMin: 28, damageMax: 52, lootMin: 2400,  lootMax: 4800, description: en('bossTier.docteurFlinch'), captureChance: 15, killChance: 35, isBoss: true, role: 'support' },
  { name: "L'Armurière Skade",         maxHp: 175, damageMin: 32, damageMax: 58, lootMin: 2520,  lootMax: 5100, description: en('bossTier.lArmuriereSkade'), captureChance: 5, killChance: 42, isBoss: true, role: 'normal' },

  // ── PERSONNAGES PILIERS ───────────────────────────────────────────────────────
  { name: 'Cesarion',       maxHp: 480, damageMin: 48, damageMax: 85, lootMin: 6000,  lootMax: 15000, description: en('bossTier.cesarion'),                                   captureChance: 2,  killChance: 45, isBoss: true, role: 'tank',   pillarAbility: 'imperial_barrage' },
  { name: 'Raphazarus',     maxHp: 580, damageMin: 52, damageMax: 95, lootMin: 7200,  lootMax: 18000, description: en('bossTier.raphazarus'),             captureChance: 1,  killChance: 60, isBoss: true, role: 'normal', pillarAbility: 'phantom_strike'   },
  { name: 'Eliotis',        maxHp: 370, damageMin: 44, damageMax: 78, lootMin: 4800,  lootMax: 12000, description: en('bossTier.eliotis'),                                                                   captureChance: 6,  killChance: 40, isBoss: true, role: 'normal', pillarAbility: 'party_over'       },
  { name: 'Le Roi Maxance', maxHp: 340, damageMin: 40, damageMax: 72, lootMin: 4200,  lootMax: 10800, description: en('bossTier.leRoiMaxance'),                                                                                                   captureChance: 10, killChance: 30, isBoss: true, role: 'support', pillarAbility: 'flora_toxin'      },
  { name: 'Samy Scotty',    maxHp: 320, damageMin: 42, damageMax: 76, lootMin: 5400,  lootMax: 13200, description: en('bossTier.samyScotty'),                                          captureChance: 4,  killChance: 44, isBoss: true, role: 'normal', pillarAbility: 'all_in'           },
]
}

export function getEnemyByTier(tier: 1 | 2 | 3 | 4): Enemy {
  const pools = { 1: getTierLow(), 2: getTierMid(), 3: getTierHigh(), 4: getTierBoss() }
  const pool = pools[tier]
  return pool[Math.floor(Math.random() * pool.length)]
}

export function getEnemyForDepth(depth: number, day: number): Enemy {
  let tier: 1 | 2 | 3 | 4 = depth <= 2 ? 1 : depth <= 4 ? 2 : depth <= 7 ? 3 : 4
  if (day > 15 && tier === 1) tier = 2
  if (day > 30 && tier === 2) tier = 3
  return getEnemyByTier(tier)
}

// ── COMBATTANTS DE L'ARÈNE DE KORSUN ─────────────────────────────────────────
// 10 adversaires en escalade pour le tournoi
function buildArenaFighters(): Enemy[] {
  return [
  { name: 'Recrue des arènes',        maxHp: 50,  damageMin: 7,  damageMax: 15, lootMin: 0,  lootMax: 0, description: en('arenaFighters.recrueDesArenes'),             captureChance: 0, killChance: 5,  isBoss: false, role: 'normal' },
  { name: 'Gladiateur local',         maxHp: 70,  damageMin: 10, damageMax: 20, lootMin: 0,  lootMax: 0, description: en('arenaFighters.gladiateurLocal'),                    captureChance: 0, killChance: 8,  isBoss: false, role: 'normal' },
  { name: 'Boucher de quartier',      maxHp: 90,  damageMin: 13, damageMax: 25, lootMin: 0,  lootMax: 0, description: en('arenaFighters.boucherDeQuartier'),                   captureChance: 0, killChance: 12, isBoss: false, role: 'tank'   },
  { name: 'Duelliste expérimenté',    maxHp: 105, damageMin: 16, damageMax: 30, lootMin: 0,  lootMax: 0, description: en('arenaFighters.duellisteExperimente'),        captureChance: 0, killChance: 15, isBoss: false, role: 'normal' },
  { name: 'Sniper de l\'arène',       maxHp: 85,  damageMin: 20, damageMax: 38, lootMin: 0,  lootMax: 0, description: en('arenaFighters.sniperDeLArene'), captureChance: 0, killChance: 18, isBoss: false, role: 'ranged' },
  { name: 'Berserker dopé',           maxHp: 130, damageMin: 22, damageMax: 42, lootMin: 0,  lootMax: 0, description: en('arenaFighters.berserkerDope'),                captureChance: 0, killChance: 22, isBoss: false, role: 'tank'   },
  { name: 'Executeur masqué',         maxHp: 145, damageMin: 24, damageMax: 46, lootMin: 0,  lootMax: 0, description: en('arenaFighters.executeurMasque'), captureChance: 0, killChance: 25, isBoss: false, role: 'normal' },
  { name: 'Chasseur de champions',    maxHp: 160, damageMin: 26, damageMax: 50, lootMin: 0,  lootMax: 0, description: en('arenaFighters.chasseurDeChampions'), captureChance: 0, killChance: 30, isBoss: false, role: 'ranged' },
  { name: 'Finaliste implacable',     maxHp: 185, damageMin: 30, damageMax: 55, lootMin: 0,  lootMax: 0, description: en('arenaFighters.finalisteImplacable'), captureChance: 0, killChance: 35, isBoss: false, role: 'tank'   },
  { name: 'Le Champion des Arènes',   maxHp: 230, damageMin: 36, damageMax: 62, lootMin: 0,  lootMax: 0, description: en('arenaFighters.leChampionDesArenes'), captureChance: 0, killChance: 40, isBoss: true,  role: 'normal' },
]
}

export function getArenaEnemyForRound(round: number): Enemy {
  const idx = Math.max(0, Math.min(9, round - 1))
  return getArenaFighters()[idx]
}

export function scaleEnemy(enemy: Enemy, level: number): Enemy {
  if (level <= 0) return enemy
  const mult = 1 + level * 0.25
  return {
    ...enemy,
    maxHp:     Math.floor(enemy.maxHp     * mult),
    damageMin: Math.floor(enemy.damageMin * mult),
    damageMax: Math.floor(enemy.damageMax * mult),
    lootMin:   Math.floor(enemy.lootMin   * mult),
    lootMax:   Math.floor(enemy.lootMax   * mult),
  }
}

// ── POOLS D'ENNEMIS PAR TYPE DE STATION ──────────────────────────────────────

type StationPool = { low: Enemy[], mid: Enemy[], high: Enemy[] }

// Cherche des ennemis par nom dans les trois tiers
function _pick(...names: string[]): Enemy[] {
  const all = [...getTierLow(), ...getTierMid(), ...getTierHigh()]
  return names.map(n => all.find(e => e.name === n) ?? getTierLow()[0])
}

function poolFaucon(): StationPool {
  return {
  low:  _pick('Éclaireur Faucon', 'Milicien de pacotille', 'Garde corrompu', 'Rat de cargaison'),
  mid:  _pick('Agent Faucon infiltré', 'Déserteur armé', 'Officier renégat', 'Hacker de rue'),
  high: _pick('Commandant Faucon Noir', 'Élite des Faucons Noirs', 'Assassin du Conclave', 'Fantôme de la Garde Noire'),
  }
}

function poolGardien(): StationPool {
  return {
  low:  _pick('Recrue Gardienne', 'Garde corrompu', 'Milicien de pacotille', 'Sous-officier véreux'),
  mid:  _pick('Soldat Gardien Écarlate', 'Chasseur de primes', 'Officier renégat', 'Déserteur armé'),
  high: _pick('Capitaine Gardien Écarlate', 'Garde du corps impitoyable', 'Commandant renégat', 'Exécuteur du Tribunal'),
  }
}

function poolEmporium(): StationPool {
  return {
  low:  _pick('Vigile Emporium', 'Garde corrompu', 'Milicien de pacotille', 'Sous-officier véreux'),
  mid:  _pick("Garde Emporium armé", "Trafiquant d'organes", 'Caïd de station', 'Agent double'),
  high: _pick("Exécuteur de l'Emporium", "Garde de l'Emporium", 'Assassin du Conclave', 'Exécuteur du Tribunal'),
  }
}

function poolCriminel(): StationPool {
  return {
  low:  _pick('Pickpocket désespéré', 'Ivrogne agressif', 'Drogué au Synth', 'Toxicomane sous injection', 'Rat de cargaison'),
  mid:  _pick('Pirate solitaire', 'Contrebandier défensif', 'Gang de rue spatial', 'Hacker de rue', 'Caïd de station'),
  high: _pick('Baron des bas-fonds', 'Commandant renégat', 'Fantôme de la Garde Noire', 'Traqueur de factions'),
  }
}

function poolMilitaire(): StationPool {
  return {
  low:  _pick('Milicien de pacotille', 'Garde corrompu', 'Sous-officier véreux', 'Chasseur de primes novice'),
  mid:  _pick('Officier renégat', 'Déserteur armé', 'Chasseur de primes', 'Sergent des bas-fonds'),
  high: _pick('Commandant renégat', 'Garde du corps impitoyable', 'Exécuteur du Tribunal', 'Berserker augmenté'),
  }
}

function poolRuins(): StationPool {
  return {
  low:  _pick('Survivant des ruines', 'Scavenger opportuniste', 'Vagabond armé', 'Mendiant armé'),
  mid:  _pick('Scavenger vétéran', 'Mercenaire des ruines', 'Pirate reconverti', 'Dresseur de bêtes mutantes'),
  high: _pick('Vétéran des ruines', 'Ancien du Vide', 'Traqueur de factions', 'Sniper des abysses'),
  }
}

function poolLuxe(): StationPool {
  return {
  low:  _pick('Vigile Emporium', 'Chasseur de primes novice', 'Fuyarde paniquée', 'Garde corrompu'),
  mid:  _pick("Garde Emporium armé", 'Assassin de bas étage', 'Agent double', "Trafiquant d'organes"),
  high: _pick("Exécuteur de l'Emporium", 'Assassin du Conclave', 'Garde du corps impitoyable', 'Fantôme de la Garde Noire'),
  }
}

function poolIndustriel(): StationPool {
  return {
  low:  _pick('Mineur agressif', 'Ouvrier en colère', 'Réparateur jaloux', 'Scavenger opportuniste'),
  mid:  _pick('Contrebandier défensif', 'Scavenger vétéran', 'Sergent des bas-fonds', 'Dresseur de bêtes mutantes'),
  high: _pick('Ingénieur de guerre', 'Berserker augmenté', 'Vétéran des ruines', 'Pilote de combat au sol'),
  }
}

function poolScientifique(): StationPool {
  return {
  low:  _pick('Réparateur jaloux', 'Pilote raté', 'Rat de cargaison', 'Vigile Emporium'),
  mid:  _pick('Hacker de rue', 'Agent double', 'Contrebandier défensif', 'Officier renégat'),
  high: _pick('Ingénieur de guerre', 'Traqueur de factions', 'Fantôme de la Garde Noire', 'Sniper des abysses'),
  }
}

function buildStationPoolMap(): Record<string, StationPool> {
  return {
  // Faucons Noirs
  'Arc Ouest Apocalypse':  poolFaucon(),
  'Le Nid des Faucons':    poolFaucon(),
  'Le Perchoir':           poolFaucon(),
  'Station Ombre':         poolFaucon(),
  'Relais Noir':           poolFaucon(),
  'La Tanière':            poolFaucon(),
  'Fort de Cendres':       poolFaucon(),
  "L'Œil du Faucon":      poolFaucon(),
  // Gardiens Écarlates
  'La Citadelle Écarlate': poolGardien(),
  'Bastion Mineur':        poolGardien(),
  'Poste Vigie':           poolGardien(),
  "L'Arsenal Écarlate":   poolGardien(),
  'La Forteresse Exilée':  poolGardien(),
  // Emporium
  'Emporium Requiem':      poolEmporium(),
  'Comptoir Sud':          poolEmporium(),
  'Annexe Commerciale':    poolEmporium(),
  'Relais de Transit':     poolEmporium(),
  // Criminel / bas-fonds
  'Les Bas-Fonds de Vega': poolCriminel(),
  'Repaire Vega-Sud':      poolCriminel(),
  'Port de Nuit':          poolCriminel(),
  'La Forge Noire':        poolCriminel(),
  "L'Entrepôt Zéro":      poolCriminel(),
  // Militaire neutre
  'Fort Kharos':           poolMilitaire(),
  'Fort Ossian':           poolMilitaire(),
  'Star Quest':            poolMilitaire(),
  // Ruines / abandonnées
  'Le Purgatoire':         poolRuins(),
  'Les Abysses de Velkor': poolRuins(),
  'Les Cendres':           poolRuins(),
  'Station Quarantaine':   poolRuins(),
  'Le Berceau':            poolRuins(),
  "L'Épave Vivante":      poolRuins(),
  'Station Fantôme':       poolRuins(),
  // Luxe / haute société
  "La Couronne d'Eos":    poolLuxe(),
  'Résidence Orbitale':    poolLuxe(),
  "Club Privé Éos":       poolLuxe(),
  'Scotty Golden North':   poolLuxe(),
  // Industriel / minier
  'Station Rocaille':      poolIndustriel(),
  'Les Cavernes de Mira':  poolIndustriel(),
  'La Raffinerie':         poolIndustriel(),
  // Scientifique
  'Nexus Aldara':          poolScientifique(),
  'Station Zéphyr':        poolScientifique(),
  "L'Observatoire":       poolScientifique(),
  'Station Limite':        poolScientifique(),
  // Personnages piliers — nouvelles stations
  "L'Arc Perdu":          poolRuins(),
  'La Tribosphère':        poolMilitaire(),
  'Paradoxa Eterna':       poolGardien(),
  // Nouvelles stations
  'Port des Brumes':          poolCriminel(),
  'Forge Alpha':              poolIndustriel(),
  'Le Sanctuaire des Dérives': poolLuxe(),
  'Sanctum Machina':          poolScientifique(),
  'La Bulle':                 poolScientifique(),
  'La Forge des Damnés':      poolCriminel(),
  }
}

export function getEnemyForStation(stationName: string, depth: number, day: number): Enemy {
  const pool = stationPoolMap()[stationName]
  if (!pool) return getEnemyForDepth(depth, day)
  const tier: 'low' | 'mid' | 'high' = depth <= 2 ? 'low' : depth <= 5 ? 'mid' : 'high'
  const arr = pool[tier]
  return arr[Math.floor(Math.random() * arr.length)]
}

export const getTierLow = memoByLang(buildTierLow)

export const getTierMid = memoByLang(buildTierMid)

export const getTierHigh = memoByLang(buildTierHigh)

export const getTierBoss = memoByLang(buildTierBoss)

export const getArenaFighters = memoByLang(buildArenaFighters)

const stationPoolMap = memoByLang(buildStationPoolMap)
