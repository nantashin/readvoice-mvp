"use client"
import { useRef, useState, useEffect } from "react"
import { useSpeechSynthesis } from "@/lib/speech/tts"
import { validateFile, ACCEPT } from "@/lib/file/validator"
import { compressImage } from "@/lib/file/compressor"
import { createPreview, cleanupPreview, type PreviewType } from "@/lib/file/preview"
import { analyzeFile, MODELS, type VisionModel } from "@/lib/vision/analyzer"
import { bgmManager } from "@/lib/audio/bgm-manager"
import { classifyImage } from "@/modules/ocr/gemini"

// 이미지 설명용 모델 (5개) - 정확도 순: Q3 > Gemma4:4G > Llama > Gemma4:2G > GLM
export const IMAGE_MODELS = [
  {
    id: "gemma4:e4b",
    label: "구글 4G (gemma4 E4B) — 정확하고 빠름 (1분)",
    tts: "구글 사기가. 정확하고 빠릅니다. 약 1분 걸립니다."
  },
  {
    id: "qwen3.5:9b-image",
    label: "큐쓰리 (qwen3.5:9b) — 가장 정확 (2분)",
    tts: "큐쓰리. 가장 정확합니다. 약 2분 걸립니다."
  },
  {
    id: "gemma4:e2b",
    label: "구글 2G (gemma4 E2B) — 빠른 분석 (30초)",
    tts: "구글 이기가. 가장 빠릅니다. 약 30초 걸립니다."
  },
  {
    id: "llama3.2-vision:11b-instruct-q4_K_M",
    label: "라마비전 (Llama Vision) — 상세 묘사 (1분 30초)",
    tts: "라마비전. 상세합니다. 약 1분 30초 걸립니다."
  },
  {
    id: "glm-ocr-image",
    label: "지엘엠 (GLM-OCR) — 초고속 (10초)",
    tts: "지엘엠. 초고속입니다. 약 10초 걸립니다."
  }
]

// 문서 OCR용 모델 (4개)
export const DOCUMENT_MODELS = [
  {
    id: "qwen3.5:9b",
    label: "큐쓰리 (qwen3.5:9b) — 텍스트/문서 최적 (1~2분)",
    tts: "큐쓰리. 텍스트와 문서 인식에 최적화되어 있습니다. 약 1분에서 2분 걸립니다."
  },
  {
    id: "richardyoung/olmocr2:7b-q8",
    label: "올름오씨알 (olmOCR2) — 표/레이아웃 인식 (2분)",
    tts: "올름오씨알. 표와 복잡한 레이아웃 읽기에 강합니다. 약 2분 걸립니다."
  },
  {
    id: "glm-ocr",
    label: "지엘엠 (GLM-OCR) — 문서 특화 (1~2분)",
    tts: "지엘엠. 문서 읽기에 특화되어 있습니다. 약 1분에서 2분 걸립니다."
  }
]

// 모델 ID 매핑 (UI ID → 실제 모델 ID)
const MODEL_ID_MAP: Record<string, string> = {
  "qwen3.5:9b-image": "qwen3.5:9b",
  "glm-ocr-image": "glm-ocr"
}

interface FileUploadProps {
  onResult: (text: string) => void  // 다국어 지원 예정: language 파라미터 추가 가능
  onStatusChange: (status: "idle" | "processing" | "speaking") => void
  selectedModel: string
  onModelChange: (modelId: string) => void
  onFileSelected: (file: File) => void
}

