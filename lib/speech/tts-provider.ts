"use client"
import { useSpeechSynthesis } from "./tts"
import { useEdgeTTS } from "./edge-tts"

export function useTTS() {
  const provider = process.env.NEXT_PUBLIC_TTS_PROVIDER || 'web'
  if (provider === 'edge') {
    return useEdgeTTS()
  }
  return useSpeechSynthesis()
}
