import { extractTextFromImage } from "./gemini"
import { extractTextFromPDF } from "./pdf"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const PDF_TYPE = "application/pdf"

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === PDF_TYPE) {
    return extractTextFromPDF(buffer)
  }
  if (IMAGE_TYPES.includes(mimeType)) {
    return extractTextFromImage(buffer, mimeType)
  }
  throw new Error(`지원하지 않는 파일 형식입니다: ${mimeType}`)
}

export const SUPPORTED_TYPES = [...IMAGE_TYPES, PDF_TYPE]
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
