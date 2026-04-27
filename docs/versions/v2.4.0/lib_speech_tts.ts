"use client"
import { useState, useCallback, useEffect, useRef } from "react"

function cleanForTTS(text: string): string {
  return text
    // 마크다운 제거
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^\d+\.\s*/gm, "")
    .replace(/^>\s*/gm, "")

    // 이모지 제거
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")

    // 괄호와 그 안의 내용 제거 (선택사항)
    // .replace(/\([^)]*\)/g, " ")
    // .replace(/\[[^\]]*\]/g, " ")
    // .replace(/\{[^}]*\}/g, " ")

    // 특수 기호 제거 (문장 부호는 유지)
    .replace(/[~`!@#$%^&*_+=|\\<>]/g, " ")
    .replace(/["'«»""'']/g, " ")
    .replace(/[(){}\[\]]/g, " ")

    // 문장 정리
    .replace(/[-–—]{2,}/g, "")
    .replace(/-\s/g, " ")
    .replace(/-$/gm, "")
    .replace(/\n+/g, ". ")
    .replace(/\.\s*\.\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      // 한국어 여성 음성 우선 선택
      const koreanFemale = voices.find(v =>
        v.lang.includes("ko") &&
        (v.name.includes("Female") || v.name.includes("여성") || v.name.includes("Yuna") || v.name.includes("Heami"))
      )
      const koreanAny = voices.find(v => v.lang.includes("ko"))
      voiceRef.current = koreanFemale || koreanAny || voices[0] || null

      if (voiceRef.current) {
        console.log("[TTS] 선택된 음성:", voiceRef.current.name)
      }
    }
    loadVoice()
    window.speechSynthesis.onvoiceschanged = loadVoice
  }, [])

  const speak = useCallback((text: string, rate = 1.0, pitch = 1.5) => {
    if (!text || typeof window === "undefined") return
    window.speechSynthesis.cancel()
    const cleaned = cleanForTTS(text)
    const utt = new SpeechSynthesisUtterance(cleaned)
    utt.lang = "ko-KR"
    utt.rate = rate
    utt.pitch = pitch  // 솔 높이 (밝고 경쾌한 음성)
    if (voiceRef.current) utt.voice = voiceRef.current
    utt.onstart = () => setIsSpeaking(true)
    utt.onend   = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utt)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking }
}
