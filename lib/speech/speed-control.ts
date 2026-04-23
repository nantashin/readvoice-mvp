export type SpeedCommand = {
  rate: number
  message: string
} | null

export function parseSpeedCommand(
  text: string,
  isWaitingSpeedChoice: boolean
): SpeedCommand {
  const lowerText = text.toLowerCase().trim()

  // 속도 선택 대기 상태에서 번호 또는 숫자 단어로 파싱
  if (isWaitingSpeedChoice) {
    if (lowerText.includes("일번") || lowerText.includes("1번") || lowerText.includes("하나")) {
      return { rate: 1.0, message: "보통 속도로 설정했습니다." }
    }
    if (lowerText.includes("이번") || lowerText.includes("2번") || lowerText.includes("둘") || lowerText.includes("조금")) {
      return { rate: 1.2, message: "조금 빠르게 설정했습니다." }
    }
    if (lowerText.includes("삼번") || lowerText.includes("3번") || lowerText.includes("셋") || lowerText.includes("빠르게")) {
      return { rate: 1.5, message: "빠르게 설정했습니다." }
    }
    if (lowerText.includes("사번") || lowerText.includes("4번") || lowerText.includes("넷") || lowerText.includes("매우")) {
      return { rate: 2.0, message: "매우 빠르게 설정했습니다." }
    }
    return null
  }

  // 속도 선택 대기 상태가 아닐 때 직접 속도 명령 감지
  if (lowerText.includes("속도 조절") || lowerText.includes("속도") || lowerText.includes("빠르기")) {
    return { rate: -1, message: "speed_menu" }
  }

  return null
}

export function saveSpeechRate(rate: number): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("speechRate", rate.toString())
  }
}

export function loadSpeechRate(): number {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("speechRate")
    if (saved) {
      return parseFloat(saved)
    }
  }
  return 1.0
}
