"use client"
import { useState, useCallback, useEffect, useRef } from "react"

/**
 * 큰 숫자 자릿수 포맷팅
 * 1000 → 천, 10000 → 만, 100000000 → 억
 */
function formatLargeNumber(numStr: string): string {
  const num = parseInt(numStr, 10)
  if (isNaN(num)) return numStr

  if (num >= 1000000000000) {
    return `${Math.floor(num / 1000000000000)}조`
  } else if (num >= 100000000) {
    return `${Math.floor(num / 100000000)}억`
  } else if (num >= 10000) {
    return `${Math.floor(num / 10000)}만`
  } else if (num >= 1000) {
    return `${Math.floor(num / 1000)}천`
  }
  return numStr
}

/**
 * depth별 항목 번호 생성
 */
function getItemNumber(depth: number, index: number): string {
  // 1단계: 1, 2, 3, 4
  if (depth === 1) return `${index + 1}`

  // 2단계: 가, 나, 다, 라
  if (depth === 2) {
    const chars = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하']
    return chars[index % chars.length]
  }

  // 3단계: A, B, C, D
  if (depth === 3) {
    return String.fromCharCode(65 + (index % 26))
  }

  // 4단계: 기역, 니은, 디귿, 리을
  const consonants = ['기역', '니은', '디귿', '리을', '미음', '비읍', '시옷', '이응', '지읒', '치읓', '키읔', '티읕', '피읖', '히읗']
  return consonants[index % consonants.length]
}

/**
 * 마크다운 기호 제거 함수
 * 시각장애인을 위한 TTS 최적화
 * (외부에서도 사용 가능하도록 export)
 */
