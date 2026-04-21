import { extractTextFromImage } from "./gemini"
import { extractTextFromPDF } from "./pdf"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const PDF_TYPE = "application/pdf"

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  preferredModel?: "moondream" | "llama-vision-q4" | "claude-haiku"
): Promise<string> {
  if (mimeType === PDF_TYPE) {
    return extractTextFromPDF(buffer, fileName)
  }
  if (IMAGE_TYPES.includes(mimeType)) {
    return extractTextFromImage(buffer, mimeType, fileName, preferredModel)
  }
  throw new Error(`지원하지 않는 파일 형식입니다: ${mimeType}`)
}

export const SUPPORTED_TYPES = [...IMAGE_TYPES, PDF_TYPE]
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
