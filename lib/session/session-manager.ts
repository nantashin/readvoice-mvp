/**
 * 세션 관리자 - 자동 클리닝 및 초기화
 */

const SESSION_TIMEOUT = 600000 // 10분 - 마지막 활동 후 자동 종료 (사용자가 완전히 끝날 때까지 충분한 시간)
const FEEDBACK_WINDOW = 30000 // 30초 - 분석 완료 후 피드백 받는 시간

class SessionManager {
  private sessionTimer: NodeJS.Timeout | null = null
  private feedbackTimer: NodeJS.Timeout | null = null
  private currentSessionId: string = ""
  private sessionData: {
    transcript?: string
    result?: string
    model?: string
    fileName?: string
    startTime?: number
    endTime?: number
  } = {}

  /**
   * 세션 시작
   */
  startSession(): void {
    this.currentSessionId = `session_${Date.now()}`
    this.sessionData = { startTime: Date.now() }
    console.log(`[세션] 시작: ${this.currentSessionId}`)
    this.resetTimer()
  }

  /**
   * 활동 감지 시 타이머 리셋
   */
  resetTimer(): void {
    if (this.sessionTimer) clearTimeout(this.sessionTimer)

    this.sessionTimer = setTimeout(() => {
      console.log("[세션] 타임아웃 - 자동 종료")
      this.endSession()
    }, SESSION_TIMEOUT)
  }

  /**
   * 분석 완료 - 피드백 대기
   */
  onAnalysisComplete(data: { result: string; model: string; fileName?: string }): void {
    this.sessionData = { ...this.sessionData, ...data, endTime: Date.now() }
    console.log("[세션] 분석 완료 - 피드백 대기")

    // 세션 타이머 리셋 (분석 완료 = 활동)
    this.resetTimer()

    // 피드백 타이머
    this.feedbackTimer = setTimeout(() => {
      console.log("[세션] 피드백 없음 - 자동 종료")
      this.endSession()
    }, FEEDBACK_WINDOW)
  }

  /**
   * 사용자 만족 피드백
   */
  async submitPositiveFeedback(): Promise<void> {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)

    console.log("[세션] 긍정 피드백 - 학습 데이터 저장")

    try {
      // 서버에 학습 데이터 전송
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.currentSessionId,
          feedback: "positive",
          data: this.sessionData,
          timestamp: Date.now()
        })
      })
      console.log("[세션] 학습 데이터 저장 완료")
    } catch (e) {
      console.error("[세션] 학습 데이터 저장 실패:", e)
    }

    // CustomEvent 발생
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sessionTimeout', {
        detail: { reason: 'positive_feedback' }
      }))
    }

    // 즉시 종료
    setTimeout(() => this.endSession(), 2000)
  }

  /**
   * 부정 피드백 (저장 안 함)
   */
  submitNegativeFeedback(): void {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
    console.log("[세션] 부정 피드백 - 데이터 저장 안 함")

    // CustomEvent 발생
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sessionTimeout', {
        detail: { reason: 'negative_feedback' }
      }))
    }

    setTimeout(() => this.endSession(), 2000)
  }

  /**
   * 세션 종료 및 클리닝
   */
  private endSession(): void {
    console.log("[세션] 종료 - 상태 초기화")

    // 타이머 정리
    if (this.sessionTimer) clearTimeout(this.sessionTimer)
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)

    // 세션 데이터 초기화
    this.sessionData = {}
    this.currentSessionId = ""

    // 로컬 스토리지 클리어
    this.clearLocalStorage()

    // CustomEvent 발생 (app/page.tsx에서 처리)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sessionTimeout', {
        detail: { reason: 'timeout' }
      }))
    }
  }

  /**
   * 로컬 스토리지 클리어
   */
  private clearLocalStorage(): void {
    // 음성 속도 등 사용자 설정은 유지하고, 세션 관련만 삭제
    const preserveKeys = ["speechRate"]
    const allKeys = Object.keys(localStorage)

    allKeys.forEach(key => {
      if (!preserveKeys.includes(key)) {
        localStorage.removeItem(key)
      }
    })

    console.log("[세션] 로컬 스토리지 클리어 완료")
  }


  /**
   * 강제 종료 (사용자가 "종료" 명령)
   */
  forceEnd(): void {
    console.log("[세션] 강제 종료")

    // CustomEvent 발생
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sessionTimeout', {
        detail: { reason: 'user_request' }
      }))
    }

    this.endSession()
  }
}

export const sessionManager = new SessionManager()
