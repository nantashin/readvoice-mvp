"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useSpeechRecognition } from "@/lib/speech/stt"
import { useSpeechSynthesis } from "@/lib/speech/tts"

function cleanDisplay(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[\s]*[-*+]\s+/gm, "  • ")
    .replace(/[-–—]{3,}/g, "")
    .replace(/^>\s*/gm, "")
    .trim()
}

type Status = "idle" | "listening" | "processing" | "speaking"

export default function Home() {
  const [status, setStatus]     = useState<Status>("idle")
  const [response, setResponse] = useState("")
  const [history, setHistory]   = useState<{role:string;content:string}[]>([])
  const statusRef               = useRef<Status>("idle")

  const stt = useSpeechRecognition()
  const tts = useSpeechSynthesis()

  useEffect(() => { statusRef.current = status }, [status])

  const statusLabel: Record<Status, string> = {
    idle:       "마이크 버튼을 눌러 말씀하세요",
    listening:  "듣는 중...",
    processing: "처리 중...",
    speaking:   "읽는 중...",
  }

  const startListening = useCallback(() => {
    if (statusRef.current !== "idle") return
    stt.startListening()
    setStatus("listening")
  }, [stt])

  const stopListening = useCallback(() => {
    stt.stopListening()
    setStatus("idle")
  }, [stt])

  const handleMic = useCallback(() => {
    if (statusRef.current === "idle")      { startListening(); return }
    if (statusRef.current === "listening") { stopListening();  return }
    if (statusRef.current === "speaking")  { tts.stop(); setStatus("idle") }
  }, [startListening, stopListening, tts])

  useEffect(() => {
    if (!stt.isListening && stt.transcript && statusRef.current === "listening") {
      sendMessage(stt.transcript)
    }
  }, [stt.isListening, stt.transcript])

  const sendMessage = async (text: string) => {
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
      const dec    = new TextDecoder()
      let full = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value)
        setResponse(full)
      }
      setHistory(h => [...h, { role:"user", content:text }, { role:"assistant", content:full }])
      setStatus("speaking")
      tts.speak(full)
    } catch {
      const err = "오류가 발생했습니다. 다시 시도해 주세요."
      setResponse(err)
      tts.speak(err)
      setStatus("speaking")
    }
  }

  useEffect(() => {
    if (!tts.isSpeaking && statusRef.current === "speaking") setStatus("idle")
  }, [tts.isSpeaking])

  // 스페이스바 — statusRef로 항상 최신 상태 참조
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.target !== document.body) return
      e.preventDefault()
      handleMic()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleMic])

  return (
    <main style={{ minHeight:"100vh", background:"#EBF5FF", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem", fontFamily:"Pretendard Variable, sans-serif" }}>
      <h1 style={{ fontSize:"2rem", fontWeight:900, color:"#0284C7", marginBottom:"0.5rem" }}>READ VOICE Pro</h1>
      <p style={{ color:"#475569", marginBottom:"2.5rem", fontSize:"1rem" }}>시각장애인을 위한 AI 음성 도우미</p>

      <button
        onClick={handleMic}
        aria-label={status === "listening" ? "마이크 중지" : "마이크 버튼, 눌러서 말하기"}
        style={{
          width:"120px", height:"120px", borderRadius:"50%",
          background: status === "listening" ? "#EF4444" : "#0284C7",
          border:"none", cursor:"pointer", fontSize:"3rem",
          boxShadow:"0 8px 32px rgba(2,132,199,0.35)",
          transition:"all 0.2s",
        }}
      >
        {status === "listening" ? "⏹" : "🎙"}
      </button>

      <p aria-live="polite" style={{ marginTop:"1.5rem", color:"#0369A1", fontWeight:600, fontSize:"1.1rem" }}>
        {statusLabel[status]}
      </p>

      {stt.transcript && (
        <div style={{ marginTop:"1rem", background:"#DBEAFE", borderRadius:"0.75rem", padding:"1rem", maxWidth:"600px", width:"100%" }}>
          <p style={{ color:"#1E3A5F", fontSize:"0.9rem" }}>인식: {stt.transcript}</p>
        </div>
      )}

      {response && (
        <div aria-live="polite" style={{ marginTop:"1rem", background:"white", borderRadius:"1rem", padding:"1.5rem", maxWidth:"600px", width:"100%", boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
          <p style={{ color:"#1E3A5F", fontSize:"1.05rem", lineHeight:1.9, whiteSpace:"pre-wrap" }}>{cleanDisplay(response)}</p>
          {status === "speaking" && (
            <button
              onClick={() => { tts.stop(); setStatus("idle") }}
              aria-label="읽기 중지"
              style={{ marginTop:"1rem", background:"#0D9488", color:"white", border:"none", borderRadius:"0.5rem", padding:"0.5rem 1rem", cursor:"pointer", fontSize:"0.9rem" }}
            >
              ⏹ 읽기 중지
            </button>
          )}
        </div>
      )}

      {stt.error && <p style={{ color:"#EF4444", marginTop:"1rem" }}>{stt.error}</p>}

      <p style={{ marginTop:"3rem", color:"#94A3B8", fontSize:"0.8rem" }}>Space 키로도 마이크를 켜고 끌 수 있습니다</p>
    </main>
  )
}


