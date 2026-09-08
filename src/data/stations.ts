import type { StationData } from '../types'
import i18n from '../i18n/config'

const st = (key: string) => i18n.t(key, { ns: 'stations' })

// Même mémoïsation par langue que dans data/enemies.ts : getStations() est
// appelé en boucle (findPath, carte, marché) et reconstruisait les 60 stations
// à chaque fois. Le cache est invalidé au changement de langue, donc les
// descriptions restent traduites. Aucun appelant ne mute le tableau retourné.
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

function buildStations(): StationData[] {
  return [
  {
    name: 'La Carcasse',
    description: st('laCarcasse'),
    danger: 0, type: 'dangerous',
    goods: ['Médicaments', 'Métaux bruts', 'Nourriture synthétique', 'Carburant de récup'],
    fuelCostFrom: { 'Port Méridien': 2, 'Les Bas-Fonds de Vega': 3, 'Fort Kharos': 4, 'Station Rocaille': 3 },
  },
  {
    name: 'Port Méridien',
    description: st('portMeridien'),
    danger: 0, type: 'peaceful',
    goods: ['Médicaments', 'Composants électroniques', 'Vêtements', 'Nourriture synthétique', 'Outils'],
    fuelCostFrom: { 'La Carcasse': 2, 'Nexus Aldara': 2, 'Fort Kharos': 3, 'Les Bas-Fonds de Vega': 4, 'Colonie Perséphone': 3, 'Paradoxa Eterna': 4, 'Le Sanctuaire des Dérives': 3, 'Le Grand Bazar': 3 },
  },
  {
    name: 'Les Bas-Fonds de Vega',
    description: st('lesBasFondsDeVega'),
    danger: 2, type: 'dangerous',
    goods: ['Armes illégales', 'Drogues de synthèse', 'Données volées', 'Pièces de contrebande'],
    fuelCostFrom: { 'La Carcasse': 3, 'Port Méridien': 4, 'Arc Ouest Apocalypse': 2, 'Port des Brumes': 2 },
    exclusiveGoods: ['Armes illégales', 'Drogues de synthèse'],
  },
  {
    name: 'Fort Kharos',
    description: st('fortKharos'),
    danger: 1, type: 'military',
    goods: ['Équipements blindés', 'Rations militaires', 'Munitions', 'Composants tactiques'],
    fuelCostFrom: { 'La Carcasse': 4, 'Port Méridien': 3, 'Nexus Aldara': 3, 'Fort Ossian': 3 },
  },
  {
    name: 'Nexus Aldara',
    description: st('nexusAldara'),
    danger: 1, type: 'scientific',
    goods: ['Composants électroniques', 'Implants', 'Logiciels', 'Données'],
    fuelCostFrom: { 'Port Méridien': 2, 'Fort Kharos': 3, 'Le Purgatoire': 3, 'Sanctum Machina': 2, "L'Œil du Faucon": 4, 'Le Grand Bazar': 3 },
    exclusiveGoods: ['Implants', 'Logiciels'],
  },
  {
    name: 'Arc Ouest Apocalypse',
    description: st('arcOuestApocalypse'),
    danger: 3, type: 'dangerous',
    goods: ['Armes lourdes', 'Matériel de pillage', 'Butin de guerre'],
    fuelCostFrom: { 'Les Bas-Fonds de Vega': 2, 'Le Nid des Faucons': 3, "L'Œil du Faucon": 2 },
  },
  {
    name: 'Le Purgatoire',
    description: st('lePurgatoire'),
    danger: 2, type: 'ruins',
    goods: ['Nourriture synthétique', 'Médicaments bas de gamme', 'Objets de contrebande'],
    fuelCostFrom: { 'Nexus Aldara': 3, 'Fort Ossian': 2 },
  },
  {
    name: 'Le Nid des Faucons',
    description: st('leNidDesFaucons'),
    danger: 3, type: 'military',
    goods: ['Équipement tactique', 'Armures Faucon', 'Intel faction'],
    fuelCostFrom: { 'Arc Ouest Apocalypse': 3, 'La Citadelle Écarlate': 2, 'Fort de Cendres': 2 },
  },
  {
    name: 'Fort Ossian',
    description: st('fortOssian'),
    danger: 2, type: 'military',
    goods: ['Rations', 'Armures', 'Munitions lourdes'],
    fuelCostFrom: { 'Le Purgatoire': 2, 'Nexus Aldara': 4, 'Colonie Perséphone': 3, 'Poste Vigie': 1, "L'Oasis de Fer": 3 },
  },
  {
    name: 'Colonie Perséphone',
    description: st('colonnePersephone'),
    danger: 0, type: 'peaceful',
    goods: ['Nourriture fraîche', 'Eau purifiée', 'Minerais', 'Équipement agricole'],
    fuelCostFrom: { 'Fort Ossian': 3, 'Station Rocaille': 2, 'Port Méridien': 3, 'Paradoxa Eterna': 3 },
    specialService: 'rest_bonus',
    exclusiveGoods: ['Nourriture fraîche', 'Équipement agricole'],
  },
  {
    name: 'Station Rocaille',
    description: st('stationRocaille'),
    danger: 1, type: 'industrial',
    goods: ['Métaux rares', 'Cristaux énergétiques', 'Outils lourds'],
    fuelCostFrom: { 'Colonie Perséphone': 2, 'La Forge Noire': 2, 'La Carcasse': 3 },
  },
  {
    name: 'La Forge Noire',
    description: st('laForgeNoire'),
    danger: 2, type: 'industrial',
    goods: ['Armes artisanales', "Composants d'armure", 'Matériaux interdits'],
    fuelCostFrom: { 'Station Rocaille': 2, "L'Entrepôt Zéro": 3, 'La Forge des Damnés': 2, 'Forge Alpha': 2 },
    specialService: 'weapon_forge',
    exclusiveGoods: ['Armes artisanales', "Composants d'armure"],
  },
  {
    name: "L'Entrepôt Zéro",
    description: st('entrepotZero'),
    danger: 2, type: 'ruins',
    goods: ['Marchandises volées', 'Composants divers', 'Informations monnayables'],
    fuelCostFrom: { 'La Forge Noire': 3, 'Emporium Requiem': 3 },
  },
  {
    name: 'Emporium Requiem',
    description: st('emporiumRequiem'),
    danger: 2, type: 'luxury',
    goods: ['Armes Tier 4', 'Armures premium', 'Équipement militaire d\'élite', 'Composants tactiques'],
    fuelCostFrom: { "L'Entrepôt Zéro": 3, 'Star Quest': 2, 'Les Abysses de Velkor': 4, 'Annexe Commerciale': 2 },
    exclusiveGoods: ['Armes Tier 4', 'Équipement militaire d\'élite'],
  },
  {
    name: 'Star Quest',
    description: st('starQuest'),
    danger: 1, type: 'luxury',
    goods: ['Luxe', 'Médicaments premium', 'Informations VIP', 'Or'],
    fuelCostFrom: { 'Emporium Requiem': 2, "La Couronne d'Eos": 3, 'La Tribosphère': 3, "L'Arène de Korsun": 2 },
  },
  {
    name: 'La Citadelle Écarlate',
    description: st('laCitadelleEcarlate'),
    danger: 3, type: 'military',
    goods: ["Armures d'élite", 'Armes lourdes', 'Munitions spéciales'],
    fuelCostFrom: { 'Le Nid des Faucons': 2, 'Scotty Golden North': 4, 'La Forteresse Exilée': 4, 'Fort de Cendres': 4 },
  },
  {
    name: 'Les Abysses de Velkor',
    description: st('lesAbyssesDeVelkor'),
    danger: 3, type: 'ruins',
    goods: ['Artefacts', 'Composants expérimentaux', 'Données classifiées'],
    fuelCostFrom: { 'Emporium Requiem': 4, 'Scotty Golden North': 3, "L'Arc Perdu": 5 },
  },
  {
    name: 'Scotty Golden North',
    description: st('scottyGoldenNorth'),
    danger: 2, type: 'peaceful',
    goods: ['Jetons de casino', 'Armes exotiques', 'Informations VIP', 'Luxe'],
    fuelCostFrom: { 'La Citadelle Écarlate': 4, 'Les Abysses de Velkor': 3, "La Couronne d'Eos": 4, 'La Tribosphère': 3, 'Station Limite': 3 },
    specialService: 'gambling',
    exclusiveGoods: ['Jetons de casino', 'Armes exotiques'],
  },
  {
    name: "La Couronne d'Eos",
    description: st('laCouronneDEos'),
    danger: 2, type: 'luxury',
    goods: ['Technologies avancées', 'Armes Tier 4', 'Armures Tier 4', 'Renseignements', 'Or'],
    fuelCostFrom: { 'Star Quest': 3, 'Scotty Golden North': 4, 'La Tribosphère': 4, "Club Privé Éos": 2, 'Résidence Orbitale': 1 },
    exclusiveGoods: ['Technologies avancées', 'Armures Tier 4', 'Renseignements'],
  },

  // ── SOUS-STATIONS FAUCONS NOIRS ─────────────────────────────────────────────
  { name: 'Le Perchoir',
    description: st('lePerchoir'),
    danger: 2, type: 'military',
    goods: ['Intel faction', 'Munitions', 'Rations militaires'],
    fuelCostFrom: { 'Arc Ouest Apocalypse': 1, 'Le Nid des Faucons': 3, 'Station Ombre': 2, 'Relais Noir': 2 } },

  { name: 'Station Ombre',
    description: st('stationOmbre'),
    danger: 3, type: 'dangerous',
    goods: ['Armes lourdes', 'Données volées', 'Équipement tactique', 'Matériel de guerre', 'Implants militaires'],
    fuelCostFrom: { 'Le Nid des Faucons': 1, 'Le Perchoir': 2, 'La Tanière': 3, 'Fort de Cendres': 2 } },

  { name: 'Relais Noir',
    description: st('relaisNoir'),
    danger: 1, type: 'industrial',
    goods: ['Carburant de récup', 'Munitions', 'Pièces techniques', 'Composants électroniques', 'Outils lourds'],
    fuelCostFrom: { 'Arc Ouest Apocalypse': 2, 'Les Bas-Fonds de Vega': 3, 'Le Perchoir': 2, "L'Œil du Faucon": 3 } },

  { name: 'La Tanière',
    description: st('laTaniere'),
    danger: 3, type: 'ruins',
    goods: ['Butin de guerre', 'Armes artisanales', 'Matériel de pillage'],
    fuelCostFrom: { 'Arc Ouest Apocalypse': 2, 'Le Perchoir': 1, 'Station Ombre': 3 } },

  { name: 'Fort de Cendres',
    description: st('fortDeCendres'),
    danger: 2, type: 'military',
    goods: ['Armures Faucon', 'Équipement tactique', 'Rations militaires'],
    fuelCostFrom: { 'Le Nid des Faucons': 2, 'Station Ombre': 2, 'La Citadelle Écarlate': 4, 'Le Perchoir': 3 } },

  { name: "L'Œil du Faucon",
    description: st('loeilDuFaucon'),
    danger: 2, type: 'scientific',
    goods: ['Données classifiées', 'Logiciels', 'Renseignements'],
    fuelCostFrom: { 'Arc Ouest Apocalypse': 2, 'Nexus Aldara': 4, 'Relais Noir': 3 } },

  { name: 'Repaire Vega-Sud',
    description: st('repaireVegaSud'),
    danger: 3, type: 'dangerous',
    goods: ['Armes illégales', 'Drogues de synthèse', 'Matériaux interdits'],
    fuelCostFrom: { 'Les Bas-Fonds de Vega': 2, 'Arc Ouest Apocalypse': 3, 'Port de Nuit': 2 } },

  // ── GARDIENS ÉCARLATES ───────────────────────────────────────────────────────
  { name: 'Bastion Mineur',
    description: st('bastionMineur'),
    danger: 1, type: 'military',
    goods: ['Équipements blindés', 'Munitions', 'Rations'],
    fuelCostFrom: { 'La Citadelle Écarlate': 1, 'Le Nid des Faucons': 3, "L'Arsenal Écarlate": 1 } },

  { name: 'Poste Vigie',
    description: st('posteVigie'),
    danger: 1, type: 'military',
    goods: ['Munitions', 'Renseignements', 'Rations militaires', 'Équipements blindés', 'Composants tactiques'],
    fuelCostFrom: { 'Fort Ossian': 1, 'Fort Kharos': 4, 'Bastion Mineur': 3 } },

  { name: "L'Arsenal Écarlate",
    description: st('arsenalEcarlate'),
    danger: 2, type: 'military',
    goods: ["Armures d'élite", 'Armes lourdes', 'Munitions spéciales'],
    fuelCostFrom: { 'La Citadelle Écarlate': 2, 'Bastion Mineur': 1 } },

  { name: 'La Forteresse Exilée',
    description: st('forteresseExilee'),
    danger: 3, type: 'military',
    goods: ['Armes lourdes', 'Munitions spéciales', 'Équipement tactique'],
    fuelCostFrom: { 'La Citadelle Écarlate': 4, "L'Arsenal Écarlate": 3, 'La Forge Noire': 4, 'Station Limite': 4 } },

  // ── EMPORIUM ─────────────────────────────────────────────────────────────────
  { name: 'Comptoir Sud',
    description: st('comptoirSud'),
    danger: 1, type: 'luxury',
    goods: ['Médicaments premium', 'Luxe', 'Composants électroniques'],
    fuelCostFrom: { 'Emporium Requiem': 1, 'Star Quest': 3, "L'Entrepôt Zéro": 2, 'Relais de Transit': 2 } },

  { name: 'Annexe Commerciale',
    description: st('annexeCommerciale'),
    danger: 0, type: 'peaceful',
    goods: ['Vêtements', 'Nourriture synthétique', 'Composants électroniques'],
    fuelCostFrom: { 'Emporium Requiem': 2, 'Comptoir Sud': 1, "La Couronne d'Eos": 3 } },

  { name: 'Relais de Transit',
    description: st('relaisDeTransit'),
    danger: 1, type: 'industrial',
    goods: ['Pièces techniques', 'Composants divers', 'Carburant de récup'],
    fuelCostFrom: { 'Emporium Requiem': 2, "L'Entrepôt Zéro": 2, 'Comptoir Sud': 2, 'Le Grand Bazar': 3 } },

  // ── HAUTE SOCIÉTÉ ─────────────────────────────────────────────────────────────
  { name: 'Résidence Orbitale',
    description: st('residenceOrbitale'),
    danger: 0, type: 'luxury',
    goods: ['Luxe', 'Technologies avancées', 'Médicaments premium', 'Or'],
    fuelCostFrom: { "La Couronne d'Eos": 1, 'Star Quest': 2, 'Annexe Commerciale': 3 } },

  { name: "Club Privé Éos",
    description: st('clubPriveEos'),
    danger: 1, type: 'luxury',
    goods: ['Informations VIP', 'Renseignements', 'Luxe', 'Or'],
    fuelCostFrom: { "La Couronne d'Eos": 2, 'Résidence Orbitale': 1, 'Star Quest': 3 } },

  // ── STATIONS ABANDONNÉES / MYSTÉRIEUSES ──────────────────────────────────────
  { name: 'Les Cendres',
    description: st('lesCendres'),
    danger: 2, type: 'ruins',
    goods: ['Artefacts', 'Composants divers', 'Ferraille', 'Eau purifiée', 'Médicaments bas de gamme'],
    fuelCostFrom: { 'Le Purgatoire': 2, 'Les Abysses de Velkor': 3, 'Station Quarantaine': 3 } },

  { name: 'Station Quarantaine',
    description: st('stationQuarantaine'),
    danger: 3, type: 'ruins',
    goods: ['Données classifiées', 'Composants expérimentaux', 'Artefacts'],
    fuelCostFrom: { 'Les Abysses de Velkor': 4, 'Les Cendres': 3, "L'Épave Vivante": 4, "L'Arc Perdu": 6 },
    exclusiveGoods: ['Composants expérimentaux'] },

  { name: 'Le Berceau',
    description: st('leBerceau'),
    danger: 2, type: 'ruins',
    goods: ['Artefacts', 'Données', 'Données classifiées'],
    fuelCostFrom: { 'Nexus Aldara': 2, 'Le Purgatoire': 4, 'Station Zéphyr': 3 } },

  { name: "L'Épave Vivante",
    description: st('epaveVivante'),
    danger: 2, type: 'ruins',
    goods: ['Ferraille', 'Marchandises volées', 'Composants divers'],
    fuelCostFrom: { "L'Entrepôt Zéro": 3, 'Station Quarantaine': 4, 'Les Cendres': 4 } },

  { name: 'Station Fantôme',
    description: st('stationFantome'),
    danger: 3, type: 'ruins',
    goods: ['Données volées', 'Matériaux interdits', 'Artefacts'],
    fuelCostFrom: { 'Station Rocaille': 2, 'La Forge Noire': 3, 'Les Cavernes de Mira': 2 } },

  // ── STATIONS NEUTRES ──────────────────────────────────────────────────────────
  { name: "L'Oasis de Fer",
    description: st('oasisDeFer'),
    danger: 1, type: 'peaceful',
    goods: ['Médicaments', 'Carburant de récup', 'Nourriture fraîche'],
    fuelCostFrom: { 'Le Purgatoire': 3, 'La Citadelle Écarlate': 3, 'Fort Ossian': 4 } },

  { name: 'La Balise',
    description: st('laBalise'),
    danger: 0, type: 'peaceful',
    goods: ['Eau purifiée', 'Nourriture synthétique', 'Carburant de récup'],
    fuelCostFrom: { 'Colonie Perséphone': 2, 'Fort Ossian': 3, 'Confluent': 3, 'Paradoxa Eterna': 4 } },

  { name: 'Confluent',
    description: st('confluent'),
    danger: 1, type: 'peaceful',
    goods: ['Médicaments', 'Vivres', 'Outils', 'Carburant de récup'],
    fuelCostFrom: { 'Port Méridien': 3, 'Fort Kharos': 2, 'Colonie Perséphone': 4, 'La Balise': 3, 'Le Grand Bazar': 2 } },

  { name: 'Port de Nuit',
    description: st('portDeNuit'),
    danger: 2, type: 'dangerous',
    goods: ['Drogues de synthèse', 'Armes illégales', 'Informations monnayables'],
    fuelCostFrom: { 'Les Bas-Fonds de Vega': 2, 'Repaire Vega-Sud': 2, "L'Entrepôt Zéro": 3 } },

  // ── GRAND MARCHÉ DE CRAFT ─────────────────────────────────────────────────────
  { name: 'Le Grand Bazar',
    description: st('leGrandBazar'),
    danger: 0, type: 'industrial',
    goods: [
      'Ferraille', 'Outils', 'Outils lourds', 'Métaux bruts', 'Métaux rares',
      'Pièces techniques', 'Composants divers', 'Composants électroniques',
      'Composants tactiques', "Composants d'armure", 'Composants expérimentaux',
      'Cristaux énergétiques', 'Technologies avancées', 'Munitions', 'Munitions spéciales',
      'Équipement tactique', 'Médicaments', 'Médicaments premium', 'Plantes médicinales',
      'Eau purifiée', 'Nourriture fraîche', 'Données', 'Logiciels', 'Carburant de récup',
    ],
    fuelCostFrom: { 'Port Méridien': 3, 'Confluent': 2, 'Nexus Aldara': 3, 'Relais de Transit': 3 } },

  // ── SCIENTIFIQUES / EXPLORATION ───────────────────────────────────────────────
  { name: 'Station Zéphyr',
    description: st('stationZephyr'),
    danger: 1, type: 'scientific',
    goods: ['Composants expérimentaux', 'Données', 'Implants'],
    fuelCostFrom: { 'Nexus Aldara': 2, 'Le Berceau': 3, 'Fort Kharos': 4 } },

  { name: "L'Observatoire",
    description: st('observatoire'),
    danger: 0, type: 'scientific',
    goods: ['Données', 'Logiciels', 'Composants électroniques'],
    fuelCostFrom: { 'Colonie Perséphone': 4, 'La Balise': 3, 'Station Zéphyr': 4 } },

  { name: 'Station Limite',
    description: st('stationLimite'),
    danger: 2, type: 'scientific',
    goods: ['Données classifiées', 'Carburant premium', 'Composants expérimentaux'],
    fuelCostFrom: { 'Scotty Golden North': 3, 'Les Abysses de Velkor': 4, "L'Observatoire": 4, 'La Bulle': 3 } },

  // ── INDUSTRIELS ────────────────────────────────────────────────────────────────
  { name: 'Les Cavernes de Mira',
    description: st('cavernesDeMira'),
    danger: 1, type: 'industrial',
    goods: ['Métaux rares', 'Cristaux énergétiques', 'Artefacts'],
    fuelCostFrom: { 'Station Rocaille': 2, 'Station Fantôme': 2, 'La Forge Noire': 3 },
    exclusiveGoods: ['Cristaux énergétiques'] },

  { name: 'La Raffinerie',
    description: st('laRaffinerie'),
    danger: 2, type: 'industrial',
    goods: ['Carburant premium', 'Métaux rares', 'Cristaux énergétiques'],
    fuelCostFrom: { 'La Forge Noire': 1, 'Les Cavernes de Mira': 2, 'Station Rocaille': 4, 'Forge Alpha': 1, 'Station Fantôme': 3 },
    specialService: 'fuel_cheap',
    fuelDiscount: 0.35,
    exclusiveGoods: ['Carburant premium'] },

  // ── PERSONNAGES PILIERS — ZONES SPÉCIALES ─────────────────────────────────────
  {
    name: "L'Arc Perdu",
    description: st('arcPerdu'),
    danger: 3, type: 'ruins',
    goods: ['Reliques de la Grande Guerre', 'Artefacts de Nexus', 'Données pré-Fracture', 'Équipement militaire ancien'],
    fuelCostFrom: { 'Les Abysses de Velkor': 5, 'Station Quarantaine': 6 },
    exclusiveGoods: ['Reliques de la Grande Guerre', 'Artefacts de Nexus', 'Données pré-Fracture'],
  },
  {
    name: 'La Tribosphère',
    description: st('laTribosphere'),
    danger: 1, type: 'peaceful',
    goods: ['Alcools exotiques', 'Spécialités festives', 'Médicaments', 'Divertissement'],
    fuelCostFrom: { 'Star Quest': 3, 'Scotty Golden North': 3, "La Couronne d'Eos": 4 },
    exclusiveGoods: ['Alcools exotiques', 'Spécialités festives', 'Divertissement'],
  },
  {
    name: 'Paradoxa Eterna',
    description: st('paradoxaEterna'),
    danger: 0, type: 'peaceful',
    goods: ['Fruits rares', 'Plantes médicinales', 'Composants organiques', 'Épices exotiques'],
    fuelCostFrom: { 'Colonie Perséphone': 3, 'Port Méridien': 4, 'La Balise': 4 },
    specialService: 'rest_bonus',
    exclusiveGoods: ['Fruits rares', 'Composants organiques', 'Épices exotiques'],
  },

  // ── ARÈNE ─────────────────────────────────────────────────────────────────
  { name: "L'Arène de Korsun",
    description: st('areneDeKorsun'),
    danger: 2, type: 'dangerous',
    goods: ['Médicaments premium', 'Stimulants de combat', 'Équipement tactique'],
    fuelCostFrom: { 'Star Quest': 2, 'Emporium Requiem': 3, 'Les Bas-Fonds de Vega': 4 },
    specialService: 'arena',
    exclusiveGoods: ['Stimulants de combat'] },

  // ── NOUVELLES STATIONS ────────────────────────────────────────────────────────
  { name: 'Port des Brumes',
    description: st('portDesBrumes'),
    danger: 2, type: 'dangerous',
    goods: ['Fausses identités', 'Données volées', 'Équipement de camouflage', 'Pièces de contrebande'],
    fuelCostFrom: { 'Les Bas-Fonds de Vega': 2, "L'Entrepôt Zéro": 2, 'Port de Nuit': 2 } },

  { name: 'Forge Alpha',
    description: st('forgeAlpha'),
    danger: 1, type: 'industrial',
    goods: ['Composants de précision', 'Matériaux industriels', 'Outils lourds', 'Pièces techniques'],
    fuelCostFrom: { 'La Raffinerie': 1, 'Station Rocaille': 3, 'Les Cavernes de Mira': 3, 'La Forge Noire': 2 },
    specialService: 'fuel_cheap',
    fuelDiscount: 0.35,
    exclusiveGoods: ['Composants de précision', 'Matériaux industriels'] },

  { name: 'Le Sanctuaire des Dérives',
    description: st('sanctuaireDesDerives'),
    danger: 0, type: 'peaceful',
    goods: ['Médicaments premium', 'Implants', 'Plantes médicinales', 'Équipement médical'],
    fuelCostFrom: { 'Port Méridien': 3, 'Nexus Aldara': 3, 'Fort Ossian': 4 },
    specialService: 'implants',
    exclusiveGoods: ['Plantes médicinales', 'Équipement médical'] },

  { name: 'Sanctum Machina',
    description: st('sanctumMachina'),
    danger: 2, type: 'scientific',
    goods: ['Logiciels', 'Composants expérimentaux', 'Données', 'Implants cybernétiques'],
    fuelCostFrom: { 'Nexus Aldara': 2, 'Station Zéphyr': 3, 'Le Berceau': 3, 'La Bulle': 2 } },

  { name: 'La Bulle',
    description: st('laBulle'),
    danger: 1, type: 'scientific',
    goods: ['Implants', 'Médicaments expérimentaux', 'Composants biologiques', 'Drogues de synthèse'],
    fuelCostFrom: { 'Nexus Aldara': 3, 'Station Limite': 3, "L'Observatoire": 4 },
    specialService: 'implants',
    exclusiveGoods: ['Médicaments expérimentaux', 'Composants biologiques'] },

  { name: 'La Forge des Damnés',
    description: st('laForgeDesDamnes'),
    danger: 3, type: 'industrial',
    goods: ['Armes artisanales', 'Armes illégales', "Composants d'armure", 'Matériaux interdits'],
    fuelCostFrom: { 'La Forge Noire': 2, 'Repaire Vega-Sud': 3, 'Port des Brumes': 3 },
    specialService: 'weapon_forge',
    exclusiveGoods: ['Armes illégales', 'Matériaux interdits'] },
  ]
}

