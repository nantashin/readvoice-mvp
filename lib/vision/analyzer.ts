export type VisionModel =
  | "moondream"
  | "gemma3:4b"
  | "qwen2.5vl:7b"
  | "llama3.2-vision:11b-instruct-q4_K_M"
  | "glm-ocr"

export interface AnalysisResult {
  text: string
  error?: string
}

export async function analyzeFile(
  file: File,
  model: VisionModel,
  mode?: "ocr" | "describe"
): Promise<AnalysisResult> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("model", model)
  if (mode) {
    formData.append("mode", mode)
  }

  try {
    const res = await fetch("/api/ocr", { method: "POST", body: formData })
    const data = await res.json()

    if (!res.ok) {
      return {
        text: "",
        error: data.error ?? "파일 처리 중 오류가 발생했습니다.",
      }
    }

    return {
      text: data.text,
    }
  } catch {
    return {
      text: "",
      error: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
    }
  }
}

export const MODELS: Array<{ id: VisionModel; label: string; tts: string }> = [
  {
    id: "moondream",
    label: "🌙 Moondream — 간단한 사진 (5~15초)",
    tts: "문드림 모델입니다. 간단한 사진 묘사에 적합하며 약 5초에서 15초 걸립니다.",
  },
  {
    id: "gemma3:4b",
    label: "🔮 Gemma3 — 빠르고 정확 (10~20초)",
    tts: "구글 젬마3 모델입니다. 빠르고 정확한 이미지 분석을 제공하며 약 10초에서 20초 걸립니다.",
  },
  {
    id: "qwen2.5vl:7b",
    label: "💎 OCR Q — 문서/텍스트 인식 최적 (20~40초)",
    tts: "OCR 큐 모델입니다. 문서와 텍스트 인식에 최적화되어 있으며 약 20초에서 40초 걸립니다.",
  },
  {
    id: "llama3.2-vision:11b-instruct-q4_K_M",
    label: "🦙 Llama Vision — 상세 묘사 (1~3분)",
    tts: "라마 비전 모델입니다. 배경과 분위기까지 가장 상세하게 묘사하며 약 1분에서 3분 걸립니다.",
  },
]
