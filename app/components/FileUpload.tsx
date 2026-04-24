"use client"
import { useRef, useState, useEffect } from "react"
import { useSpeechSynthesis } from "@/lib/speech/tts"
import { useSpeechRecognition } from "@/lib/speech/stt"
import { validateFile, ACCEPT } from "@/lib/file/validator"
import { compressImage } from "@/lib/file/compressor"
import { createPreview, cleanupPreview, type PreviewType } from "@/lib/file/preview"
import { analyzeFile, MODELS, type VisionModel } from "@/lib/vision/analyzer"
import { bgmManager } from "@/lib/audio/bgm-manager"

interface FileUploadProps {
  onResult: (text: string) => void
  onStatusChange: (status: "idle" | "processing" | "speaking") => void
}

const PDF_MODELS: Array<{ id: VisionModel; label: string; tts: string }> = [
  {
    id: "glm-ocr",
    label: "📄 GLM-OCR — 텍스트 추출 최적 (30~60초)",
    tts: "GLM-OCR 모델입니다. 텍스트 추출에 최적화되어 있으며 약 30초에서 60초 걸립니다.",
  },
  {
    id: "qwen2.5vl:7b",
    label: "💎 OCR Q — 문서 분석 (2~3분)",
    tts: "OCR 큐 모델입니다. 문서 분석에 적합하며 약 2분에서 3분 걸립니다.",
  },
  {
    id: "llama3.2-vision:11b-instruct-q4_K_M",
    label: "🦙 Llama Vision — 정밀 분석 (2~3분)",
    tts: "라마 비전 모델입니다. 정밀한 분석을 제공하며 약 2분에서 3분 걸립니다.",
  },
]

