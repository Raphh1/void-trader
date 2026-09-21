import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n, setLanguage } from '../i18n/config'
import { getSubBossesForPillar } from '../data/subBosses'
import { grantLieutenantReward, describeLieutenantReward } from '../data/lieutenantRewards'
import { getWeapons } from '../data/weapons'
import { getArmors } from '../data/armors'
import { translateWeaponName, translateArmorName, translateGood } from '../engine/goodsI18n'
import type { GameState } from '../types'

// Le butin des lieutenants était déclaré dans les données mais jamais donné :
// seules les récompenses en crédits passaient. Chaque lieutenant doit rapporter
// quelque chose de réel, et les objets uniques ne doivent pas fuiter dans le
// butin aléatoire.

beforeAll(async () => { await initI18n() })

const PILIERS = ['alanossa', 'cesarion', 'raphazarus', 'scotty']
const noms = { weapon: translateWeaponName, armor: translateArmorName, good: translateGood }
const lieutenants = () => PILIERS.flatMap(p => getSubBossesForPillar(p))

function gsVide(): GameState {
  return { credits: 1000, reputation: 0, weapons: [], armors: [], equippedArmor: null, cargo: {} } as unknown as GameState
}

describe('butin des lieutenants', () => {

  it('donne réellement chaque récompense déclarée', () => {
    expect(lieutenants().length).toBe(16)
    for (const sb of lieutenants()) {
      const avant = gsVide()
      const { patch, message } = grantLieutenantReward(avant, sb, noms)
      const apres = { ...avant, ...patch }
      expect(message, sb.id + ' : aucun message de butin').toBeTruthy()
      switch (sb.reward.type) {
        case 'weapon': expect(apres.weapons.map(w => w.name), sb.id).toContain(sb.reward.value); break
        case 'armor':  expect(apres.armors.map(a => a.name), sb.id).toContain(sb.reward.value); break
        case 'credits': expect(apres.credits, sb.id).toBeGreaterThan(avant.credits); break
        case 'rep':    expect(apres.reputation, sb.id).toBeGreaterThan(avant.reputation); break
        case 'item':   expect(Object.values(apres.cargo).reduce((n, q) => n + (q ?? 0), 0), sb.id).toBeGreaterThan(0); break
      }
    }
  })

  it('garde les armes et armures uniques hors du butin aléatoire', () => {
    const aleatoires = new Set([...getWeapons().map(w => w.name), ...getArmors().map(a => a.name)])
    for (const sb of lieutenants()) {
      if (sb.reward.type === 'weapon' || sb.reward.type === 'armor') expect(aleatoires.has(sb.reward.value as string), sb.id).toBe(false)
    }
  })

  it('affiche le butin traduit en anglais', async () => {
    await setLanguage('en')
    for (const sb of lieutenants()) {
      const libelle = describeLieutenantReward(sb, noms)
      expect(libelle, sb.id).toMatch(/^Loot if defeated in combat: /)
      if (sb.reward.type === 'weapon' || sb.reward.type === 'armor') {
        expect(libelle, sb.id + ' : nom resté en français').not.toContain(sb.reward.value as string)
      }
    }
    await setLanguage('fr')
  })
})
