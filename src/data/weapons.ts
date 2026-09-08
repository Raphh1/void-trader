import type { WeaponData } from '../types'
import i18n from '../i18n/config'

const we = (key: string) => i18n.t(key, { ns: 'weapons' })

const w = (
  name: string, tier: number,
  dMin: number, dMax: number, crit: number,
  effect: WeaponData['effect'], effectChance: number, effectDesc: string,
  selfChance = 0, selfMax = 0,
  affinities: WeaponData['affinities'] = {}
): WeaponData => ({ name, tier, damageMin: dMin, damageMax: dMax, critChance: crit, effect, effectChance, effectDesc, selfDmgChance: selfChance, selfDmgMax: selfMax, affinities })

export function getWeapons(): WeaponData[] {
  return [

  // ── TIER 1 ── Armes de rue, peu fiables mais accessibles ────────────────────
  w('Couteau de rue',             1,  6, 14,  8, 'poison',      15, we('couteauDeRue'),  0,  0, { Vagabond: 1.15, Contrebandier: 1.1 }),
  w('Matraque de garde',          1,  8, 16,  6, 'stun',       20, we('matraqueDeGarde'),                  0,  0, { 'Seigneur de guerre': 1.15 }),
  w('Pistolet rouillé',           1,  7, 15, 10, 'burn',        18, we('pistoletRouille'), 8, 10),
  w('Taser de poche',             1,  5, 12, 12, 'stun',       30, we('taserDePoche'),                  0,  0, { Hackeur: 1.2 }),
  w('Couteau à cran d\'arrêt',    1,  6, 13,  9, 'poison',     18, we('couteauCranArret'),             0,  0, { Vagabond: 1.2, Contrebandier: 1.15 }),
  w('Pique artisanale',           1,  7, 14,  7, 'armorPierce',  0, we('piqueArtisanale'), 0, 0),
  w('Bâton de pacification',      1,  9, 17,  5, 'stun',       25, we('batonPacification'),                  0,  0, { 'Seigneur de guerre': 1.1 }),
  w('Arbalète de fortune',        1,  8, 18, 11, 'blind',      20, we('arbaleteFortune'),          0,  0, { Vétéran: 1.1 }),
  w('Shiv empoisonné',            1,  5, 11,  8, 'poison',     35, we('shivEmpoisonne'),             0,  0, { Vagabond: 1.25, Contrebandier: 1.1 }),
  w('Poing américain électrique', 1,  8, 15,  7, 'stun',       22, we('poingAmericainElectrique'),                  5,  8, { 'Seigneur de guerre': 1.1, Vétéran: 1.05 }),

  // ── TIER 2 ── Armes de milieu de gamme, premiers effets sérieux ─────────────
  w('Pistolet semi-auto',         2, 12, 24, 12, 'double_strike',0, we('pistoletSemiAuto'), 0, 0),
  w('Fusil à impulsion',          2, 14, 28, 14, 'blind',      25, we('fusilImpulsion'),          0,  0, { Hackeur: 1.2 }),
  w('Lame vibrante',              2, 15, 30, 16, 'armorPierce',  0, we('lameVibrante'), 0, 0, { 'Seigneur de guerre': 1.2, Vétéran: 1.15 }),
  w('Gantelet plasma',            2, 13, 26, 13, 'burn',       20, we('ganteletPlasma'),                  0,  0, { 'Seigneur de guerre': 1.15 }),
  w('Électrogrenade (une)',        2, 16, 32, 10, 'shock',      35, we('electrogrenade'),             5, 12, { Hackeur: 1.2 }),
  w('Revolver Scav modifié',      2, 13, 27, 18, 'distraction', 20, we('revolverScavModifie'), 0, 0, { Contrebandier: 1.15, Vagabond: 1.1 }),
  w('Nerf-pistolet augmenté',     2, 11, 22, 12, 'paralyze',   15, we('nerfPistoletAugmente'),                 0,  0, { Médecin: 1.2 }),
  w('Fouet désorganisant',        2, 10, 20, 10, 'disarm',     35, we('fouetDesorganisant'),   0,  0, { Contrebandier: 1.15 }),
  w('Vampirelle',                 2, 11, 22, 11, 'lifesteal',   0, we('vampirelle'),         0,  0, { Médecin: 1.2, Vagabond: 1.1 }),
  w('Bâton de choc',              2, 10, 20,  9, 'shock',      28, we('batonDeChoc'),             0,  0, { 'Seigneur de guerre': 1.1 }),

  // ── TIER 3 ── Armes puissantes, premiers risques réels ──────────────────────
  w('Fusil à pompe galactique',   3, 22, 45, 18, 'stun',        35, we('fusilPompeGalactique'), 15, 18, { 'Seigneur de guerre': 1.2, Vétéran: 1.2 }),
  w('Lance-flammes compact',      3, 20, 40, 12, 'burn',       60, we('lanceFlammesCompact'),               20, 20, { 'Seigneur de guerre': 1.15 }),
  w('Pistolet à plasma Mk2',      3, 18, 38, 20, 'blind',      30, we('pistoletPlasmaMk2'),                   0,  0, { Hackeur: 1.2 }),
  w('Épée monomoléculaire',       3, 24, 46, 22, 'armorPierce', 0, we('epeeMonomoleculaire'),              0,  0, { 'Seigneur de guerre': 1.25, Vétéran: 1.2 }),
  w('Fusil de sniper portatif',   3, 26, 52, 25, 'silence',     40, we('fusilSniperPortatif'), 0, 0, { Vétéran: 1.15 }),
  w('Grenade sonique',            3, 18, 36, 14, 'distraction',50, we('grenadeSonique'),         10, 15),
  w('Lame empoisonnée',           3, 16, 32, 16, 'poison',     45, we('lameEmpoisonnee'),             0,  0, { Vagabond: 1.25, Contrebandier: 1.2 }),
  w('Désintégrateur compact',     3, 20, 42, 18, 'armorPierce', 0, we('desintegrateurCompact'),              0,  0),
  w('Double-lame des bas-fonds',  3, 18, 35, 15, 'double_strike',0,we('doubleLameBasFonds'),          12, 16, { Vagabond: 1.2, 'Seigneur de guerre': 1.1 }),
  w('Sceptre maudit de Neva',     3, 14, 28, 13, 'curse',      55, we('sceptreMauditNeva'),       0,  0, { Médecin: 1.2, Hackeur: 1.1 }),
  w('Grenade à confusion',        3, 20, 38, 12, 'confusion',  45, we('grenadeConfusion'),      8, 14),

  // ── TIER 4 ── Armes d'élite, risques sérieux, effets puissants ──────────────
  w('Gatling à plasma Bonne Nuit',4, 30, 60, 20, 'burn',        45, we('gatlingPlasmaBonneNuit'), 25, 25, { 'Seigneur de guerre': 1.2 }),
  w('Foudroyeur de Noctis',       4, 28, 56, 24, 'paralyze',   40, we('foudroyeurNoctis'),                           0,  0, { Vétéran: 1.2 }),
  w('Lame du Conclave',           4, 32, 62, 28, 'armorPierce', 0, we('lameConclave'),               0,  0, { 'Seigneur de guerre': 1.2, Vétéran: 1.2 }),
  w('Canon ionique de campagne',  4, 26, 52, 20, 'blind',      50, we('canonIoniqueCampagne'),                             5, 20, { Hackeur: 1.2 }),
  w('Fusil de précision Céleste', 4, 34, 68, 32, 'silence',     50, we('fusilPrecisionCeleste'), 0, 0, { Vétéran: 1.2 }),
  w('Injecto-poison Mortalis',    4, 20, 42, 18, 'poison',     75, we('injectoPoisonMortalis'),             0,  0, { Médecin: 1.2, Vagabond: 1.2 }),
  w('L\'Insistance',              4, 24, 48, 22, 'random',     60, we('insistance'),   8, 15),
  w('Lame sacrificielle',         4, 28, 55, 20, 'sacrifice',   0, we('lameSacrificielle'),  0,  0, { 'Seigneur de guerre': 1.2, Vétéran: 1.1 }),
  w('Fusil Berserk',              4, 25, 50, 18, 'berserker',   0, we('fusilBerserk'), 0, 0, { 'Seigneur de guerre': 1.15, Vétéran: 1.1 }),
  w('L\'Éveilleur',               4, 22, 44, 19, 'momentum_surge',0,we('eveilleur'),          0,  0, { Vétéran: 1.2, 'Seigneur de guerre': 1.1 }),

  // ── TIER 5 ── Armes légendaires — certaines peuvent tuer leur porteur ────────
  // Chaque classe a désormais au moins une arme légendaire "signature" : avant,
  // seuls le Vétéran et le Seigneur de guerre avaient des affinités au tier 5,
  // donc les 13 autres classes perdaient toute identité en fin de partie.
  // Les affinités guerrières sont légèrement réduites car ces deux classes
  // bénéficient aussi de CLASS_WEAPON_MULT (voir engine/combat.ts).
  w('Canon à trou noir miniaturisé', 5, 40, 80, 25, 'flee',     30, we('canonTrouNoirMiniaturise'),                30, 35, { Contrebandier: 1.2, Vagabond: 1.15 }),
  w('Canon à singularité',           5, 45, 85, 28, 'armorPierce',0,we('canonSingularite'),            25, 30, { Mécanicien: 1.2, Ferrailleur: 1.15 }),
  w('Dernière Parole',               5, 50, 90, 35, 'stun',     50, we('derniereParole'),                          20, 25, { Hackeur: 1.2, Marchand: 1.15 }),
  // redesigns
  w('Le Sceptre de Raphazarus',      5, 38, 78, 30, 'berserker', 0, we('sceptreRaphazarus'), 0, 0, { Vétéran: 1.2, 'Seigneur de guerre': 1.1 }),
  w('Bombe à paradoxe',              5, 42, 82, 28, 'confusion',55, we('bombeParadoxe'), 20, 30, { Maudit: 1.25, Explorateur: 1.15 }),
  w('Lame de la Fin des Temps',      5, 50, 95, 35, 'nuclear',   0, we('lameFinDesTemps'), 0, 0, { 'Seigneur de guerre': 1.15, Endetté: 1.2 }),
  w('Archon Mk-VII',                 5, 40, 78, 32, 'paralyze', 60, we('archonMkVII'),                          5, 15, { Médecin: 1.2, Héritier: 1.15 }),
  // nouvelle arme dangereuse — la plus risquée, donc la plus généreuse pour les
  // classes qui vivent du risque
  w('Réacteur à fission',            5, 35, 70, 25, 'unstable',  0, we('reacteurFission'), 30, 40, { Rayane: 1.3, Accro: 1.25, Ferrailleur: 1.2 }),
  ]
}

export function rollWeaponForTier(tier: number): WeaponData {
  const pool = getWeapons().filter(w => w.tier === Math.min(5, Math.max(1, tier)))
  return pool[Math.floor(Math.random() * pool.length)]
}
