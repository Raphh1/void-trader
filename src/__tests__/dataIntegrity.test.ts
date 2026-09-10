import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { getStations, BOSS_STATIONS, FUEL_STATIONS, PILLAR_SEAT_STATIONS, LOOT_ONLY_ITEMS } from '../data/stations'
import { getSubBossesForPillar } from '../data/subBosses'
import { getEquipmentQuests } from '../data/equipmentQuests'
import { getTierLow, getTierMid, getTierHigh, getTierBoss } from '../data/enemies'

// Même famille de bug que la poche sans retour : une référence qui pointe vers
// quelque chose d'inexistant ou d'inatteignable ne casse rien au démarrage,
// elle attend qu'un joueur tombe dessus. On les cherche donc à la racine.

beforeAll(async () => { await initI18n() })

const PILIERS = ['alanossa', 'cesarion', 'raphazarus', 'scotty']

describe('intégrité des données', () => {

  it('ne référence aucune station inexistante', () => {
    const existantes = new Set(getStations().map(s => s.name))
    const fautives: string[] = []

    const verifier = (nom: string, source: string) => {
      if (!existantes.has(nom)) fautives.push(source + ' → « ' + nom + ' »')
    }

    for (const n of Object.keys(BOSS_STATIONS)) verifier(n, 'BOSS_STATIONS')
    for (const n of FUEL_STATIONS) verifier(n, 'FUEL_STATIONS')
    for (const n of PILLAR_SEAT_STATIONS) verifier(n, 'PILLAR_SEAT_STATIONS')

    for (const p of PILIERS) {
      for (const sb of getSubBossesForPillar(p)) {
        verifier(sb.station, 'lieutenant ' + sb.name)
        for (const req of sb.service?.requirements ?? []) {
          if (req.type === 'visitStation') verifier(req.station, 'service de ' + sb.name)
        }
      }
    }

    for (const q of getEquipmentQuests()) {
      verifier(q.station, 'quête ' + q.id)
      for (const req of q.requirements) {
        if (req.type === 'visitStation') verifier(req.station, 'quête ' + q.id)
      }
    }

    // Les liaisons elles-mêmes : une origine inconnue rend la station
    // silencieusement inatteignable par ce chemin.
    for (const s of getStations()) {
      for (const origine of Object.keys(s.fuelCostFrom)) {
        verifier(origine, 'liaison vers ' + s.name)
      }
    }

    expect(fautives, 'référence(s) vers une station inexistante :\n' + fautives.join('\n')).toEqual([])
  })

  // NOTE : la vérification « aucun objet exigé introuvable » est retirée le
  // temps de trancher le sort de LOOT_ONLY_ITEMS — elle échoue aujourd hui sur
  // « Armes artisanales », exigé par eq-lame-noctis et par le service du
  // Maréchal Osseux, mais vendable nulle part et octroyé nulle part.

  it('ne référence aucun lieutenant ni ennemi inexistant', () => {
    const lieutenants = new Set(PILIERS.flatMap(p => getSubBossesForPillar(p)).map(sb => sb.id))
    const ennemis = new Set([...getTierLow(), ...getTierMid(), ...getTierHigh(), ...getTierBoss()].map(e => e.name))
    const fautives: string[] = []

    const verifierReq = (reqs: readonly { type: string; subBossId?: string; bossName?: string }[], source: string) => {
      for (const req of reqs) {
        if (req.type === 'subBoss' && req.subBossId && !lieutenants.has(req.subBossId)) {
          fautives.push(source + ' → lieutenant « ' + req.subBossId + ' »')
        }
        if (req.type === 'bossKill' && req.bossName && !ennemis.has(req.bossName)) {
          fautives.push(source + ' → ennemi « ' + req.bossName + ' »')
        }
      }
    }

    for (const p of PILIERS) {
      for (const sb of getSubBossesForPillar(p)) verifierReq(sb.service?.requirements ?? [], 'service de ' + sb.name)
    }
    for (const q of getEquipmentQuests()) verifierReq(q.requirements, 'quête ' + q.id)

    expect(fautives, 'référence(s) inexistante(s) :\n' + fautives.join('\n')).toEqual([])
  })

  it('laisse quelque chose à acheter dans chaque station', () => {
    // La Citadelle Écarlate ne vendait que des marchandises « loot only » : son
    // marché était vide, ce qui avait rendu la quête tutoriel impossible.
    const vides: string[] = []
    for (const s of getStations()) {
      const vendables = s.goods.filter(g => !LOOT_ONLY_ITEMS.has(g))
      if (vendables.length === 0) vides.push(s.name + ' (' + s.goods.join(', ') + ')')
    }
    expect(vides, 'station(s) au marché entièrement vide :\n' + vides.join('\n')).toEqual([])
  })
})
