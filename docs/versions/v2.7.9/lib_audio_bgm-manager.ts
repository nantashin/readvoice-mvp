export class BGMManager {
  private audio: HTMLAudioElement | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private announcementRate: number = 1.0
  private firstAnnouncementTimer: ReturnType<typeof setTimeout> | null = null
  private pendingPlay: boolean = false
  private savedTime: number = 0
  private normalVolume: number = 0.4

  private playlist = [
    "/sounds/One-step-for-a-better-me.mp3",
    "/sounds/Summer Melodies.mp3",
    "/sounds/Summer Serenade.mp3",
    "/sounds/Summer Serenade (1).mp3",
    "/sounds/tomorrow-step.mp3"
  ]
  private currentIndex = 0

  start(rate: number = 1.0) {
    console.log("[BGM] start() 호출됨")
    console.log("[BGM] playlist:", this.playlist)
    console.log("[BGM] currentIndex:", this.currentIndex)

    this.announcementRate = rate
    this.stop()

    // BGM 즉시 시작 시도
    this.playBGM()

    // 브라우저 autoplay 정책 우회: 첫 클릭 시 재생
    if (typeof document !== "undefined") {
      document.addEventListener("click", () => {
        if (this.pendingPlay) {
          this.playBGM()
          this.pendingPlay = false
        }
      }, { once: true })
    }

    // 첫 번째 안내는 30초 후
    this.firstAnnouncementTimer = setTimeout(() => {
      this.announceProgress()
      // 이후 30초 간격으로 반복
      this.intervalId = setInterval(() => {
        this.announceProgress()
      }, 30000)
    }, 30000)
  }

  private playBGM() {
    const src = this.playlist[this.currentIndex]
    console.log("[BGM] 재생 시도:", src)

    this.audio = new Audio(src)
    this.audio.volume = this.normalVolume
    this.audio.play()
      .then(() => {
        console.log("[BGM] 재생 성공")
        this.pendingPlay = false
      })
      .catch(e => {
        console.error("[BGM] 재생 실패:", e)
        this.pendingPlay = true
      })

    this.audio.onended = () => {
      console.log("[BGM] 트랙 종료, 다음 트랙으로")
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length
      this.playBGM()
    }
  }

  private announceProgress() {
    if (this.audio) this.audio.volume = 0.1
    this.speak("아직 분석 중이에요. 조금만 더 기다려 주세요.")
    setTimeout(() => {
      if (this.audio) this.audio.volume = this.normalVolume
    }, 3000)
  }

  private speak(text: string) {
    if (typeof window === "undefined") return
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = "ko-KR"
    utt.rate = this.announcementRate
    utt.pitch = 1.5  // 솔 높이 (밝고 경쾌한 음성)
    window.speechSynthesis.speak(utt)
  }

  stop() {
    console.log("[BGM] stop() 호출됨")

    if (this.firstAnnouncementTimer) {
      clearTimeout(this.firstAnnouncementTimer)
      this.firstAnnouncementTimer = null
    }
    if (this.audio) {
      const fade = setInterval(() => {
        if (this.audio && this.audio.volume > 0.05) {
          this.audio.volume -= 0.05
        } else {
          this.audio?.pause()
          this.audio = null
          this.savedTime = 0
          clearInterval(fade)
          console.log("[BGM] 페이드아웃 완료")
        }
      }, 50)
    }
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  duck() {
    if (!this.audio) return
    console.log("[BGM] duck() - 볼륨 줄이기 시작")
    const startVolume = this.audio.volume
    const targetVolume = 0.08
    const duration = 300 // 0.3초
    const steps = 15
    const stepTime = duration / steps
    const volumeStep = (startVolume - targetVolume) / steps
    let currentStep = 0

    const fadeInterval = setInterval(() => {
      if (!this.audio) {
        clearInterval(fadeInterval)
        return
      }
      currentStep++
      const newVolume = startVolume - (volumeStep * currentStep)
      this.audio.volume = Math.max(targetVolume, newVolume)

      if (currentStep >= steps) {
        this.audio.volume = targetVolume
        clearInterval(fadeInterval)
        console.log("[BGM] duck() 완료 - 볼륨:", targetVolume)
      }
    }, stepTime)
  }

  unduck() {
    if (!this.audio) return
    console.log("[BGM] unduck() - 볼륨 키우기 시작")
    const startVolume = this.audio.volume
    const targetVolume = this.normalVolume
    const duration = 500 // 0.5초
    const steps = 20
    const stepTime = duration / steps
    const volumeStep = (targetVolume - startVolume) / steps
    let currentStep = 0

    const fadeInterval = setInterval(() => {
      if (!this.audio) {
        clearInterval(fadeInterval)
        return
      }
      currentStep++
      const newVolume = startVolume + (volumeStep * currentStep)
      this.audio.volume = Math.min(targetVolume, newVolume)

      if (currentStep >= steps) {
        this.audio.volume = targetVolume
        clearInterval(fadeInterval)
        console.log("[BGM] unduck() 완료 - 볼륨:", targetVolume)
      }
    }, stepTime)
  }

  pause() {
    if (!this.audio) return
    console.log("[BGM] pause() 호출")
    this.savedTime = this.audio.currentTime
    this.audio.pause()
    console.log("[BGM] pause() 완료 - 저장된 시간:", this.savedTime)
  }

  resume() {
    if (!this.audio) return
    console.log("[BGM] resume() 호출 - 복원 시간:", this.savedTime)
    this.audio.currentTime = this.savedTime
    this.audio.play()
      .then(() => console.log("[BGM] resume() 재생 성공"))
      .catch(e => console.error("[BGM] resume() 재생 실패:", e))
  }

  addTrack(path: string) {
    this.playlist.push(path)
  }
}

export const bgmManager = new BGMManager()
