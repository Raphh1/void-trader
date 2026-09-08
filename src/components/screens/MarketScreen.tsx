import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { playBuy, playSell } from '../../engine/sfx'
import { getStation, FUEL_STATIONS, LOOT_ONLY_ITEMS } from '../../data/stations'
import { getBuyDiscount } from '../../engine/factions'
import { getWorldEventPriceMultiplier, getActiveEvents } from '../../engine/worldEvents'
import { getCulteArtefactMult, getFactionSurchargeAtStation, getStationFactionName, getRepLevel, getFactionRep, STATION_FACTION_CONTROL } from '../../engine/factionRep'
import { getRunBuyMult } from '../../data/runModifiers'
import { getFullBuyMult, getFullSellMult, getMarketContext, getPillarDiscount } from '../../engine/marketPricing'
import { getBlackMarketOffers, isBlackMarketAvailable, buyBlackMarketOffer } from '../../engine/blackMarket'
import { translateGood, translateWeaponName, translateArmorName, translateStationName } from '../../engine/goodsI18n'

const BASE_PRICES: Record<string, number> = {
  'Médicaments': 250, 'Médicaments premium': 580, 'Métaux bruts': 130,
  'Nourriture synthétique': 100, 'Nourriture fraîche': 140, 'Carburant de récup': 380,
  'Composants électroniques': 320, 'Vêtements': 145, 'Outils': 190, 'Outils lourds': 320,
  'Armes illégales': 800, 'Drogues de synthèse': 480, 'Données volées': 650,
  'Pièces de contrebande': 400, 'Équipements blindés': 720, 'Rations militaires': 115,
  'Munitions': 290, 'Munitions spéciales': 560, 'Composants tactiques': 560,
  'Implants': 960, 'Logiciels': 450, 'Données': 350, 'Données classifiées': 1120,
  'Matériel de pillage': 510, 'Butin de guerre': 720, 'Eau purifiée': 80,
  'Minerais': 175, 'Équipement agricole': 225, 'Métaux rares': 560,
  'Cristaux énergétiques': 800, 'Armes artisanales': 640, "Composants d'armure": 480,
  'Matériaux interdits': 960, 'Marchandises volées': 400, 'Composants divers': 240,
  'Informations monnayables': 560, 'Armes Tier 3': 1440, 'Armures premium': 1280,
  'Luxe': 1120, 'Informations VIP': 960, "Armures d'élite": 1920,
  'Armes lourdes': 1600, 'Artefacts': 1300, 'Composants expérimentaux': 1440,
  'Carburant premium': 190, 'Armes exotiques': 2400, 'Technologies avancées': 1760,
  'Armes Tier 4': 3200, 'Armures Tier 4': 2880, 'Renseignements': 800,
  'Intel faction': 640, 'Équipement tactique': 960, 'Armures Faucon': 1600,
  'Rations': 115, 'Armures': 640, 'Ferraille': 80, 'Plantes médicinales': 290,
  'Or': 950, 'Pièces techniques': 320, 'Vivres': 145,
  'Alcools exotiques': 480, 'Spécialités festives': 350, 'Divertissement': 280,
  'Fruits rares': 400, 'Composants organiques': 350, 'Épices exotiques': 300,
  'Fausses identités': 1200, 'Équipement de camouflage': 680,
  'Composants de précision': 450, 'Matériaux industriels': 280,
  'Équipement médical': 540, 'Médicaments expérimentaux': 780,
  'Composants biologiques': 620, 'Implants cybernétiques': 1100,
  'Stimulants de combat': 480, 'Reliques de la Grande Guerre': 1600,
  'Artefacts de Nexus': 2200, 'Données pré-Fracture': 1800,
  'Équipement militaire ancien': 900, 'Jetons de casino': 200,
  'Implants militaires': 850, 'Matériel de guerre': 720,
  'Objets de contrebande': 380, 'Médicaments bas de gamme': 100,
}