export function getStationsSellingItem(itemName: string): string[] {
  return getStations().filter(s => s.goods.includes(itemName)).map(s => s.name)
}

export function getStation(name: string): StationData {
  return getStations().find(s => s.name === name) ?? getStations()[0]
}

export function getAccessibleStations(currentName: string): StationData[] {
  return getStations().filter(s => {
    if (s.name === currentName) return false
    const cost = s.fuelCostFrom[currentName]
    return cost !== undefined
  })
}


// Marchandises jamais vendues en boutique : elles ne s'obtiennent qu'en butin
// (ennemis, exploration, wander). Le marché les filtre — toute logique qui
// demande au joueur d'en ACHETER une doit donc les exclure, sinon elle crée
// un objectif impossible.
export const LOOT_ONLY_ITEMS = new Set([
  'Armes lourdes', 'Armes artisanales', 'Armes Tier 3', 'Armes Tier 4', 'Armes exotiques',
  "Armures Faucon", "Armures d'élite", 'Armures premium', 'Armures Tier 4',
])

export function getFuelCost(from: string, to: string): number {
  const dest = getStation(to)
  return dest.fuelCostFrom[from] ?? 99
}

export const PEACEFUL_STATIONS = new Set([
  'Port Méridien', 'Colonie Perséphone', 'Star Quest', 'Scotty Golden North', 'La Tribosphère', 'Paradoxa Eterna'
])

