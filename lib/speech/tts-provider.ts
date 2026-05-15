"use client"
import { useSpeechSynthesis } from "./tts"
import { useEdgeTTS } from "./edge-tts"

export function useTTS() {
  const provider = process.env.NEXT_PUBLIC_TTS_PROVIDER || 'web'
  console.log('[TTS Provider] ENV:', process.env.NEXT_PUBLIC_TTS_PROVIDER)
  console.log('[TTS Provider] Selected:', provider)
  if (provider === 'edge') {
    return useEdgeTTS()
  }
  return useSpeechSynthesis()
}
