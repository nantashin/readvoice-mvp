"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useSpeechRecognition } from "@/lib/speech/stt"
import { useSpeechSynthesis } from "@/lib/speech/tts"
import { parseSpeedCommand, saveSpeechRate, loadSpeechRate } from "@/lib/speech/speed-control"
import FileUpload from "@/app/components/FileUpload"
import MicButton from "@/app/components/MicButton"
import ResponseDisplay from "@/app/components/ResponseDisplay"

type Status = "idle" | "listening" | "processing" | "speaking"

export default function Home() {
  const [status, setStatus] = useState<Status>("idle")
  const [response, setResponse] = useState("")
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])
  const [speechRate, setSpeechRate] = useState<number>(1.0)
  const statusRef = useRef<Status>("idle")
  const isWaitingSpeedChoiceRef = useRef<boolean>(false)

  const stt = useSpeechRecognition()
  const tts = useSpeechSynthesis()

  // localStorage에서 저장된 음성 속도 복원
  useEffect(() => {
    setSpeechRate(loadSpeechRate())
  }, [])

  // 앱 시작 시 업로드 폴더 자동 생성
  useEffect(() => {
    fetch("/api/watch-folder").catch(() => {
      console.log("[폴더 생성] 실패")
    })
  }, [])

  // 음성 안내
  useEffect(() => {
    const tryPlay = () => {
      const utt = new SpeechSynthesisUtterance(
        "안녕하세요. READ VOICE Pro입니다. " +
          "스페이스바를 누르고 말씀하시면 됩니다. " +
          "무엇을 도와드릴까요? " +
          "일번 웹 검색, " +
          "이번 사진이나 문서 읽어들이기, " +
          "삼번 메뉴 선택하기, " +
          "사번 근처 복지관 및 지원 기관 안내, " +
          "오번 처음으로 돌아가기."
      )
      utt.lang = "ko-KR"
      utt.rate = 1.0
      window.speechSynthesis.speak(utt)
    }

    setTimeout(tryPlay, 500)
    const onFirst = () => {
      tryPlay()
      document.removeEventListener("click", onFirst)
    }
    document.addEventListener("click", onFirst)
    return () => document.removeEventListener("click", onFirst)
  }, [])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const statusLabel: Record<Status, string> = {
    idle: "마이크 버튼을 눌러 말씀하세요",
    listening: "듣는 중...",
    processing: "처리 중...",
    speaking: "읽는 중...",
  }

  const startListening = useCallback(() => {
    if (statusRef.current !== "idle") return
    tts.speak("듣고 있습니다", 1.0)
    stt.startListening()
    setStatus("listening")
  }, [stt, tts])

  const stopListening = useCallback(() => {
    stt.stopListening()
    setStatus("idle")
  }, [stt])

  const handleMic = useCallback(() => {
    if (statusRef.current === "idle") {
      startListening()
      return
    }
    if (statusRef.current === "listening") {
      stopListening()
      return
    }
    if (statusRef.current === "speaking") {
      tts.stop()
      setStatus("idle")
    }
  }, [startListening, stopListening, tts])

  const handleSpeechRateChange = useCallback((rate: number) => {
    setSpeechRate(rate)
    saveSpeechRate(rate)
  }, [])

  useEffect(() => {
    if (!stt.isListening && stt.transcript && statusRef.current === "listening") {
      sendMessage(stt.transcript)
    }
  }, [stt.isListening, stt.transcript])

  const sendMessage = async (text: string) => {
    // 속도 변경 명령 확인
    const speedCmd = parseSpeedCommand(text, isWaitingSpeedChoiceRef.current)
    if (speedCmd !== null) {
      if (speedCmd.message === "speed_menu") {
        setStatus("speaking")
        const menu =
          "읽기 속도를 선택해 주세요. 1번, 보통 속도. 2번, 조금 빠르게. 3번, 빠르게. 4번, 매우 빠르게. 번호로 말씀해 주세요."
        tts.speak(menu, 1.0)
        isWaitingSpeedChoiceRef.current = true
        return
      }

      handleSpeechRateChange(speedCmd.rate)
      setStatus("speaking")
      tts.speak(speedCmd.message, 1.0)
      isWaitingSpeedChoiceRef.current = false
      return
    }

    setStatus("processing")
    setResponse("")
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      })
      if (!res.ok) throw new Error("API error")
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let full = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value)
        setResponse(full)
      }
      setHistory((h) => [...h, { role: "user", content: text }, { role: "assistant", content: full }])
      setStatus("speaking")
      tts.speak(full, speechRate)
    } catch {
      const err = "오류가 발생했습니다. 다시 시도해 주세요."
      setResponse(err)
      tts.speak(err, speechRate)
      setStatus("speaking")
    }
  }

  useEffect(() => {
    if (!tts.isSpeaking && statusRef.current === "speaking") setStatus("idle")
  }, [tts.isSpeaking])

  // 스페이스바 제어
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space") return
      const tag = (e.target as HTMLElement).tagName
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return
      e.preventDefault()
      handleMic()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleMic])

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#EBF5FF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        fontFamily: "Pretendard Variable, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 900,
            color: "#0284C7",
            marginBottom: "0.5rem",
            textAlign: "center",
          }}
        >
          READ VOICE Pro
        </h1>

        <p
          style={{
            color: "#475569",
            marginBottom: "2.5rem",
            fontSize: "1.125rem",
            textAlign: "center",
          }}
        >
          시각장애인을 위한 AI 음성 도우미
        </p>

        <MicButton status={status} onClick={handleMic} />

        <div
          style={{
            marginTop: "1.5rem",
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {[1, 1.2, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => handleSpeechRateChange(rate)}
              aria-label={`읽기 속도 ${rate}배`}
              style={{
                minWidth: "48px",
                minHeight: "48px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "1rem",
                transition: "all 0.2s",
                background: speechRate === rate ? "#0284C7" : "#EBF5FF",
                color: speechRate === rate ? "white" : "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {rate}x
            </button>
          ))}
        </div>

        <p
          aria-live="polite"
          style={{
            marginTop: "1.5rem",
            color: "#0369A1",
            fontWeight: 600,
            fontSize: "1.125rem",
            textAlign: "center",
          }}
        >
          {statusLabel[status]}
        </p>

        {stt.transcript && (
          <div
            style={{
              marginTop: "1.5rem",
              background: "#DBEAFE",
              borderRadius: "0.75rem",
              padding: "1rem",
              width: "100%",
            }}
          >
            <p
              style={{
                color: "#1E3A5F",
                fontSize: "1rem",
                margin: 0,
              }}
            >
              인식: {stt.transcript}
            </p>
          </div>
        )}

        <ResponseDisplay
          response={response}
          status={status}
          onStop={() => {
            tts.stop()
            setStatus("idle")
          }}
        />

        {stt.error && (
          <p
            style={{
              color: "#EF4444",
              marginTop: "1rem",
              fontSize: "1rem",
            }}
          >
            {stt.error}
          </p>
        )}

        <div
          style={{
            marginTop: "2rem",
            width: "100%",
          }}
        >
          <p
            style={{
              color: "#0D9488",
              fontWeight: 700,
              fontSize: "1rem",
              marginBottom: "0.75rem",
              textAlign: "center",
            }}
          >
            📄 파일에서 텍스트 읽기 (이미지 / PDF)
          </p>
          <FileUpload onResult={(text) => setResponse(text)} onStatusChange={(s) => setStatus(s)} />
        </div>

        <p
          style={{
            marginTop: "2rem",
            color: "#94A3B8",
            fontSize: "0.95rem",
            textAlign: "center",
          }}
        >
          Space 키로도 마이크를 켜고 끌 수 있습니다
        </p>
      </div>
    </main>
  )
}
