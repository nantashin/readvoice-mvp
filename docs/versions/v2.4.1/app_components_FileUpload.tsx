"use client"
import { useRef, useState, useEffect } from "react"
import { useSpeechSynthesis } from "@/lib/speech/tts"
import { validateFile, ACCEPT } from "@/lib/file/validator"
import { compressImage } from "@/lib/file/compressor"
import { createPreview, cleanupPreview, type PreviewType } from "@/lib/file/preview"
import { analyzeFile, MODELS, type VisionModel } from "@/lib/vision/analyzer"

const ALL_MODELS = [
  {
    id: "gemma4:e2b",
    label: "1. 구글 2G (gemma4 E2B) — 빠른 분석 (5~20초)",
    tts: "구글 투지. 빠른 분석에 적합하며 약 5초에서 20초 걸립니다."
  },
  {
    id: "gemma4:e4b",
    label: "2. 구글 4G (gemma4 E4B) — 균형 (20~40초)",
    tts: "구글 포지. 빠르고 정확한 분석을 제공하며 약 20초에서 40초 걸립니다."
  },
  {
    id: "llama3.2-vision:11b-instruct-q4_K_M",
    label: "3. 라마비전 (Llama Vision) — 상세 묘사 (2~3분)",
    tts: "라마비전. 배경과 분위기까지 가장 상세하게 묘사하며 약 2분에서 3분 걸립니다."
  },
  {
    id: "qwen3.5:9b",
    label: "4. Q3 (OCR Q3) — 텍스트/문서 최적 (1~2분)",
    tts: "큐쓰리. 텍스트와 문서 인식에 최적화되어 있으며 약 1분에서 2분 걸립니다."
  },
  {
    id: "glm-ocr",
    label: "5. 지엘엠 (GLM-OCR) — 문서 전용 (30~60초)",
    tts: "지엘엠. 문서 텍스트 추출에 최적화되어 있으며 약 30초에서 1분 걸립니다."
  }
]

const MODEL_MENU_TTS = `모델을 선택하세요.
일번. 구글 투지. 가장 빠릅니다.
이번. 구글 포지. 빠르고 정확합니다.
삼번. 라마비전. 가장 상세합니다.
사번. 큐쓰리. 텍스트 전용입니다.
오번. 지엘엠. 문서 전용입니다.`

interface FileUploadProps {
  onResult: (text: string, original?: string) => void
  onStatusChange: (status: "idle" | "processing" | "speaking") => void
  selectedModel: string
  onModelChange: (modelId: string) => void
  onFileSelected: (file: File) => void
}

