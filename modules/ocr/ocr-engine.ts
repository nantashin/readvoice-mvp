import fs from "fs"
import path from "path"
import os from "os"
import { spawnSync } from "child_process"

function buildPythonEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  env.PYTHONIOENCODING = "utf-8"

  // Windows에서 ollama PATH 추가
  if (process.platform === "win32") {
    const ollamaPath = "C:\\Users\\tara0\\AppData\\Local\\Programs\\Ollama"
    if (env.PATH) {
      env.PATH = `${ollamaPath};${env.PATH}`
    } else {
      env.PATH = ollamaPath
    }
  }

  return env
}

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
  const tmpImage = path.join(tmpDir, `ocr_${Date.now()}.png`)

  try {
    fs.writeFileSync(tmpImage, buffer)

    const pythonCmd = process.platform === "win32" ? "python" : "python3"
    const scriptPath = path.join(process.cwd(), "server", "glm-ocr.py")

    console.log("[OCR] GLM-OCR Python 스크립트 실행...")

    const result = spawnSync(pythonCmd, [scriptPath, tmpImage], {
      timeout: 120000,
      encoding: "utf8",
      env: buildPythonEnv(),
    })

    if (fs.existsSync(tmpImage)) {
      fs.unlinkSync(tmpImage)
    }

    if (result.error) {
      throw new Error(`Python 실행 실패: ${result.error.message}`)
    }

    if (result.status !== 0) {
      const stderr = result.stderr || "알 수 없는 오류"
      throw new Error(`GLM-OCR 실패 (code ${result.status}): ${stderr}`)
    }

    const output = result.stdout.trim()
    if (!output) {
      throw new Error("GLM-OCR 빈 응답")
    }

    try {
      const parsed = JSON.parse(output)

      if (!parsed.success) {
        throw new Error(parsed.error || "GLM-OCR 처리 실패")
      }

      const text = sanitizeOcrText(parsed.text)

      if (isGarbageOcrText(text)) {
        throw new Error("OCR 결과 품질 불량")
      }

      console.log(`[OCR] GLM-OCR 성공: ${text.length}자`)
      return `파일명: ${name}\n\n${text}`

    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(`GLM-OCR JSON 파싱 실패: ${output.substring(0, 100)}`)
      }
      throw e
    }

  } catch (error) {
    if (fs.existsSync(tmpImage)) {
      try {
        fs.unlinkSync(tmpImage)
      } catch (e) {
        // ignore
      }
    }
    throw error
  }
}
