// Pile ou face de Rayane : le moteur tire le résultat immédiatement, puis
// l'annonce ici. L'interface (CoinFlipOverlay) le met en scène par-dessus
// l'écran — la pièce tourne, ralentit, hésite sur la tranche — et ne révèle
// l'issue qu'à la fin. Sans abonné (tests, simulations), l'annonce ne fait rien.

export type CoinStake = 'combat' | 'flee' | 'death' | 'fuel' | 'gamble' | 'interrogation'

export interface CoinFlipEvent {
  id: number
  heads: boolean                       // PILE = l'issue favorable
  stake: CoinStake
  params?: Record<string, string | number>
}

type Listener = (e: CoinFlipEvent) => void
const listeners = new Set<Listener>()
let seq = 0

export function announceCoinFlip(heads: boolean, stake: CoinStake, params?: CoinFlipEvent['params']): void {
  const e = { id: ++seq, heads, stake, params }
  listeners.forEach(l => l(e))
}

export function onCoinFlip(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
