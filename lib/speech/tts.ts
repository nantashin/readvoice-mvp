"use client"
import { useState, useCallback, useEffect, useRef } from "react"

function cleanForTTS(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^\d+\.\s*/gm, "")
    .replace(/^>\s*/gm, "")
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
      voiceRef.current = voices.find(v => v.lang.includes("ko")) || voices[0] || null
    }
    loadVoice()
    window.speechSynthesis.onvoiceschanged = loadVoice
  }, [])

  const speak = useCallback((text: string, rate = 1.0) => {
    if (!text || typeof window === "undefined") return
    window.speechSynthesis.cancel()
    const cleaned = cleanForTTS(text)
    const utt = new SpeechSynthesisUtterance(cleaned)
    utt.lang = "ko-KR"
    utt.rate = rate
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