export function cleanForTTS(text: string): string {
  // 1. 날짜/시간/전화번호 패턴을 임시 토큰으로 보호
  const protectedValues: string[] = []

  let processed = text
    // 날짜 (2024.01.24, 2024-01-24)
    .replace(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/g, (match) => {
      const token = `__PROTECTED_${protectedValues.length}__`
      protectedValues.push(match)
      return token
    })

    // 시간 (14:30, 14:30:45)
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, (match) => {
      const token = `__PROTECTED_${protectedValues.length}__`
      protectedValues.push(match)
      return token
    })

    // 전화번호 (1544-8080, 010-1234-5678)
    .replace(/\d{3,4}-\d{3,4}(-\d{4})?/g, (match) => {
      const token = `__PROTECTED_${protectedValues.length}__`
      protectedValues.push(match)
      return token
    })

  // 2. 마크다운 기본 처리
  processed = processed
    // 제목 기호 (#, ##, ###) → 제거
    .replace(/^#{1,6}\s+/gm, '')

    // 굵게 처리 (** → 기호만 제거, 텍스트 유지)
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')

    // 밑줄 처리 (__ ___ → 완전 제거)
    .replace(/___(.+?)___/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')

    // 긴 줄 (--- → 완전 제거)
    .replace(/^[-=]{3,}$/gm, '')

    // 코드블록 (``` ```) → "코드" 로 대체
    .replace(/```[\s\S]*?```/g, '코드 내용 생략.')
    .replace(/`(.+?)`/g, '$1')

    // 링크 [텍스트](url) → 텍스트만
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')

    // 이미지 ![alt](url) → alt 텍스트만
    .replace(/!\[(.+?)\]\(.+?\)/g, '$1')

    // 인용 (>) → 제거
    .replace(/^>\s*/gm, '')

    // 체크박스 완전 제거
    .replace(/\[x\]/gi, '')
    .replace(/\[\s*\]/g, '')

    // HTML 태그 제거
    .replace(/<[^>]+>/g, '')

    // URL → 링크
    .replace(/https?:\/\/[^\s]+/g, '링크')

    // 이메일 → 이메일 주소
    .replace(/[\w.-]+@[\w.-]+\.[a-z]+/gi, '이메일 주소')

    // 영어 약자
    .replace(/\bAPI\b/g, '에이피아이')
    .replace(/\bURL\b/g, '유알엘')
    .replace(/\bAI\b/g, '에이아이')
    .replace(/\bOCR\b/g, '오씨알')
    .replace(/\bTTS\b/g, '티티에스')
    .replace(/\bSTT\b/g, '에스티티')
    .replace(/\bUI\b/g, '유아이')
    .replace(/\bUX\b/g, '유엑스')
    .replace(/\bPDF\b/g, '피디에프')
    .replace(/\bPNG\b/g, '피엔지')
    .replace(/\bJPG\b/g, '제이피지')

  // 3. 가운뎃점 처리 (· → 쉼표)
  processed = processed.replace(/·/g, ', ')

  // 4. 화살표 및 항목 번호 처리 (줄 단위)
  const lines = processed.split('\n')
  const depthCounters: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  let lastDepth = 0

  const processedLines = lines.map((line) => {
    // 들여쓰기 깊이 계산 (앞 공백 수)
    const leadingSpaces = line.match(/^[ \t]*/)?.[0].length || 0
    let depth = 1
    if (leadingSpaces >= 6) depth = 4
    else if (leadingSpaces >= 4) depth = 3
    else if (leadingSpaces >= 2) depth = 2
    else depth = 1

    // depth가 바뀌면 카운터 초기화
    if (depth !== lastDepth) {
      if (depth > lastDepth) {
        // 더 깊어지면 새 카운터 시작
        depthCounters[depth] = 0
      } else {
        // 얕아지면 하위 카운터 리셋
        for (let d = depth + 1; d <= 4; d++) {
          depthCounters[d] = 0
        }
      }
    }
    lastDepth = depth

    // 불릿 기호 패턴 확인
    const bulletMatch = line.match(/^[\s]*([-•●◆◇■□★☆✅✔✓☑※])\s*(.+)/)
    if (bulletMatch) {
      const content = bulletMatch[2]
      const itemNum = getItemNumber(depth, depthCounters[depth])
      depthCounters[depth]++
      return `${itemNum}. ${content}`
    }

    // 화살표 패턴 확인
    const arrowMatch = line.match(/^[\s]*([→➡▶⇒⟶])\s*(.+)/)
    if (arrowMatch) {
      const content = arrowMatch[2]

      // 문장 맨 앞에 단독으로 있으면 "즉,"
      if (line.trim().startsWith('→') || line.trim().startsWith('➡') || line.trim().startsWith('▶')) {
        return `즉, ${content}`
      }

      // 연속된 경우 세부항목 번호
      depthCounters[depth]++
      return `세부항목 ${depthCounters[depth]}. ${content}`
    }

    // 일반 줄은 그대로 반환
    return line
  })

  processed = processedLines.join('\n')

  // 5. 특수 불릿/화살표 기호 제거 (남은 것들)
  processed = processed
    .replace(/[•●◆◇■□▶▷★☆✅✔✓☑※]/g, '')
    .replace(/[→➡⇒⟶]/g, '')

  // 6. 큰 숫자 자릿수 변환 (보호된 패턴 제외)
  processed = processed.replace(/(\d{4,})/g, (n) => formatLargeNumber(n))

  // 7. 임시 토큰을 다시 원래 값으로 복원
  protectedValues.forEach((value, index) => {
    const token = `__PROTECTED_${index}__`
    processed = processed.replace(new RegExp(token, 'g'), value)
  })

  // 8. 특수기호 정리 및 마무리
  processed = processed
    .replace(/[|]{2,}/g, '')       // 표 구분선
    .replace(/\|/g, ', ')          // 표 셀 구분
    .replace(/[~]{2}/g, '')        // 취소선 ~~텍스트~~
    .replace(/\n{3,}/g, '\n\n')    // 연속 줄바꿈 정리
    .replace(/[ \t]{2,}/g, ' ')    // 연속 공백 정리
    .trim()

  return processed
}

/**
 * 서수 변환 함수 (1 → 일, 2 → 이)
 */
function toOrdinal(n: string): string {
  const ordinals: Record<string, string> = {
    '1': '일', '2': '이', '3': '삼', '4': '사', '5': '오',
    '6': '육', '7': '칠', '8': '팔', '9': '구', '10': '십',
    '11': '십일', '12': '십이', '13': '십삼', '14': '십사', '15': '십오',
    '16': '십육', '17': '십칠', '18': '십팔', '19': '십구', '20': '이십'
  }
  return ordinals[n] || n
}

/**
 * 숫자/수식 읽기 함수
 * 자연스러운 한국어로 변환
 */
function numberToKorean(text: string): string {
  return text
    // 서수 (1번, 2번 → 일번, 이번)
    .replace(/(\d+)번/g, (_, n) => toOrdinal(n) + '번')

    // 날짜 (2024.01.24 → 2024년 1월 24일)
    .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g, '$1년 $2월 $3일')

    // 시간 (14:30 → 14시 30분)
    .replace(/(\d{1,2}):(\d{2})/g, '$1시 $2분')

    // 전화번호 (1544-8080 → 1544에 8080)
    .replace(/(\d{3,4})-(\d{3,4})/g, '$1에 $2')

    // 퍼센트 (38% → 38퍼센트)
    .replace(/(\d+(?:\.\d+)?)%/g, '$1퍼센트')

    // 수식: 덧셈 (1+2 → 1 더하기 2)
    .replace(/(\d+)\s*\+\s*(\d+)/g, '$1 더하기 $2')

    // 수식: 뺄셈 (5-3 → 5 빼기 3)
    .replace(/(\d+)\s*-\s*(\d+)/g, '$1 빼기 $2')

    // 수식: 곱셈 (3×4, 3*4 → 3 곱하기 4)
    .replace(/(\d+)\s*[×\*]\s*(\d+)/g, '$1 곱하기 $2')

    // 수식: 나눗셈 (8÷4, 8/4 → 8 나누기 4)
    .replace(/(\d+)\s*[÷\/]\s*(\d+)/g, '$1 나누기 $2')

    // 수식: 등호 (= → 은, 이므로)
    .replace(/(\d+)\s*=\s*(\d+)/g, '$1은 $2')

    // 거듭제곱 (2^3 → 2의 3제곱)
    .replace(/(\d+)\^(\d+)/g, '$1의 $2제곱')

    // 분수 (1/2 → 2분의 1) - 수식 나눗셈과 충돌하지 않게 조정
    .replace(/(\d+)\/(\d+)(?!\d)/g, '$2분의 $1')

    // 소수점 (3.14 → 3점14) - 날짜와 충돌하지 않게 조정
    .replace(/(?<!\d{4})(\d+)\.(\d+)(?!\d{1,2}\.)/g, '$1점$2')

    // 음수 (-5 → 마이너스 5)
    .replace(/(?<!\d)-(\d+)/g, '마이너스 $1')

    // 단위
    .replace(/(\d+)kg/gi, '$1킬로그램')
    .replace(/(\d+)km/gi, '$1킬로미터')
    .replace(/(\d+)cm/gi, '$1센티미터')
    .replace(/(\d+)mm/gi, '$1밀리미터')
    .replace(/(\d+)m(?![\w])/gi, '$1미터')
    .replace(/(\d+)GB/gi, '$1기가바이트')
    .replace(/(\d+)MB/gi, '$1메가바이트')
    .replace(/(\d+)KB/gi, '$1킬로바이트')
}

