"use client"
import { useState, useCallback, useRef } from "react"
import { createHash } from "crypto"
import { bgmManager } from "@/lib/audio/bgm-manager"
import { cleanForTTS } from "./tts"

// 숫자/수식 읽기 함수 (tts.ts에서 가져오기)
function numberToKorean(text: string): string {
  const toOrdinal = (n: string): string => {
    const ordinals: Record<string, string> = {
      '1': '일', '2': '이', '3': '삼', '4': '사', '5': '오',
      '6': '육', '7': '칠', '8': '팔', '9': '구', '10': '십',
      '11': '십일', '12': '십이', '13': '십삼', '14': '십사', '15': '십오',
      '16': '십육', '17': '십칠', '18': '십팔', '19': '십구', '20': '이십'
    }
    return ordinals[n] || n
  }

  return text
    .replace(/(\d+)번/g, (_, n) => toOrdinal(n) + '번')
    .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g, '$1년 $2월 $3일')
    .replace(/(\d{1,2}):(\d{2})/g, '$1시 $2분')
    .replace(/(\d{3,4})-(\d{3,4})/g, '$1에 $2')
    .replace(/(\d+(?:\.\d+)?)%/g, '$1퍼센트')
}

async function checkCacheExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

export function useEdgeTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ttsVoice') || 'sun-hi'
    }
    return 'sun-hi'
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const speak = useCallback(async (
    text: string,
    rate: number = 1.0,
    onEnd?: () => void
  ) => {
    try {
      // 1. 전처리
      const cleaned = numberToKorean(cleanForTTS(text))

      // 2. 캐시 확인
      const hash = createHash('md5').update(cleaned).digest('hex').slice(0, 8)
      const cacheUrl = `/tts-cache/${selectedVoice}_${hash}.mp3`

      let audioUrl = cacheUrl
      let useCache = await checkCacheExists(cacheUrl)

      // 캐시 미스 → 스트리밍 생성
      if (!useCache) {
        console.log('[Edge TTS] 캐시 미스, 생성 중...')
        const res = await fetch('/api/tts/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleaned,
            voice: selectedVoice,
            rate: rate * 0.95
          })
        })

        if (!res.ok) {
          throw new Error('TTS generation failed')
        }

        const blob = await res.blob()
        audioUrl = URL.createObjectURL(blob)
      } else {
        console.log('[Edge TTS] 캐시 히트')
      }

      // 3. Audio 재생
      bgmManager.duck()
      audioRef.current = new Audio(audioUrl)
      audioRef.current.playbackRate = rate

      audioRef.current.onended = () => {
        bgmManager.unduck()
        setIsSpeaking(false)
        if (onEnd) onEnd()

        // Blob URL 해제
        if (!useCache && audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(audioUrl)
        }
      }

      audioRef.current.onerror = (e) => {
        console.error('[Edge TTS] 재생 에러:', e)
        bgmManager.unduck()
        setIsSpeaking(false)

        // 폴백: Web Speech API
        fallbackToWebSpeech(text, rate, onEnd)
      }

      await audioRef.current.play()
      setIsSpeaking(true)

    } catch (e) {
      console.error('[Edge TTS] 실패, Web Speech API 폴백:', e)
      bgmManager.unduck()
      setIsSpeaking(false)

      // Web Speech API 폴백
      fallbackToWebSpeech(text, rate, onEnd)
    }
  }, [selectedVoice])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    bgmManager.unduck()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking, selectedVoice, setSelectedVoice }
}

// Web Speech API 폴백
function fallbackToWebSpeech(text: string, rate: number, onEnd?: () => void) {
  console.log('[TTS] Web Speech API 폴백')

  const cleaned = numberToKorean(cleanForTTS(text))
  const utt = new SpeechSynthesisUtterance(cleaned)
  utt.lang = 'ko-KR'
  utt.rate = rate
  utt.pitch = 1.0  // 폴백 시 기본 pitch
  utt.onend = () => {
    bgmManager.unduck()
    if (onEnd) onEnd()
  }

  bgmManager.duck()
  window.speechSynthesis.speak(utt)
}