// Prix déterministes — la variation inter-station vient de stationPriceSeeds (persisté en GameState)
function getBasePrice(item: string): number {
  return BASE_PRICES[item] ?? 200
}


// Limites de soute par item (protection anti-abus)
export const ITEM_CARGO_MAX: Record<string, number> = {
  'Implants': 2,
  'Implants militaires': 2,
  'Médicaments premium': 4,
  'Or': 5,
  'Cristaux énergétiques': 6,
  'Métaux rares': 8,
  'Technologies avancées': 4,
  'Composants expérimentaux': 4,
  'Données classifiées': 5,
}

const BAZAR_BUY_LIMIT = 3

export function MarketScreen() {
  const { t } = useTranslation('marketScreen')
  const { t: tc } = useTranslation('common')
  const gs        = useGameStore(s => s.gs!)
  const goTo      = useGameStore(s => s.goTo)
  const buyCargo          = useGameStore(s => s.buyCargo)
  const sellCargo         = useGameStore(s => s.sellCargo)
  const patch             = useGameStore(s => s.patch)

  const isBazar = gs.currentStation === 'Le Grand Bazar'

  // Reset automatique des compteurs si 15j ou plus se sont écoulés
  const bazarBought = useMemo(() => {
    if (!isBazar) return {}
    const daysSinceReset = gs.day - (gs.bazarLastResetDay ?? 1)
    return daysSinceReset >= 15 ? {} : (gs.bazarPurchases ?? {})
  }, [isBazar, gs.day, gs.bazarLastResetDay, gs.bazarPurchases])

  const station    = getStation(gs.currentStation)
  const discount   = getBuyDiscount(gs)
  const events     = getActiveEvents(gs)
  const runBuyMult = getRunBuyMult(gs)
  const soutePct       = (gs.shipModules?.soute ?? 0) * 10
  const maxCargo       = 15 + (gs.shipModules?.soute ?? 0) * 5
  const totalCargo     = Object.values(gs.cargo).reduce((a, b) => a + b, 0)
  const soutePleine    = totalCargo >= maxCargo
  const culteArtefact  = getCulteArtefactMult(gs)
  const ARTEFACT_ITEMS = new Set(['Artefacts', 'Données classifiées', 'Composants expérimentaux', 'Technologies avancées'])

  const marketCtx    = getMarketContext(gs, station.type)
  const pillarDisc   = getPillarDiscount(gs)
  const stationSeed  = gs.stationPriceSeeds?.[gs.currentStation] ?? 1.0
  const factionSurcharge = getFactionSurchargeAtStation(gs, gs.currentStation)

  // Prix de base figés par station — évite le re-roll à chaque render
  const frozenBasePrices = useMemo(() => {
    const all = [...station.goods, 'Carburant de récup']
    const out: Record<string, number> = {}
    for (const item of all) out[item] = getBasePrice(item)
    return out
  }, [gs.currentStation]) // eslint-disable-line react-hooks/exhaustive-deps
  const controllingFaction = STATION_FACTION_CONTROL[gs.currentStation]
  const controllingFactionName = getStationFactionName(gs.currentStation)
  const factionRepLevel = controllingFaction ? getRepLevel(getFactionRep(gs, controllingFaction)) : null

  const priceTag = stationSeed <= 0.88
    ? { label: t('priceTagCheap'), color: 'var(--green)' }
    : stationSeed >= 1.12
    ? { label: t('priceTagExpensive'), color: 'var(--red)' }
    : null

  const bazarDaysUntilReset = isBazar
    ? Math.max(0, 15 - (gs.day - (gs.bazarLastResetDay ?? 1)))
    : 0

  return (
    <div className="layout">
      {/* Header */}
      <div className="row" style={{ alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button className="px-btn px-btn--sm" style={{ width: 'auto' }} onClick={() => goTo('station-hub')}>{tc('buttons.back')}</button>
        <div className="t-sm t-bright" style={{ flex: 1 }}>{t('title', { station: translateStationName(station.name) })}</div>
        <div className="t-xs t-gold">{gs.credits.toLocaleString()} cr</div>
        <div className="t-xs" style={{ color: totalCargo >= maxCargo ? 'var(--red)' : 'var(--dim)' }}>
          {t('cargo', { current: totalCargo, max: maxCargo })}
        </div>
        {isBazar && <div className="t-xs t-dim" style={{ fontSize: '9px', letterSpacing: '1px' }}>{t('stockReset', { days: bazarDaysUntilReset })}</div>}
        {priceTag && <div className="t-xs" style={{ color: priceTag.color, fontWeight: 'bold', fontSize: '9px', letterSpacing: '1px' }}>{priceTag.label}</div>}
        {factionSurcharge > 0 && <div className="t-xs" style={{ color: 'var(--red)', fontWeight: 'bold', fontSize: '9px', letterSpacing: '1px' }}>{t('factionSurcharge', { pct: factionSurcharge, faction: controllingFactionName?.toUpperCase() })}</div>}
        {discount > 0 && <div className="tag tag--green t-xs">{t('factionDiscount', { pct: discount })}</div>}
        <button className="px-btn px-btn--sm" style={{ width: 'auto', color: 'var(--cyan)', borderColor: 'var(--cyan)' }}
          onClick={() => goTo('inventory')}>
          {t('inventory')}
        </button>
      </div>

      {/* Contexte marché — profil de la station */}
      {marketCtx.length > 0 && (
        <div className="col gap4">
          {marketCtx.map((line, i) => {
            const isHostile = line.startsWith('⚠')
            const isAlliance = line.includes('Alliance')
            return (
              <div key={i} className="px-box" style={{
                borderColor: isHostile ? 'var(--red)' : isAlliance ? 'var(--green)' : 'var(--border)',
                padding: '5px 12px', background: 'rgba(0,0,0,0.4)'
              }}>
                <span className="t-xs" style={{ color: isHostile ? 'var(--red)' : isAlliance ? 'var(--green)' : 'var(--dim)' }}>
                  {line}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Événements mondiaux affectant les prix */}
      {events.length > 0 && (
        <div className="col gap4">
          {events.map(evt => (
            <div key={evt.id} className="px-box" style={{ borderColor: evt.color, padding: '6px 12px', background: 'rgba(0,0,0,0.4)' }}>
              <span style={{ color: evt.color, fontSize: '9px', letterSpacing: '1px' }}>⚠ {evt.title}</span>
              <span className="t-xs t-dim" style={{ marginLeft: '8px' }}>{evt.shortDesc}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid2" style={{ alignItems: 'start' }}>
        {/* ACHETER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={{
            background: soutePleine ? 'rgba(80,0,0,0.3)' : '#0d1a0d',
            border: `2px solid ${soutePleine ? 'var(--red)' : 'var(--gold)'}`,
            borderBottom: 'none',
            padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '9px', color: soutePleine ? 'var(--red)' : 'var(--gold)', letterSpacing: '2px' }}>{t('buySection')}</span>
            {soutePleine
              ? <span style={{ fontSize: '9px', color: 'var(--red)', letterSpacing: '1px', fontWeight: 'bold' }}>{t('cargoFull')}</span>
              : <span className="t-xs t-dim" style={{ marginLeft: 'auto' }}>{t('available', { credits: gs.credits.toLocaleString() })}</span>
            }
          </div>
          {soutePleine && (
            <div style={{
              border: '2px solid var(--red)', borderTop: 'none', borderBottom: 'none',
              background: 'rgba(60,0,0,0.25)', padding: '10px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--red)', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '4px' }}>
                {t('cargoFullTitle', { current: totalCargo, max: maxCargo })}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--dim)' }}>
                {t('cargoFullBody')}
              </div>
            </div>
          )}
          <div className="col list-zebra" style={{
            border: `2px solid ${soutePleine ? 'var(--red)' : 'var(--gold)'}`,
            padding: '6px', gap: '4px',
            opacity: soutePleine ? 0.45 : 1,
            pointerEvents: soutePleine ? 'none' : 'auto',
          }}>
            {station.goods
              .filter(item => !LOOT_ONLY_ITEMS.has(item))
              .map(item => {
              const rawPrice = Math.floor((frozenBasePrices[item] ?? 200) * stationSeed * getWorldEventPriceMultiplier(item, events) * runBuyMult * getFullBuyMult(gs, station.type, item))
              const price = Math.floor(rawPrice * (1 - discount / 100) * (1 + factionSurcharge / 100) * (1 - (gs.class.tradeBonusPercent ?? 0) / 100))
              const canBuy = gs.credits >= price
              const banned = gs.class.cannotBuyWeapons && (item.toLowerCase().includes('arme') || item.toLowerCase().includes('munitions'))
              const itemMax = ITEM_CARGO_MAX[item]
              const atMax = itemMax !== undefined && (gs.cargo[item] ?? 0) >= itemMax
              const bazarCount = isBazar ? (bazarBought[item] ?? 0) : 0
              const bazarMax = isBazar && bazarCount >= BAZAR_BUY_LIMIT
              const blocked = banned || atMax || bazarMax
              return (
                <button key={item} className="px-btn" disabled={!canBuy || blocked}
                  style={{ borderColor: station.exclusiveGoods?.includes(item) ? 'var(--gold)' : canBuy && !blocked ? 'var(--border)' : undefined }}
                  onClick={() => {
                    playBuy()
                    buyCargo(item, price)
                    if (isBazar) {
                      const daysSinceReset = gs.day - (gs.bazarLastResetDay ?? 1)
                      const currentPurchases = daysSinceReset >= 15 ? {} : (gs.bazarPurchases ?? {})
                      patch({
                        bazarPurchases: { ...currentPurchases, [item]: (currentPurchases[item] ?? 0) + 1 },
                        bazarLastResetDay: daysSinceReset >= 15 ? gs.day : (gs.bazarLastResetDay ?? 1),
                      })
                    }
                  }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="t-xs">
                      {station.exclusiveGoods?.includes(item) && <span style={{ color: 'var(--gold)', marginRight: '5px', fontSize: '9px' }}>★</span>}
                      {translateGood(item)}
                      {isBazar && <span className="t-dim" style={{ marginLeft: '6px', fontSize: '9px' }}>({bazarCount}/{BAZAR_BUY_LIMIT})</span>}
                      {!isBazar && itemMax !== undefined && <span className="t-dim" style={{ marginLeft: '6px', fontSize: '9px' }}>({gs.cargo[item] ?? 0}/{itemMax})</span>}
                    </span>
                    <span className="t-gold t-xs">
                      {banned ? <span className="t-red">{t('forbidden')}</span>
                        : (atMax || bazarMax) ? <span style={{ color: 'var(--dim)' }}>{t('max')}</span>
                        : `${price} cr`}
                    </span>
                  </div>
                </button>
              )
            })}
            {FUEL_STATIONS.has(gs.currentStation) && gs.fuel < gs.maxFuel && (() => {
              const price = Math.floor((frozenBasePrices['Carburant de récup'] ?? 240) * getFullBuyMult(gs, station.type, 'Carburant de récup') * (1 - discount / 100))
              return (
                <button className="px-btn px-btn--green" disabled={gs.credits < price}
                  onClick={() => { playBuy(); useGameStore.getState().buyFuel(1, price) }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="t-xs">{t('buyFuel', { current: gs.fuel, max: gs.maxFuel })}</span>
                    <span className="t-cyan t-xs">{price} cr</span>
                  </div>
                </button>
              )
            })()}
          </div>
        </div>

        {/* VENDRE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={{
            background: '#001a0d',
            border: '2px solid var(--green)',
            borderBottom: 'none',
            padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '9px', color: 'var(--green)', letterSpacing: '2px' }}>{t('sellSection')}</span>
            {soutePct > 0 && <span className="tag tag--green t-xs">{t('cargoBonus', { pct: soutePct })}</span>}
            <span className="t-xs t-dim" style={{ marginLeft: 'auto' }}>
              {Object.keys(gs.cargo).length === 0 ? t('cargoEmptyCount') : t('cargoTypeCount', { count: Object.keys(gs.cargo).length })}
            </span>
          </div>
          <div className="col list-zebra" style={{ border: '2px solid var(--green)', padding: '6px', gap: '4px' }}>
            {Object.keys(gs.cargo).length === 0 && (
              <div className="px-box t-dim t-xs" style={{ border: 'none', background: 'transparent' }}>
                {t('cargoEmpty')}
              </div>
            )}
            {(gs.cargo['Passager'] ?? 0) > 0 && (
              <div className="px-box t-xs" style={{ border: 'none', background: 'transparent', color: 'var(--orange)' }}>
                {t('passengerWarning')}
              </div>
            )}
            {Object.entries(gs.cargo).filter(([item]) => item !== 'Passager').map(([item, qty]) => {
              const culteMult = ARTEFACT_ITEMS.has(item) ? culteArtefact : 1
              const sellPrice = Math.floor(getBasePrice(item) * stationSeed * getFullSellMult(gs, station.type, item) * getWorldEventPriceMultiplier(item, events) * (1 + soutePct / 100) * culteMult * (factionSurcharge > 0 ? 0.75 : 1))
              const medBonus  = gs.class.medicBonus && item === 'Médicaments'
                ? Math.floor(sellPrice * 0.5) : 0
              const tradeBonus = Math.floor(sellPrice * (gs.class.tradeBonusPercent ?? 0) / 100)
              const total = sellPrice + medBonus + tradeBonus
              return (
                <button key={item} className="px-btn" style={{ borderColor: '#206040', color: 'var(--green)' }}
                  onClick={() => { playSell(); sellCargo(item, sellPrice) }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="t-xs">{t('itemQty', { item: translateGood(item), qty })}</span>
                    <span className="t-green t-xs">
                      {t('sellTotal', { total })}{medBonus > 0 ? t('sellMedicBonus', { bonus: medBonus }) : ''}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── MARCHÉ NOIR ──────────────────────────────────────────────────── */}
      {station.danger >= 1 && isBlackMarketAvailable(gs) && (() => {
        const bmOffers = getBlackMarketOffers(gs)
        return (
          <div className="px-box" style={{ borderColor: 'var(--red)', background: 'rgba(60,0,0,0.15)' }}>
            <div className="t-xs mb8" style={{ color: 'var(--red)', letterSpacing: '2px' }}>{t('blackMarketTitle')}</div>
            <div className="t-xs t-dim mb8" style={{ lineHeight: 1.6 }}>{t('blackMarketDesc')}</div>
            <div className="col gap4">
              {bmOffers.map(offer => (
                <button key={offer.id} className="px-btn" style={{ borderColor: 'rgba(200,50,50,0.4)', textAlign: 'left' }}
                  disabled={gs.credits < offer.price}
                  onClick={() => {
                    const result = buyBlackMarketOffer(gs, offer)
                    if (result) { playBuy(); patch(result) }
                  }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="t-xs" style={{ color: offer.type === 'weapon' ? 'var(--orange)' : offer.type === 'armor' ? 'var(--blue)' : 'var(--red)' }}>
                      {offer.type === 'weapon' ? translateWeaponName(offer.name) : offer.type === 'armor' ? translateArmorName(offer.name) : offer.name}
                    </span>
                    <span className="t-xs t-red">{offer.price.toLocaleString()} cr</span>
                  </div>
                  <div className="t-xs t-dim" style={{ lineHeight: 1.6, marginTop: '2px' }}>{offer.description}</div>
                  {offer.itemQty && <div className="t-xs t-dim">{t('blackMarketQty', { qty: offer.itemQty })}</div>}
                </button>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