// Stations où le carburant est en vente et où les upgrades vaisseau sont disponibles
export const FUEL_STATIONS = new Set([
  'La Carcasse',
  'Port Méridien',
  'La Balise',
  'Confluent',
  'La Raffinerie',
  'Forge Alpha',
  'Relais Noir',
  'Relais de Transit',
  'Fort Kharos',
  'Le Grand Bazar',
])

export const BOSS_STATIONS: Record<string, string> = {
  // Faucons Noirs
  'Arc Ouest Apocalypse':   'Alanossa',
  'Le Nid des Faucons':     'La Faucon',
  'Station Ombre':          'Le Fantôme des Ombres',
  'La Tanière':             'La Bête Noire',
  'Le Perchoir':            'Le Vigie Immortel',
  'Relais Noir':            "Le Ravitailleur de l'Ombre",
  'Fort de Cendres':        'Le Boucher de Velkor',
  "L'Œil du Faucon":       "L'Architecte du Chaos",
  // Gardiens Écarlates
  'La Citadelle Écarlate':  'Commandante Zara Sable',
  'La Forteresse Exilée':   "L'Exilé Écarlate",
  'Bastion Mineur':         'Commandant Garant',
  'Poste Vigie':            'Amiral Voss-Kheran',
  "L'Arsenal Écarlate":    'Le Colosse de Ferraille',
  // Emporium
  'Emporium Requiem':       'Cesarion',
  'Comptoir Sud':           'La Marchande de Mort',
  'Annexe Commerciale':     'Le Directeur Fantôme',
  'Relais de Transit':      'Le Passeur Sanguinaire',
  // Criminel / bas-fonds
  'Les Bas-Fonds de Vega':  'Le Baron de Vega',
  'Repaire Vega-Sud':       'La Veuve de Vega',
  'Port de Nuit':           'Le Roi de Nuit',
  'La Forge Noire':         'Le Maître-Forgeron Maudit',
  "L'Entrepôt Zéro":       "L'Archiviste sans Visage",
  // Militaire neutre
  'Fort Kharos':            'Le Général de Fer',
  'Fort Ossian':            'Frère Ossian le Dernier',
  'Star Quest':             "Garde du Corps d'Eliotis",
  // Ruines / abandonnées
  'Les Abysses de Velkor':  'Directeur Pale',
  'Station Quarantaine':    'Patient Zéro',
  'Station Fantôme':        "L'Ombre du Vide",
  'Les Cendres':            'Le Survivant des Cendres',
  'Le Berceau':             'Le Gardien Originel',
  "L'Épave Vivante":       'Le Capitaine Amalgame',
  'Le Purgatoire':          'Le Geôlier des Morts',
  // Luxe / haute société
  "La Couronne d'Eos":     'Oracle de la Singularité',
  'Scotty Golden North':    'Samy Scotty',
  'Résidence Orbitale':     'Lord Daekar',
  "Club Privé Éos":        'Le Maître des Ombres',
  // Industriel / minier
  'Station Rocaille':       'Le Titan Mineur',
  'Les Cavernes de Mira':   'La Créature de Mira',
  'La Raffinerie':          'Le Contremaître Infernal',
  // Scientifique
  'Nexus Aldara':           'Protocole ΔX-7',
  'Station Limite':         'La Mère Mecanique',
  'Station Zéphyr':         'Le Chercheur Fracturé',
  "L'Observatoire":        "L'Astronome des Abysses",
  // Paisible / neutre
  'La Carcasse':            'Le Ferrailleur des Épaves',
  'Port Méridien':          "L'Inspecteur Véreux",
  'Colonie Perséphone':     'La Matriarche de Perséphone',
  "L'Oasis de Fer":        'Le Médiateur de Fer',
  'La Balise':              'Le Gardien du Signal',
  'Confluent':              'Le Seigneur des Routes',
  // Personnages piliers — zones spéciales
  "L'Arc Perdu":           'Raphazarus',
  'La Tribosphère':         'Eliotis',
  'Paradoxa Eterna':        'Le Roi Maxance',
  // Arène
  "L'Arène de Korsun":     'Le Champion des Arènes',
  // Nouvelles stations
  'Port des Brumes':          'Le Fantôme des Brumes',
  'Forge Alpha':              'Le Contremaître de Forge',
  'Le Sanctuaire des Dérives': 'Sœur Valkara',
  'Sanctum Machina':          'ARIA-9 Protocole Noir',
  'La Bulle':                 'Docteur Flinch',
  'La Forge des Damnés':      "L'Armurière Skade",
}

