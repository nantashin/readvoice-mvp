export class BGMManager {
  private audio: HTMLAudioElement | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private announcementRate: number = 1.0
  private firstAnnouncementTimer: ReturnType<typeof setTimeout> | null = null

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

    // BGM 즉시 시작
    this.playBGM()

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
    this.audio.volume = 0.4
    this.audio.play()
      .then(() => console.log("[BGM] 재생 성공"))
      .catch(e => console.error("[BGM] 재생 실패:", e))

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
      if (this.audio) this.audio.volume = 0.4
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

  addTrack(path: string) {
    this.playlist.push(path)
  }
}

export const bgmManager = new BGMManager()