/**
 * 문장부호에 따른 멈춤 처리
 * 문장 단위로 분리해서 자연스럽게 읽기
 */
function speakWithPauses(
  text: string,
  rate: number,
  voiceRef: SpeechSynthesisVoice | null,
  onStart?: () => void,
  onEnd?: () => void
): void {
  // 전처리: 마크다운 제거 → 숫자 변환
  const cleaned = numberToKorean(cleanForTTS(text))

  // 문장 단위로 분리 (마침표/느낌표/물음표/쉼표/콜론/줄바꿈)
  const segments = cleaned
    .split(/([.!?。,，:：]\s*|\n\n)/)
    .filter(s => s.trim())

  let index = 0
  let started = false

  function speakNext() {
    if (index >= segments.length) {
      if (onEnd) onEnd()
      return
    }

    const segment = segments[index].trim()
    index++

    // 문장부호만 있는 경우 스킵
    if (!segment || /^[.!?。,，:：\n]$/.test(segment)) {
      speakNext()
      return
    }

    const utt = new SpeechSynthesisUtterance(segment)
    utt.lang = 'ko-KR'
    utt.rate = rate
    utt.pitch = 1.7  // 20대 초반 여성의 밝고 경쾌한 음성 (솔 음계)
    if (voiceRef) utt.voice = voiceRef

    // 첫 문장 시작 시 콜백 호출
    if (!started && onStart) {
      started = true
      onStart()
    }

    utt.onend = () => {
      // 다음 문자에 따라 멈춤 시간 조정
      const nextChar = segments[index]
      if (nextChar?.match(/[!！]/)) {
        setTimeout(speakNext, 400)  // 느낌표: 400ms
      } else if (nextChar?.match(/[?？]/)) {
        setTimeout(speakNext, 500)  // 물음표: 500ms
      } else if (nextChar?.match(/[,，]/)) {
        setTimeout(speakNext, 150)  // 쉼표: 150ms
      } else if (nextChar?.match(/[:：]/)) {
        setTimeout(speakNext, 200)  // 콜론: 200ms
      } else {
        setTimeout(speakNext, 300)  // 마침표: 300ms
      }
    }

    utt.onerror = (event) => {
      // 'canceled'와 'interrupted'는 정상적인 중단 (무시)
      if (event.error === 'canceled' || event.error === 'interrupted') {
        return
      }
      // 그 외 실제 오류만 로그
      console.warn('[TTS] 음성 재생 오류:', event.error)
      if (onEnd) onEnd()
    }

    window.speechSynthesis.speak(utt)
  }

  // 기존 음성 중지 후 시작
  window.speechSynthesis.cancel()
  speakNext()
}

