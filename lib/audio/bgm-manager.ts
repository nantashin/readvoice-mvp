class BGMManager {
  private audio: HTMLAudioElement | null = null
  private playlist = [
    "/sounds/One-step-for-a-better-me.mp3",
    "/sounds/Summer Melodies.mp3",
    "/sounds/Summer Serenade.mp3",
    "/sounds/Summer Serenade (1).mp3",
    "/sounds/tomorrow-step.mp3"
  ]
  private currentIndex = 0
  private isInitialized = false
  private isDucked = false
  private normalVolume = 0.4
  private duckVolume = 0.08
  private announcementRate = 1.0
  private announcementEnabled = true

  /**
   * 최초 1회만 초기화 (이후 일시정지/재개)
   */
  private init(): void {
    if (this.isInitialized) return
    this.isInitialized = true

    console.log("[BGM] 초기화 시작")
    this.audio = new Audio(this.playlist[this.currentIndex])
    this.audio.volume = this.normalVolume

    // 곡 종료 시 다음 곡으로 자동 이동
    this.audio.onended = () => {
      console.log("[BGM] 곡 종료, 다음 곡으로 이동")
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length
      if (this.audio) {
        this.audio.src = this.playlist[this.currentIndex]
        this.audio.play().catch(() => {})
      }
    }

    console.log("[BGM] 초기화 완료")
  }

  /**
   * start: 처음이면 재생 시작, 이미 있으면 resume
   */
  start(rate: number = 1.0): void {
    this.announcementRate = rate
    this.init()

    if (!this.audio) return

    if (this.audio.paused) {
      console.log("[BGM] 재생 시작/재개")
      this.audio.play().catch(() => {
        // autoplay 정책으로 실패 시 첫 클릭 대기
        document.addEventListener('click', () => {
          this.audio?.play().catch(() => {})
        }, { once: true })
      })
    }

    this.audio.volume = this.normalVolume
  }

  /**
   * pause: 위치 유지하며 일시정지
   */
  pause(): void {
    if (this.audio && !this.audio.paused) {
      console.log("[BGM] 일시정지")
      this.audio.pause()
    }
  }

  /**
   * stop: 완전 정지 (앱 종료 시에만 사용)
   */
  stop(): void {
    console.log("[BGM] 완전 정지")
    this.pause()
  }

  /**
   * duck: TTS 중 볼륨 낮추기 (덕킹)
   */
  duck(): void {
    if (this.audio) {
      console.log("[BGM] 덕킹 - 볼륨 낮춤")
      this.isDucked = true
      this.audio.volume = this.duckVolume
    }
  }

  /**
   * unduck: TTS 끝나면 볼륨 복구
   */
  unduck(): void {
    if (this.audio) {
      console.log("[BGM] 언덕킹 - 볼륨 복구")
      this.isDucked = false
      this.audio.volume = this.normalVolume

      // BGM이 멈춰있었으면 재개
      if (this.audio.paused) {
        console.log("[BGM] 멈춰있던 BGM 재개")
        this.audio.play().catch(() => {})
      }
    }
  }

  /**
   * 재생 중인지 확인
   */
  isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused
  }

  /**
   * 안내 멘트 활성화/비활성화
   */
  setAnnouncement(enabled: boolean): void {
    this.announcementEnabled = enabled
    console.log(`[BGM] 안내 멘트 ${enabled ? '활성화' : '비활성화'}`)
  }

  /**
   * 분석 중 안내 멘트 재생 (announcementEnabled가 true일 때만)
   */
  announceProgress(): void {
    if (!this.announcementEnabled) return
    // 기존 코드 유지 (현재는 없음, 나중에 구현 예정)
  }
}

export const bgmManager = new BGMManager()
