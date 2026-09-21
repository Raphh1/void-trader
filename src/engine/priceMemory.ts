// Mémoire des prix vus au marché (relevés enregistrés par MarketScreen).
//
// Le commerce se faisait de mémoire. On garde le dernier relevé de chaque
// station visitée pour afficher la tendance depuis la visite précédente et le
// meilleur prix vu ailleurs — à l'achat comme à la vente.
import type { PriceSnapshot } from '../types'

// Écart minimal pour afficher une tendance : en dessous, c'est du bruit.
const SEUIL_TENDANCE = 3

/** Variation (en %) depuis le relevé précédent de la station, ou null. */
export function priceTrend(avant: PriceSnapshot | undefined, side: 'buy' | 'sell', item: string, prix: number): { pct: number } | null {
  const ancien = avant?.[side][item]
  if (!ancien || ancien <= 0) return null
  const pct = Math.round((prix - ancien) / ancien * 100)
  return Math.abs(pct) >= SEUIL_TENDANCE ? { pct } : null
}

/** Meilleur prix vu dans une AUTRE station : le plus bas à l'achat, le plus haut à la vente. */
export function bestSeenElsewhere(
  memoire: Record<string, PriceSnapshot> | undefined, ici: string, side: 'buy' | 'sell', item: string,
): { price: number; station: string; day: number } | null {
  let best: { price: number; station: string; day: number } | null = null
  for (const [station, snap] of Object.entries(memoire ?? {})) {
    if (station === ici) continue
    const p = snap[side][item]
    if (p === undefined) continue
    if (!best || (side === 'buy' ? p < best.price : p > best.price)) best = { price: p, station, day: snap.day }
  }
  return best
}
