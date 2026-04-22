"use client"
import { useRef, useState, useEffect } from "react"
import { useSpeechSynthesis } from "@/lib/speech/tts"

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf"

interface FileUploadProps {
  onResult: (text: string) => void
  onStatusChange: (status: "idle" | "processing" | "speaking") => void
}

type VisionModel = "moondream" | "llava:7b-v1.5-q4_K_M" | "llama3.2-vision:11b-instruct-q4_K_M" | "claude"

export default function FileUpload({ onResult, onStatusChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<VisionModel>("moondream")
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [previewType, setPreviewType] = useState<"image" | "pdf" | "">("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedBuffer, setUploadedBuffer] = useState<Buffer | null>(null)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const tts = useSpeechSynthesis()

  const handleFile = async (file: File, model?: VisionModel) => {
    setError("")
    setFileName(file.name)

    // 파일 선택 시에만 미리보기 설정 (model 파라미터가 없을 때)
    if (!model) {
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file))
        setPreviewType("image")
      } else if (file.type === "application/pdf") {
        setPreviewUrl("")
        setPreviewType("pdf")
      }
    }

    setLoading(true)
    onStatusChange("processing")

    // 파일 저장
    setUploadedFile(file)
    const buffer = await file.arrayBuffer()
    setUploadedBuffer(Buffer.from(buffer))

    const formData = new FormData()
    formData.append("file", file)
    formData.append("model", model || selectedModel)

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        const msg = data.error ?? "파일 처리 중 오류가 발생했습니다."
        setError(msg)
        tts.speak(msg)
        onStatusChange("speaking")
        return
      }

      onResult(data.text)
      onStatusChange("speaking")
      tts.speak(data.text)
    } catch {
      const msg = "네트워크 오류가 발생했습니다. 다시 시도해주세요."
      setError(msg)
      tts.speak(msg)
      onStatusChange("speaking")
    } finally {
      setLoading(false)
      // 파일 재업로드를 위해 input value 초기화
      if (inputRef.current) {
        inputRef.current.value = ""
      }
      setFileName("")
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  const startCamera = async () => {
    try {
      tts.speak("카메라 촬영 모드입니다. 문서나 사진을 화면 하단 오른쪽 촬영 영역에 놓아주세요. 자동으로 인식합니다.")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraMode(true)
    } catch (e) {
      const msg = "카메라 접근이 거부되었습니다."
      setError(msg)
      tts.speak(msg)
      console.error("[카메라]", e)
    }
  }

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current) return
    try {
      const context = canvasRef.current.getContext("2d")
      if (!context) return

      canvasRef.current.width = videoRef.current.videoWidth
      canvasRef.current.height = videoRef.current.videoHeight
      context.drawImage(videoRef.current, 0, 0)

      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" })

        // 카메라 종료
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop())
          setCameraStream(null)
        }
        setCameraMode(false)

        // 파일 처리
        await handleFile(file)
      }, "image/jpeg")
    } catch (e) {
      console.error("[캡처 오류]", e)
      tts.speak("캡처 중 오류가 발생했습니다.")
    }
  }

  // 카메라 모드 종료
  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setCameraMode(false)
  }

  // 컴포넌트 언마운트 시 카메라 종료
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraStream])

  // 카메라 모드 5초 후 자동 촬영
  useEffect(() => {
    if (!cameraMode) return
    const timer = setTimeout(captureFromCamera, 5000)
    return () => clearTimeout(timer)
  }, [cameraMode])

  // 모델 변경 시 자동 재분석
  useEffect(() => {
    if (uploadedFile && !loading) {
      handleFile(uploadedFile, selectedModel)
    }
  }, [selectedModel])

  return (
    <div style={{ width: "100%", maxWidth: "600px" }}>
      {/* 모델 선택 드롭다운 */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="vision-model"
          style={{
            display: "block",
            color: "#0D9488",
            fontWeight: 700,
            fontSize: "0.9rem",
            marginBottom: "0.5rem",
          }}
        >
          이미지 분석 모델 선택:
        </label>
        <select
          id="vision-model"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as VisionModel)}
          disabled={loading}
          aria-label="이미지 분석에 사용할 모델을 선택하세요"
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "2px solid #0284C7",
            background: loading ? "#f5f5f5" : "white",
            color: "#1E3A5F",
            fontSize: "0.95rem",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <option value="moondream">🌙 Moondream (빠름)</option>
          <option value="llava:7b-v1.5-q4_K_M">🌋 LLaVA 7B Q4 (균형)</option>
          <option value="llama3.2-vision:11b-instruct-q4_K_M">🦙 Llama Vision Q4 (고품질)</option>
          <option value="claude">☁️ Claude API (클라우드)</option>
        </select>
        <p style={{ color: "#64748B", fontSize: "0.75rem", marginTop: "0.25rem" }}>
          {selectedModel === "moondream"
            ? "로컬 실행, 가장 빠름"
            : selectedModel === "llava:7b-v1.5-q4_K_M"
              ? "로컬 실행, 빠르고 정확함"
              : selectedModel === "llama3.2-vision:11b-instruct-q4_K_M"
                ? "로컬 실행, 높은 정확도"
                : "클라우드 API, 완벽한 분석 (인터넷 필요)"}
        </p>
      </div>

      {/* 파일 업로드 영역 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="파일 업로드 영역. 이미지나 PDF를 드래그하거나 클릭해서 선택하세요."
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
        style={{
          border: "2px dashed #0284C7",
          borderRadius: "1rem",
          padding: "2rem 1.5rem",
          textAlign: "center",
          cursor: "pointer",
          background: loading ? "#DBEAFE" : "#EBF5FF",
          transition: "background 0.2s",
          outline: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
        onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #0284C780")}
        onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          disabled={loading}
          aria-hidden="true"
          style={{ display: "none" }}
        />

        {previewType === "image" && previewUrl && (
          <img
            src={previewUrl}
            alt="업로드된 이미지"
            style={{
              maxHeight: "200px",
              maxWidth: "100%",
              borderRadius: "8px",
              marginBottom: "8px",
              objectFit: "contain",
            }}
          />
        )}

        {previewType === "pdf" && (
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>📄</div>
        )}

        <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          {loading ? "⏳" : "📄"}
        </p>
        <p style={{ color: "#0284C7", fontWeight: 700, fontSize: "1rem" }}>
          {loading
            ? "텍스트 추출 중..."
            : fileName
              ? `선택됨: ${fileName}`
              : "이미지 또는 PDF 업로드"}
        </p>
        <p style={{ color: "#475569", fontSize: "0.85rem", marginTop: "0.35rem" }}>
          JPG · PNG · WEBP · PDF / 최대 10MB
        </p>
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          style={{ color: "#EF4444", marginTop: "0.75rem", fontSize: "0.9rem", textAlign: "center" }}
        >
          {error}
        </p>
      )}

      {/* 카메라 촬영 버튼 */}
      <button
        onClick={startCamera}
        disabled={loading || cameraMode}
        aria-label="카메라로 촬영"
        style={{
          width: "100%",
          marginTop: "1rem",
          padding: "0.75rem",
          borderRadius: "0.5rem",
          border: "2px solid #0D9488",
          background: loading || cameraMode ? "#f5f5f5" : "white",
          color: "#0D9488",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: loading || cameraMode ? "not-allowed" : "pointer",
          opacity: loading || cameraMode ? 0.6 : 1,
        }}
      >
        📷 카메라로 촬영
      </button>

      {/* 카메라 모드 */}
      {cameraMode && (
        <div style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#f0f0f0",
          borderRadius: "1rem",
          textAlign: "center",
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: "100%",
              maxHeight: "300px",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
              background: "#000",
            }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={captureFromCamera}
              aria-label="촬영"
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#0D9488",
                color: "white",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📸 촬영
            </button>
            <button
              onClick={closeCamera}
              aria-label="취소"
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "2px solid #0D9488",
                background: "white",
                color: "#0D9488",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ 취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
