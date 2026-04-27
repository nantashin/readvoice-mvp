"use client"
import { useState, useEffect, useRef, useCallback } from "react"

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
    r.continuous = false
    r.interimResults = true
    r.onresult = (e: SpeechRecognitionEvent) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join("")
      setState(s => ({ ...s, transcript: t }))
    }
    r.onend = () => setState(s => ({ ...s, isListening: false }))
    r.onerror = (e: SpeechRecognitionErrorEvent) => setState(s => ({ ...s, error: e.error, isListening: false }))
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
