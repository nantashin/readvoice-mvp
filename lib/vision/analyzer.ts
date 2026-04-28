export type VisionModel =
  | "gemma4:e2b"
  | "gemma4:e4b"
  | "qwen3.5:9b"
  | "llama3.2-vision:11b-instruct-q4_K_M"

export interface AnalysisResult {
  text: string
  original?: string
  error?: string
  classification?: "document" | "photo" | "mixed"
}

import { compressImage } from "@/lib/file/compressor"
import { classifyImage } from "@/modules/ocr/gemini"

export async function analyzeFile(
  file: File,
  model: VisionModel,
  mode?: "ocr" | "describe",
  autoClassify: boolean = false
): Promise<AnalysisResult> {
  let classification: "document" | "photo" | "mixed" | undefined

  // 이미지 파일인 경우 자동 분류
  const isImage = file.type.startsWith("image/")
  if (isImage && autoClassify) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      classification = await classifyImage(buffer, file.name)
      console.log("[Analyzer] 자동 분류 결과:", classification)
    } catch (e) {
      console.error("[Analyzer] 자동 분류 실패:", e)
    }
  }

  const formData = new FormData()

  // 이미지 파일인 경우 압축 (라마비전: 800KB, 나머지: 2MB)
  if (isImage) {
    console.log("[Analyzer] 이미지 압축 중... 모델:", model)
    const base64 = await compressImage(file, model)
    const compressedBlob = await (await fetch(`data:image/jpeg;base64,${base64}`)).blob()
    formData.append("file", new File([compressedBlob], file.name, { type: "image/jpeg" }))
  } else {
    formData.append("file", file)
  }

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
        classification,
      }
    }

    return {
      text: data.text,
      original: data.original, // 이미지 분석일 경우 영문 원본
      classification,
    }
  } catch {
    return {
      text: "",
      error: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
      classification,
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