// BFS — chemin le plus court (en nombre de sauts) entre deux stations
export function findPath(from: string, to: string, excluded?: Set<string>): string[] {
  if (from === to) return [from]
  const adj: Record<string, string[]> = {}
  for (const s of getStations()) {
    if (excluded && excluded.has(s.name) && s.name !== to) continue
    for (const src of Object.keys(s.fuelCostFrom)) {
      if (excluded && excluded.has(src) && src !== from) continue
      if (!adj[src]) adj[src] = []
      adj[src].push(s.name)
    }
  }
  const visited = new Set<string>([from])
  const queue: string[][] = [[from]]
  while (queue.length > 0) {
    const path = queue.shift()!
    for (const next of adj[path[path.length - 1]] ?? []) {
      if (next === to) return [...path, next]
      if (!visited.has(next)) {
        visited.add(next)
        queue.push([...path, next])
      }
    }
  }
  return []
}

export const getStations = memoByLang(buildStations)

// Sièges des six détenteurs de piliers. Ce sont des destinations de fin de
// partie : rien ne doit y envoyer un joueur qui débute. À distinguer de
// BOSS_STATIONS, qui recense le chef local de presque toutes les stations,
// y compris des hubs paisibles comme Port Méridien.
export const PILLAR_SEAT_STATIONS = new Set([
  'Emporium Requiem',       // Cesarion
  "L'Arc Perdu",            // Raphazarus
  'Arc Ouest Apocalypse',   // Alanossa
  'Scotty Golden North',    // Samy Scotty
  'La Tribosphère',         // Eliotis
  'Paradoxa Eterna',        // Le Roi Maxance
])