/**
 * useSpeechSynthesis 훅
 * 시각장애인을 위한 TTS 최적화
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  // 한국어 음성 로드 (20대 초반 여성의 밝고 경쾌한 목소리 우선)
  useEffect(() => {
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices()

      // 1순위: Yuna, Heami 등 젊고 밝은 한국어 여성 음성
      const youngFemale = voices.find(v =>
        v.lang.includes("ko") &&
        (v.name.includes("Yuna") || v.name.includes("Heami") || v.name.includes("유나") || v.name.includes("해미"))
      )

      // 2순위: 일반 한국어 여성 음성
      const koreanFemale = voices.find(v =>
        v.lang.includes("ko") &&
        (v.name.includes("Female") || v.name.includes("여성"))
      )

      // 3순위: 아무 한국어 음성
      const koreanAny = voices.find(v => v.lang.includes("ko"))

      voiceRef.current = youngFemale || koreanFemale || koreanAny || voices[0] || null

      if (voiceRef.current) {
        console.log("[TTS] 선택된 음성:", voiceRef.current.name, "| pitch: 1.7 (솔 음계), rate: 1.15 (경쾌)")
      }
    }
    loadVoice()
    window.speechSynthesis.onvoiceschanged = loadVoice
  }, [])

  const speak = useCallback((text: string, rate: number = 1.15, onEnd?: () => void) => {
    if (!text || typeof window === "undefined") return

    speakWithPauses(
      text,
      rate,
      voiceRef.current,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false)
        if (onEnd) onEnd()
      }
    )
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking }
}
