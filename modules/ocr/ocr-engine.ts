import fs from "fs"
import path from "path"
import os from "os"
import { spawnSync } from "child_process"

function sanitizeOcrText(text: string): string {
  // ANSI 제어 문자 제거
  let clean = text.replace(/\x1b\[[0-9;?]*[a-zA-Z]|\x1b\[K/g, "")
  // Braille 문자 제거
  clean = clean.replace(/[\u2800-\u28FF]/g, "")
  // 과도한 줄바꿈 정리
  clean = clean.replace(/\n{3,}/g, "\n\n")
  return clean.trim()
}

function isGarbageOcrText(text: string): boolean {
  if (!text || text.length < 5) return true
  const readableCount = (text.match(/[a-zA-Z0-9가-힣\s.,!?:;()]/g) || []).length
  const ratio = readableCount / text.length
  return ratio < 0.5
}

export async function extractTextOCR(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<string> {
  const name = fileName || "문서"
  const tmpDir = os.tmpdir()

  const PYTHON_BIN = process.env.PYTHON_BIN ||
    "C:\\Users\\tara0\\AppData\\Local\\Programs\\Python\\Python313\\python.exe"

  const ollamaPath = "C:\\Users\\tara0\\AppData\\Local\\Programs\\Ollama"
  const env = {
    ...process.env,
    PATH: `${ollamaPath};${process.env.PATH}`,
    PYTHONIOENCODING: "utf-8"
  }

  // 1순위: Tesseract (빠름, 인쇄 텍스트)
  const TESS_SCRIPT = path.join(process.cwd(), "server", "tesseract-ocr.py")
  if (fs.existsSync(TESS_SCRIPT)) {
    const tmpImg = path.join(tmpDir, `tess_${Date.now()}.png`)
    try {
      fs.writeFileSync(tmpImg, buffer)
      console.log("[OCR] Tesseract 시도...")

      const result = spawnSync(PYTHON_BIN, [TESS_SCRIPT, tmpImg], {
        timeout: 30000,
        encoding: "utf8",
        env
      })

      // 파일 정리
      setTimeout(() => {
        try {
          if (fs.existsSync(tmpImg)) fs.unlinkSync(tmpImg)
        } catch (e) {
          // ignore
        }
      }, 1000)

      if (result.status === 0 && result.stdout) {
        const data = JSON.parse(result.stdout.trim())
        if (data.success && data.text?.length > 10) {
          const text = sanitizeOcrText(data.text)
          if (!isGarbageOcrText(text)) {
            console.log("[OCR] Tesseract 성공:", text.length, "자")
            return `파일명: ${name}\n\n${text}`
          }
        }
      }
      console.log("[OCR] Tesseract 결과 없음 → Vision으로")
    } catch (e) {
      console.log("[OCR] Tesseract 실패:", e)
      // 파일 정리
      try {
        if (fs.existsSync(tmpImg)) fs.unlinkSync(tmpImg)
      } catch (cleanupErr) {
        // ignore
      }
    }
  }

  // 2순위: Vision 모델 (gemma4/qwen3.5)
  // extractTextOCR는 이미지 OCR 전용이므로 여기서는 에러를 던지고
  // 호출하는 쪽(modules/ocr/index.ts)에서 Vision으로 처리하도록 함
  throw new Error("Tesseract OCR 실패 - Vision 모델로 전환 필요")
}