export default function FileUpload({ onResult, onStatusChange, selectedModel, onModelChange, onFileSelected }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelSelectionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [previewType, setPreviewType] = useState<PreviewType>("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const tts = useSpeechSynthesis()

  // Ollama 모델 목록 자동 조회
  useEffect(() => {
    fetch("http://localhost:11434/api/tags")
      .then(r => r.json())
      .then(data => {
        const models = data.models?.map((m: any) => m.name) || []
        console.log("[모델] 설치된 모델:", models)
        setAvailableModels(models)

        // GLM-OCR 평가
        if (models.includes("glm-ocr")) {
          console.log("[모델] GLM-OCR 사용 가능")
        } else {
          console.log("[모델] GLM-OCR 미설치 - 목록에서 제외됨")
        }
      })
      .catch(() => console.log("[모델] Ollama 연결 실패"))
  }, [])

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
  }, [])

  // openFileInput 이벤트 수신 (음성 명령으로 파일 선택 창 열기)
  useEffect(() => {
    const handleOpenFileInput = () => {
      console.log("[FileUpload] openFileInput 이벤트 수신")
      if (inputRef.current) {
        inputRef.current.click()
      }
    }

    window.addEventListener("openFileInput", handleOpenFileInput)
    return () => window.removeEventListener("openFileInput", handleOpenFileInput)
  }, [])

  const processFile = async (file: File, uiModelId: string) => {
    // UI 모델 ID를 실제 모델 ID로 변환
    const actualModelId = MODEL_ID_MAP[uiModelId] || uiModelId
    console.log("[processFile] 분석 시작 - UI 모델:", uiModelId, "→ 실제 모델:", actualModelId)
    setLoading(true)
    onStatusChange("processing")

    // 모든 모델 분석 시작 시 BGM 시작 (공통)
    console.log("[processFile] BGM 시작")
    bgmManager.start()

    // BGM 덕킹 해제 (이전 TTS로 인한 덕킹 해제)
    setTimeout(() => {
      bgmManager.unduck()
      console.log("[processFile] BGM 덕킹 해제")
    }, 500)

    try {
      const result = await analyzeFile(file, actualModelId as VisionModel, "describe")

      if (result.error) {
        setError(result.error)
        onResult(`오류: ${result.error}`)
        onStatusChange("speaking")
        return
      }

      // 분석 완료 - 한국어 결과 전달
      // 다국어 지원 예정: result.language에 따라 다른 처리 가능
      onResult(result.text)
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

    // 이미지 파일
    if (validation.isImage) {
      console.log("[파일 업로드] 이미지 선택됨 - 자동 분류 시작")
      setLoading(true)
      onStatusChange("processing")
      tts.speak("파일을 확인하고 있어요. 잠깐만 기다려 주세요.")
      bgmManager.start()

      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const classification = await classifyImage(buffer, file.name)

        console.log("[자동 분류] 결과:", classification)
        bgmManager.stop()

        // 분류 결과에 따라 자동으로 가장 빠른 모델 선택 후 즉시 실행
        let autoModel = ""
        let message = ""

        if (classification === "document") {
          autoModel = "qwen3.5:9b" // 문서는 큐쓰리로 자동 시작 (문서 OCR 모델)
          message = "문서 이미지로 판단했어요. 큐쓰리 모델로 읽어드릴게요."
        } else if (classification === "photo") {
          autoModel = "gemma4:e2b" // 사진은 구글 이기가로 자동 시작 (이미지 모델)
          message = "이미지로 판단했어요. 구글 이기가 모델로 설명해 드릴게요."
        } else {
          // mixed - 기본은 문서로 처리 (문서 OCR 모델)
          autoModel = "qwen3.5:9b"
          message = "그림과 글자가 함께 있어요. 글자를 먼저 읽어드릴게요."
        }

        onStatusChange("speaking")
        tts.speak(message)

        // TTS 끝난 후 자동 분석 시작
        setTimeout(() => {
          onStatusChange("processing")
          processFile(file, autoModel)
        }, (message.length / 10) * 1000 + 500)
      } catch (e) {
        console.error("[자동 분류] 실패:", e)
        bgmManager.stop()
        const msg = "자동 판단이 어려웠어요. 이미지인지 문서인지 말씀해 주세요."
        onStatusChange("speaking")
        tts.speak(msg)

        const ttsDelay = (msg.length / 10) * 1000 + 1000
        setTimeout(() => {
          onStatusChange("idle")
          window.dispatchEvent(new CustomEvent("classifyFailed", { detail: { file } }))
        }, ttsDelay)
      } finally {
        setLoading(false)
      }
      return
    }

    // PDF 파일
    if (validation.isPDF) {
      console.log("[파일 업로드] PDF 선택됨 - 텍스트 추출 시도")
      setLoading(true)
      onStatusChange("processing")
      tts.speak("PDF 파일을 확인하고 있어요. 잠깐만 기다려 주세요.")
      bgmManager.start()

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("model", "auto") // 텍스트만 추출

        const res = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()
        bgmManager.stop()

        if (res.ok && data.text) {
          // 텍스트 추출 성공 - 바로 읽기
          console.log("[PDF] 텍스트 추출 성공")
          onStatusChange("speaking")
          tts.speak("문서를 읽어드릴게요.")
          setTimeout(() => {
            onResult(data.text)
            // onStatusChange("speaking")는 onResult 내부에서 호출됨
          }, 1500)
        } else if (data.error === "SCAN_PDF_DETECTED") {
          // 스캔된 PDF - 사용자가 선택한 모델 또는 기본 모델로 실행
          // UI ID를 실제 모델 ID로 변환
          const actualModelId = MODEL_ID_MAP[selectedModel] || selectedModel
          const pdfOcrModels = ["qwen3.5:9b", "richardyoung/olmocr2:7b-q8", "glm-ocr", "gemma4:e4b", "llama3.2-vision:11b-instruct-q4_K_M"]
          const useModel = pdfOcrModels.includes(actualModelId) ? actualModelId : "qwen3.5:9b"

          const modelName = useModel === "qwen3.5:9b" ? "큐쓰리" :
                           useModel === "richardyoung/olmocr2:7b-q8" ? "올름오씨알" :
                           useModel === "glm-ocr" ? "지엘엠" :
                           useModel === "gemma4:e4b" ? "구글 사기가" : "라마비전"

          console.log(`[PDF] 스캔된 문서 감지 - ${modelName} 모델로 실행`)
          onStatusChange("speaking")
          tts.speak(`스캔된 문서예요. ${modelName} 모델로 읽어드릴게요.`)

          setTimeout(async () => {
            try {
              onStatusChange("processing")
              bgmManager.start()

              // 스캔 PDF를 선택된 모델로 분석
              const formData = new FormData()
              formData.append("file", file)
              formData.append("model", useModel)

              const res = await fetch("/api/ocr", {
                method: "POST",
                body: formData,
              })

              const result = await res.json()
              bgmManager.stop()

              if (res.ok && result.text) {
                console.log("[PDF] 큐쓰리 OCR 성공")
                onResult(result.text)
                onStatusChange("speaking")
              } else {
                throw new Error(result.error || "OCR 실패")
              }
            } catch (e) {
              bgmManager.stop()
              const msg = e instanceof Error ? e.message : "PDF OCR 중 오류가 발생했습니다."
              console.error("[PDF OCR]", e)
              setError(msg)
              tts.speak(msg)
              onStatusChange("idle")
            }
          }, 2000)
        } else {
          throw new Error(data.error || "텍스트 추출 실패")
        }
      } catch (e) {
        bgmManager.stop()
        const msg = e instanceof Error ? e.message : "PDF 처리 중 오류가 발생했습니다."
        console.error("[PDF]", e)
        setError(msg)
        tts.speak(msg)
      } finally {
        setLoading(false)
      }
    }
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

  // 컴포넌트 언마운트 시 정리
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
            const uiModelId = e.target.value
            onModelChange(uiModelId)
            const foundImage = IMAGE_MODELS.find((m) => m.id === uiModelId)
            const foundDoc = DOCUMENT_MODELS.find((m) => m.id === uiModelId)
            const found = foundImage || foundDoc
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
          <optgroup label="📷 이미지 설명 (사진/그림)">
            {IMAGE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="📄 문서 OCR (텍스트 읽기)">
            {DOCUMENT_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </optgroup>
        </select>
        <p style={{ color: "#64748B", fontSize: "0.75rem", marginTop: "0.25rem" }}>
          {IMAGE_MODELS.find((m) => m.id === selectedModel)?.tts || DOCUMENT_MODELS.find((m) => m.id === selectedModel)?.tts}
        </p>
      </div>

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
