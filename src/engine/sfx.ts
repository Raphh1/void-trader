let _ctx: AudioContext | null = null
let _enabled = true

function ctx(): AudioContext | null {
  if (!_enabled) return null
  if (!_ctx) {
    try { _ctx = new AudioContext() } catch { return null }
  }
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.18, startDelay = 0) {
  const c = ctx()
  if (!c) return
  const osc = c.createOscillator()
  const vol = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  vol.gain.setValueAtTime(gain, c.currentTime + startDelay)
  vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startDelay + duration)
  osc.connect(vol)
  vol.connect(c.destination)
  osc.start(c.currentTime + startDelay)
  osc.stop(c.currentTime + startDelay + duration)
}

export function setSfxEnabled(on: boolean) { _enabled = on }
export function isSfxEnabled() { return _enabled }

export function playClick() {
  tone(600, 0.04, 'square', 0.08)
}

export function playBuy() {
  tone(523, 0.07, 'sine', 0.14)
  tone(659, 0.1,  'sine', 0.12, 0.07)
}

export function playSell() {
  tone(659, 0.07, 'sine', 0.14)
  tone(784, 0.1,  'sine', 0.12, 0.07)
}

export function playHit() {
  tone(120, 0.12, 'sawtooth', 0.2)
  tone(80,  0.08, 'square',   0.1, 0.04)
}

export function playCrit() {
  tone(1200, 0.04, 'square', 0.14)
  tone(900,  0.08, 'sine',   0.1,  0.04)
}

export function playHeal() {
  tone(440, 0.08, 'sine', 0.12)
  tone(523, 0.12, 'sine', 0.1,  0.06)
}

export function playAlert() {
  tone(880, 0.06, 'square', 0.15)
  tone(880, 0.06, 'square', 0.12, 0.12)
}

export function playNexus() {
  tone(523, 0.1,  'sine', 0.14)
  tone(659, 0.1,  'sine', 0.14, 0.1)
  tone(784, 0.15, 'sine', 0.18, 0.2)
  tone(1046,0.2,  'sine', 0.2,  0.32)
}

export function playVictory() {
  tone(523, 0.15, 'sine', 0.16)
  tone(659, 0.15, 'sine', 0.16, 0.15)
  tone(784, 0.15, 'sine', 0.18, 0.3)
  tone(1046,0.3,  'sine', 0.2,  0.45)
}

export function playDeath() {
  tone(200, 0.2,  'sawtooth', 0.16)
  tone(140, 0.25, 'sawtooth', 0.14, 0.18)
  tone(80,  0.4,  'sawtooth', 0.12, 0.38)
}

export function playFlee() {
  tone(400, 0.06, 'square', 0.1)
  tone(300, 0.08, 'square', 0.08, 0.06)
  tone(200, 0.1,  'square', 0.06, 0.12)
}

export function playCraft() {
  tone(440, 0.06, 'sine', 0.1)
  tone(554, 0.1,  'sine', 0.14, 0.06)
}

export function playEquip() {
  tone(330, 0.06, 'sine', 0.1)
  tone(440, 0.08, 'sine', 0.14, 0.06)
}

export function playNavigate() {
  tone(350, 0.05, 'sine', 0.08)
  tone(500, 0.06, 'sine', 0.06, 0.04)
}

export function playMenuOpen() {
  tone(440, 0.04, 'sine', 0.06)
  tone(660, 0.06, 'sine', 0.08, 0.03)
}

export function playCollectClue() {
  tone(660, 0.08, 'sine', 0.12)
  tone(880, 0.08, 'sine', 0.10, 0.08)
  tone(1100, 0.12, 'sine', 0.14, 0.16)
}

export function playFinisher() {
  tone(200, 0.06, 'sawtooth', 0.18)
  tone(400, 0.08, 'sawtooth', 0.2, 0.05)
  tone(800, 0.12, 'square', 0.22, 0.1)
  tone(1200, 0.15, 'sine', 0.16, 0.18)
}

// ── Pile ou face ─────────────────────────────────────────────────────────────
/** Cliquetis de la pièce qui tourne (un par demi-tour : il ralentit avec elle). */
export function playCoinTick() {
  tone(1500, 0.025, 'square', 0.05)
}

/** Battement de cœur pendant que la pièce hésite sur la tranche. */
export function playHeartbeat() {
  tone(55, 0.12, 'sine', 0.35)
  tone(48, 0.14, 'sine', 0.28, 0.16)
}

export function playCoinWin() {
  tone(523, 0.1, 'triangle', 0.16)
  tone(659, 0.1, 'triangle', 0.16, 0.08)
  tone(784, 0.1, 'triangle', 0.16, 0.16)
  tone(1047, 0.35, 'triangle', 0.18, 0.24)
}

export function playCoinLose() {
  tone(110, 0.35, 'sawtooth', 0.2)
  tone(73, 0.6, 'sine', 0.3, 0.05)
}

// ── Voyage ───────────────────────────────────────────────────────────────────
/** Ronronnement de croisière, puis montée en fréquence au moment du saut. */
export function playWarp(cruiseMs: number, boostMs: number) {
  const c = ctx()
  if (!c) return
  const t0 = c.currentTime
  const cruise = cruiseMs / 1000
  const boost = boostMs / 1000
  const osc = c.createOscillator()
  const vol = c.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(70, t0)
  osc.frequency.setValueAtTime(70, t0 + cruise)
  osc.frequency.exponentialRampToValueAtTime(900, t0 + cruise + boost)
  vol.gain.setValueAtTime(0.0001, t0)
  vol.gain.exponentialRampToValueAtTime(0.05, t0 + 0.3)
  vol.gain.setValueAtTime(0.05, t0 + cruise)
  vol.gain.exponentialRampToValueAtTime(0.12, t0 + cruise + boost * 0.8)
  vol.gain.exponentialRampToValueAtTime(0.0001, t0 + cruise + boost + 0.35)
  osc.connect(vol)
  vol.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + cruise + boost + 0.4)
}
