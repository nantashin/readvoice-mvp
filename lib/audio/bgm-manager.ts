export class BGMManager {
  private audio: HTMLAudioElement | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private announcementRate: number = 1.0

  private playlist = [
    "/sounds/One-step-for-a-better-me.mp3",
    "/sounds/Summer Melodies.mp3",
    "/sounds/Summer Serenade.mp3",
    "/sounds/Summer Serenade (1).mp3",
    "/sounds/tomorrow-step.mp3"
  ]
  private currentIndex = 0

  start(modelName: string, estimatedTime: string, rate: number = 1.0) {
    this.announcementRate = rate
    this.stop()

    this.speak(`${modelName}으로 분석합니다. 약 ${estimatedTime} 걸립니다.`)

    setTimeout(() => {
      this.playBGM()
    }, 2000)

    this.intervalId = setInterval(() => {
      this.announceProgress()
    }, 30000)
  }

  private playBGM() {
    this.audio = new Audio(this.playlist[this.currentIndex])
    this.audio.volume = 0.35
    this.audio.play().catch(e => console.log("[BGM] 재생 실패:", e))

    this.audio.onended = () => {
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length
      this.playBGM()
    }
  }

  private announceProgress() {
    if (this.audio) this.audio.volume = 0.1
    this.speak("아직 분석 중입니다. 잠시 기다려 주세요.")
    setTimeout(() => {
      if (this.audio) this.audio.volume = 0.35
    }, 3000)
  }

  private speak(text: string) {
    if (typeof window === "undefined") return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = "ko-KR"
    utt.rate = this.announcementRate
    window.speechSynthesis.speak(utt)
  }

  stop() {
    if (this.audio) {
      const fade = setInterval(() => {
        if (this.audio && this.audio.volume > 0.05) {
          this.audio.volume -= 0.05
        } else {
          this.audio?.pause()
          this.audio = null
          clearInterval(fade)
        }
      }, 50)
    }
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  addTrack(path: string) {
    this.playlist.push(path)
  }
}

export const bgmManager = new BGMManager()
