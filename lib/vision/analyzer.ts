export type VisionModel =
  | "gemma4:e2b"
  | "gemma4:e4b"
  | "qwen3.5:9b"
  | "llama3.2-vision:11b-instruct-q4_K_M"

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
    id: "gemma4:e2b",
    label: "🔮 Gemma4 E2B — 빠른 분석 (5~20초)",
    tts: "젬마4 이비 모델입니다. 빠른 이미지 분석에 최적화되어 있으며 약 5초에서 20초 걸립니다.",
  },
  {
    id: "gemma4:e4b",
    label: "💫 Gemma4 E4B — 균형 (20~40초)",
    tts: "젬마4 이포비 모델입니다. 빠르고 정확한 분석을 제공하며 약 20초에서 40초 걸립니다.",
  },
  {
    id: "qwen3.5:9b",
    label: "💎 OCR Q3 — 텍스트/문서 최적 (30~60초)",
    tts: "OCR 큐 쓰리 모델입니다. 텍스트와 문서 인식에 최적화되어 있으며 약 30초에서 60초 걸립니다.",
  },
  {
    id: "llama3.2-vision:11b-instruct-q4_K_M",
    label: "🦙 Llama Vision — 상세 묘사 (1~3분)",
    tts: "라마 비전 모델입니다. 배경과 분위기까지 가장 상세하게 묘사하며 약 1분에서 3분 걸립니다.",
  },
]