export default function FileUpload({ onResult, onStatusChange, selectedModel, onModelChange, onFileSelected }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recognitionRef = useRef<any>(null)
  const modelSelectionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [previewType, setPreviewType] = useState<PreviewType>("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [ocrMode, setOcrMode] = useState<"ocr" | "describe">("describe")
  const tts = useSpeechSynthesis()

  // startAnalysis 이벤트 수신
  useEffect(() => {
    const handleStartAnalysis = (event: CustomEvent) => {
      const { file, model } = event.detail
      if (file) {
        processFile(file, model)
      }
    }

    window.addEventListener("startAnalysis", handleStartAnalysis as EventListener)
    return () => window.removeEventListener("startAnalysis", handleStartAnalysis as EventListener)
  }, [ocrMode])

  const processFile = async (file: File, modelId: string) => {
    setLoading(true)
    onStatusChange("processing")

    try {
      const result = await analyzeFile(file, modelId as VisionModel, ocrMode)

      if (result.error) {
        setError(result.error)
        onResult(`오류: ${result.error}`)
        onStatusChange("speaking")
        return
      }

      // 분석 완료 - 한국어 번역과 영문 원본을 함께 전달
      onResult(result.text, result.original)
      onStatusChange("speaking")
    } catch {
      const msg = "네트워크 오류가 발생했습니다. 다시 시도해주세요."
      setError(msg)
      onResult(`오류: ${msg}`)
      onStatusChange("speaking")
    } finally {
      setLoading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
      setFileName("")
    }
  }

  const handleFile = async (file: File) => {
    setError("")
    setFileName(file.name)

    // 파일 검증
    const validation = validateFile(file)
    if (!validation.isValid) {
      setError(validation.errorMessage ?? "파일 처리 실패")
      tts.speak(validation.errorMessage ?? "파일 처리 실패")
      return
    }

    // 미리보기 설정
    const preview = createPreview(file, validation.isPDF, validation.isImage)
    setPreviewUrl(preview.url)
    setPreviewType(preview.type)
    setUploadedFile(file)

    // 부모로 파일 전달 (page.tsx에서 처리)
    onFileSelected(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
      // 파일 선택 후 포커스 해제
      e.target.blur()
      document.body.focus()
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 스페이스바는 page.tsx에서 마이크 제어용으로 사용
    if (e.code === "Space") {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  const startCamera = async () => {
    try {
      tts.speak("카메라 촬영 모드입니다. 문서나 사진을 화면 하단 오른쪽 촬영 영역에 놓아주세요. 자동으로 인식합니다.")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
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
          cameraStream.getTracks().forEach((track) => track.stop())
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

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    setCameraMode(false)
  }

  // 컴포넌트 언마운트 시 카메라 종료
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
      if (previewUrl) {
        cleanupPreview(previewUrl)
      }
      if (modelSelectionTimerRef.current) {
        clearTimeout(modelSelectionTimerRef.current)
      }
    }
  }, [cameraStream, previewUrl])

  // 카메라 모드 5초 후 자동 촬영
  useEffect(() => {
    if (!cameraMode) return
    const timer = setTimeout(captureFromCamera, 5000)
    return () => clearTimeout(timer)
  }, [cameraMode])

  // 모델 변경 시 자동 재분석
  useEffect(() => {
    if (uploadedFile && !loading && selectedModel) {
      processFile(uploadedFile, selectedModel)
    }
  }, [selectedModel])

  // 모드 변경 시 자동 재분석
  useEffect(() => {
    if (uploadedFile && !loading && previewType === "image") {
      processFile(uploadedFile, selectedModel)
    }
  }, [ocrMode])

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
          분석 모델 선택:
        </label>
        <select
          id="vision-model"
          value={selectedModel}
          onChange={(e) => {
            const model = e.target.value
            onModelChange(model)
            const found = ALL_MODELS.find((m) => m.id === model)
            if (found) tts.speak(found.tts)
          }}
          aria-label="분석에 사용할 모델"
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "2px solid #0284C7",
            background: "white",
            color: "#1E3A5F",
            fontSize: "0.95rem",
            fontWeight: 500,
            cursor: "pointer",
            opacity: 1,
          }}
        >
          {ALL_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
        <p style={{ color: "#64748B", fontSize: "0.75rem", marginTop: "0.25rem" }}>
          {ALL_MODELS.find((m) => m.id === selectedModel)?.tts}
        </p>
      </div>

      {/* 이미지 모드 토글 (이미지 파일일 때만 표시) */}
      {previewType === "image" && (
        <div style={{ marginBottom: "1rem" }}>
          <p
            style={{
              color: "#0D9488",
              fontWeight: 700,
              fontSize: "0.9rem",
              marginBottom: "0.5rem",
              textAlign: "center",
            }}
          >
            처리 모드:
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => {
                setOcrMode("ocr")
                tts.speak("텍스트 읽기 모드로 변경되었습니다.")
              }}
              onKeyDown={(e) => {
                if (e.code === "Space") {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
              disabled={loading}
              aria-label="텍스트 읽기 모드"
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: ocrMode === "ocr" ? "2px solid #0284C7" : "2px solid #E5E7EB",
                background: ocrMode === "ocr" ? "#0284C7" : "white",
                color: ocrMode === "ocr" ? "white" : "#1E3A5F",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                transition: "all 0.2s",
              }}
            >
              📖 텍스트 읽기
            </button>
            <button
              onClick={() => {
                setOcrMode("describe")
                tts.speak("이미지 설명 모드로 변경되었습니다.")
              }}
              onKeyDown={(e) => {
                if (e.code === "Space") {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
              disabled={loading}
              aria-label="이미지 설명 모드"
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: ocrMode === "describe" ? "2px solid #0284C7" : "2px solid #E5E7EB",
                background: ocrMode === "describe" ? "#0284C7" : "white",
                color: ocrMode === "describe" ? "white" : "#1E3A5F",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                transition: "all 0.2s",
              }}
            >
              🖼️ 이미지 설명
            </button>
          </div>
          <p
            style={{
              color: "#64748B",
              fontSize: "0.75rem",
              marginTop: "0.5rem",
              textAlign: "center",
            }}
          >
            {ocrMode === "ocr"
              ? "문서나 이미지의 텍스트를 그대로 추출합니다"
              : "이미지의 내용을 상세히 설명합니다"}
          </p>
        </div>
      )}

      {/* 기본 폴더 경로 안내 */}
      <p style={{ color: "#0D9488", fontSize: "0.85rem", marginBottom: "1rem", textAlign: "center" }}>
        📁 ReadVoice_Upload
      </p>

      {/* 파일 업로드 영역 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="파일 업로드 영역. 이미지나 PDF를 드래그하거나 클릭해서 선택하세요."
        onClick={(e) => {
          tts.speak("파일 선택 창이 열립니다. 기본 폴더는 리드보이스 업로드 폴더입니다. 이미지 또는 PDF 파일을 선택해 주세요.")
          inputRef.current?.click()
          // 클릭 후 버튼에서 포커스 제거
          setTimeout(() => {
            (document.activeElement as HTMLElement)?.blur()
            document.body.focus()
          }, 100)
        }}
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
          onKeyDown={(e) => {
            if (e.code === "Space") {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
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

      {/* 분석 시작 버튼 */}
      {uploadedFile && !loading && (
        <button
          onClick={() => {
            tts.speak("분석을 시작합니다.")
            processFile(uploadedFile, selectedModel)
          }}
          onKeyDown={(e) => {
            if (e.code === "Space") {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
          aria-label="분석 시작"
          style={{
            width: "100%",
            marginTop: "1rem",
            padding: "1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#0284C7",
            color: "white",
            fontSize: "1.125rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: "0 4px 16px rgba(2,132,199,0.3)",
          }}
        >
          🚀 분석 시작
        </button>
      )}

      {/* 카메라 촬영 버튼 */}
      <button
        onClick={startCamera}
        onKeyDown={(e) => {
          if (e.code === "Space") {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
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
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: "#f0f0f0",
            borderRadius: "1rem",
            textAlign: "center",
          }}
        >
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