export default function FileUpload({ onResult, onStatusChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<VisionModel>("moondream")
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [previewType, setPreviewType] = useState<PreviewType>("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [waitingForModeChoice, setWaitingForModeChoice] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const tts = useSpeechSynthesis()
  const stt = useSpeechRecognition()

  // 파일명으로 OCR 모드 자동 판단
  const shouldUseOCR = (fileName: string): boolean => {
    const lowerName = fileName.toLowerCase()

    // 문서 키워드
    const docKeywords = ["통지서", "증명서", "신청서", "등록증", "test_page"]
    if (docKeywords.some(keyword => lowerName.includes(keyword))) {
      return true
    }

    // 숫자가 많은 파일명 (숫자가 전체의 30% 이상)
    const digitCount = (fileName.match(/\d/g) || []).length
    if (digitCount / fileName.length > 0.3) {
      return true
    }

    return false
  }

  const handleFile = async (file: File, model?: VisionModel) => {
    setError("")
    setFileName(file.name)

    // 파일 검증
    const validation = validateFile(file)
    if (!validation.isValid) {
      setError(validation.errorMessage ?? "파일 처리 실패")
      tts.speak(validation.errorMessage ?? "파일 처리 실패")
      return
    }

    let currentModel = model || selectedModel

    // 파일 선택 시에만 미리보기 설정 (model 파라미터가 없을 때)
    if (!model) {
      const preview = createPreview(file, validation.isPDF, validation.isImage)
      setPreviewUrl(preview.url)
      setPreviewType(preview.type)

      // PDF이면 GLM-OCR 자동 설정
      if (validation.isPDF) {
        setUploadedFile(file)
        setSelectedModel("glm-ocr")
        tts.speak("PDF 파일이 선택되었습니다. 텍스트를 추출합니다.")
        return
      }

      // 이미지이면 파일명 패턴 체크
      if (validation.isImage) {
        // OCR 자동 판단
        if (shouldUseOCR(file.name)) {
          tts.speak("문서 이미지로 인식했습니다. 텍스트를 읽어드립니다.")
          // OCR 모드로 처리하려면 API에 mode 파라미터 전달 필요
          // 하지만 현재는 이미지는 항상 Vision으로 처리됨
          // 일단 그냥 진행
        } else {
          // 모드 선택 질문
          tts.speak(
            "이미지 설명을 들으시겠어요, 아니면 텍스트를 읽어드릴까요? " +
            "일번. 이미지 설명. 이번. 텍스트 읽기."
          )
          setWaitingForModeChoice(true)
          setPendingFile(file)
          stt.startListening()

          // 3초 타임아웃
          setTimeout(() => {
            if (waitingForModeChoice) {
              setWaitingForModeChoice(false)
              stt.stopListening()
              tts.speak("이미지 설명 모드로 진행합니다.")
              // 기본값으로 진행
            }
          }, 3000)
          return
        }
      }

      tts.speak("파일이 선택되었습니다. 분석을 시작합니다.")
    }

    setLoading(true)
    onStatusChange("processing")
    setUploadedFile(file)

    // 모델별 예상 시간 정보
    const modelTimeInfo: Record<string, string> = {
      moondream: "약 5초에서 15초",
      "gemma3:4b": "약 10초에서 20초",
      "qwen2.5vl:7b": "약 20초에서 40초",
      "llama3.2-vision:11b-instruct-q4_K_M": "약 1분에서 3분",
      "glm-ocr": "약 30초에서 60초",
    }

    // 분석 시작 안내 및 BGM 시작
    const timeInfo = modelTimeInfo[currentModel] || "잠시"
    bgmManager.start(currentModel, timeInfo)

    try {
      const result = await analyzeFile(file, currentModel)

      // BGM 정리
      bgmManager.stop()

      if (result.error) {
        setError(result.error)
        tts.speak(result.error)
        onStatusChange("speaking")
        return
      }

      // 분석 완료 안내
      tts.speak("분석이 완료되었습니다. 읽어드리겠습니다.")
      onResult(result.text)
      onStatusChange("speaking")
      tts.speak(result.text)
    } catch {
      // BGM 정리
      bgmManager.stop()

      const msg = "네트워크 오류가 발생했습니다. 다시 시도해주세요."
      setError(msg)
      tts.speak(msg)
      onStatusChange("speaking")
    } finally {
      setLoading(false)
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

  // 컴포넌트 언마운트 시 카메라 및 BGM 종료
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
      bgmManager.stop()
      if (previewUrl) {
        cleanupPreview(previewUrl)
      }
    }
  }, [cameraStream, previewUrl])

  // 카메라 모드 5초 후 자동 촬영
  useEffect(() => {
    if (!cameraMode) return
    const timer = setTimeout(captureFromCamera, 5000)
    return () => clearTimeout(timer)
  }, [cameraMode])

  // STT 응답 감지 (모드 선택)
  useEffect(() => {
    if (!waitingForModeChoice || !stt.transcript || stt.isListening) return

    const text = stt.transcript.toLowerCase()

    if (text.includes("일번") || text.includes("1번") || text.includes("설명")) {
      setWaitingForModeChoice(false)
      stt.stopListening()
      tts.speak("이미지 설명 모드로 진행합니다.")
      if (pendingFile) {
        handleFile(pendingFile) // describe 모드 (기본값)
        setPendingFile(null)
      }
    } else if (text.includes("이번") || text.includes("2번") || text.includes("텍스트") || text.includes("읽기")) {
      setWaitingForModeChoice(false)
      stt.stopListening()
      tts.speak("텍스트 읽기 모드로 진행합니다.")
      if (pendingFile) {
        // OCR 모드로 처리 - 하지만 현재 API는 이미지를 항상 Vision으로 처리
        // 일단 그냥 진행 (추후 API 수정 필요)
        handleFile(pendingFile)
        setPendingFile(null)
      }
    }
  }, [stt.transcript, stt.isListening, waitingForModeChoice])

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
          {previewType === "pdf" ? "PDF 분석 모델 선택:" : "이미지 분석 모델 선택:"}
        </label>
        <select
          id="vision-model"
          value={selectedModel}
          onChange={(e) => {
            const modelId = e.target.value as VisionModel
            setSelectedModel(modelId)

            if (previewType === "pdf") {
              const model = PDF_MODELS.find((m) => m.id === modelId)
              if (model) {
                tts.speak(`${model.id} 모델로 변경되었습니다. ${model.tts}`)
              }
            } else {
              const model = MODELS.find((m) => m.id === modelId)
              if (model) {
                tts.speak(`${model.id} 모델로 변경되었습니다. ${model.tts}`)
              }
            }
          }}
          disabled={loading}
          aria-label={
            previewType === "pdf"
              ? "PDF 분석에 사용할 모델을 선택하세요"
              : "이미지 분석에 사용할 모델을 선택하세요"
          }
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
          {previewType === "pdf"
            ? PDF_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))
            : MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
        </select>
        <p style={{ color: "#64748B", fontSize: "0.75rem", marginTop: "0.25rem" }}>
          {previewType === "pdf"
            ? PDF_MODELS.find((m) => m.id === selectedModel)?.tts
            : MODELS.find((m) => m.id === selectedModel)?.tts}
        </p>
      </div>

      {/* 기본 폴더 경로 안내 */}
      <p style={{ color: "#0D9488", fontSize: "0.85rem", marginBottom: "1rem", textAlign: "center" }}>
        📁 ReadVoice_Upload
      </p>

      {/* PDF 지원 모델 안내 */}
      {previewType === "pdf" && (
        <p
          style={{
            color: "#0284C7",
            fontSize: "0.85rem",
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          📄 PDF는 OCR Q / Llama Vision 모델만 지원됩니다
        </p>
      )}

      {/* 파일 업로드 영역 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="파일 업로드 영역. 이미지나 PDF를 드래그하거나 클릭해서 선택하세요."
        onClick={() => {
          tts.speak("파일 선택 창이 열립니다. 기본 폴더는 리드보이스 업로드 폴더입니다. 이미지 또는 PDF 파일을 선택해 주세요.")
          inputRef.current?.click()
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
