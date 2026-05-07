// Web Audio API로 효과음 생성 (파일 없이 코드로 생성)

/**
 * 마이크 ON 효과음 - 띠링~ 상승음
 */
export function playMicOn(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // 띠링~ 상승음 (마이크 ON)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)

    osc1.frequency.setValueAtTime(600, ctx.currentTime)
    osc1.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.12)
    gain1.gain.setValueAtTime(0.3, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)

    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.15)

    setTimeout(() => ctx.close(), 300)
  } catch(e) {
    console.log("[효과음] MicOn 재생 실패:", e)
  }
}

/**
 * 마이크 OFF 효과음 - 띵동~ 하강음
 */
export function playMicOff(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // 띵동~ 하강음 (마이크 OFF)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.frequency.setValueAtTime(900, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)

    setTimeout(() => ctx.close(), 400)
  } catch(e) {
    console.log("[효과음] MicOff 재생 실패:", e)
  }
}
