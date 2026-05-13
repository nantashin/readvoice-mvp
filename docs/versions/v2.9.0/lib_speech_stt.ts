"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { playMicOff } from "@/lib/audio/mic-sound"

interface STTState {
  transcript: string
  isListening: boolean
  error: string | null
}

export function useSpeechRecognition() {
  const [state, setState] = useState<STTState>({ transcript: "", isListening: false, error: null })
  const recogRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setState(s => ({ ...s, error: "이 브라우저는 음성 인식을 지원하지 않습니다." })); return }
    const r = new SR()
    r.lang = "ko-KR"
    r.continuous = true  // 계속 듣기 모드
    r.interimResults = true  // 중간 결과도 받기

    // 침묵 감지 타이머
    let silenceTimer: NodeJS.Timeout | null = null
    let maxTimer: NodeJS.Timeout | null = null
    let hasSpoken = false
    const MAX_DURATION = 30000  // 최대 30초
    const SILENCE_THRESHOLD = 3000  // 3초 침묵 감지

    r.onstart = () => {
      hasSpoken = false
      // 최대 시간 타이머
      maxTimer = setTimeout(() => {
        r.stop()
        setState(s => ({ ...s, isListening: false }))
        playMicOff()
      }, MAX_DURATION)
    }

    r.onresult = (e: SpeechRecognitionEvent) => {
      hasSpoken = true
      const t = Array.from(e.results).map(r => r[0].transcript).join("")
      setState(s => ({ ...s, transcript: t }))

      // 침묵 타이머 리셋
      if (silenceTimer) clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        // 3초 침묵 → 자동 종료
        r.stop()
        if (maxTimer) clearTimeout(maxTimer)
        setState(s => ({ ...s, isListening: false }))
        playMicOff()
      }, SILENCE_THRESHOLD)
    }

    r.onend = () => {
      if (maxTimer) clearTimeout(maxTimer)
      if (silenceTimer) clearTimeout(silenceTimer)
      setState(s => ({ ...s, isListening: false }))
    }

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (maxTimer) clearTimeout(maxTimer)
      if (silenceTimer) clearTimeout(silenceTimer)
      setState(s => ({ ...s, error: e.error, isListening: false }))
    }

    recogRef.current = r
  }, [])

  const startListening = useCallback(() => {
    if (!recogRef.current) return

    // 이미 듣고 있으면 중지 후 재시작
    if (state.isListening) {
      try { recogRef.current.stop() } catch(e) { console.log("[STT] stop 오류:", e) }
      setTimeout(() => {
        try {
          setState(s => ({ ...s, transcript: "", isListening: true, error: null }))
          recogRef.current?.start()
        } catch(e) { console.log("[STT] restart 오류:", e) }
      }, 300)
      return
    }

    try {
      setState(s => ({ ...s, transcript: "", isListening: true, error: null }))
      recogRef.current.start()
    } catch(e) {
      console.log("[STT] start 오류:", e)
    }
  }, [state.isListening])

  const stopListening = useCallback(() => {
    recogRef.current?.stop()
    setState(s => ({ ...s, isListening: false }))
  }, [])

  return { ...state, startListening, stopListening }
}
