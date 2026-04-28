import { extractTextFromImage } from "./gemini"
import { extractTextFromPDF } from "./pdf"
import { extractTextOCR } from "./ocr-engine"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const PDF_TYPE = "application/pdf"

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  preferredModel?: "moondream" | "llama-vision-q4" | "claude-haiku"
): Promise<string | { korean: string; english: string }> {
  if (mimeType === PDF_TYPE) {
    return extractTextFromPDF(buffer, fileName)
  }

  if (IMAGE_TYPES.includes(mimeType)) {
    // 1순위: Tesseract OCR 시도
    try {
      const ocrResult = await extractTextOCR(buffer, mimeType, fileName)
      // Tesseract 성공 시 문자열만 반환 (번역 불필요)
      return ocrResult
    } catch (e) {
      console.log("[OCR] Tesseract 실패, Vision으로 전환:", e instanceof Error ? e.message : String(e))
    }

    // 2순위: Vision 모델 (gemma4/qwen3.5)
    return extractTextFromImage(buffer, mimeType, fileName, preferredModel)
  }

  throw new Error(`지원하지 않는 파일 형식입니다: ${mimeType}`)
}

export const SUPPORTED_TYPES = [...IMAGE_TYPES, PDF_TYPE]
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
