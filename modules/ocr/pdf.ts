import fs from "fs"
import path from "path"
import os from "os"
import { execSync, spawnSync } from "child_process"
import { extractTextOCR } from "./ocr-engine"

// 모델별 타임아웃 (라마비전 10분 복구)
const MODEL_TIMEOUTS: Record<string, number> = {
  "gemma4:e2b": 120000,       // 2분
  "gemma4:e4b": 180000,       // 3분
  "qwen3.5:9b": 300000,       // 5분
  "llama3.2-vision:11b-instruct-q4_K_M": 600000,  // 10분
}

function extractRawText(buffer: Buffer): string {
  const str = buffer.toString("binary")
  const matches = str.match(/\(([^\)]{2,100})\)/g) || []
  const texts = matches
    .map((m) => m.slice(1, -1))
    .filter((t) => {
      // 한글 또는 읽기 가능한 영문/숫자만
      const koreanCount = (t.match(/[가-힣]/g) || []).length
      const readableCount = (
        t.match(/[a-zA-Z0-9가-힣\s.,!?:;()]/g) || []
      ).length
      const totalCount = t.length
      // 읽기 가능한 문자 비율이 70% 이상이어야 함
      return (
        readableCount / totalCount > 0.7 &&
        (koreanCount > 0 || t.length > 3)
      )
    })
    .join(" ")
    .trim()

  return texts
}

/**
 * PDF에서 텍스트만 추출 (Vision 모델 사용 안 함)
 * 성공하면 텍스트 반환, 실패하면 null 반환
 */
export function extractTextOnly(buffer: Buffer, fileName?: string): string | null {
  const name = fileName || "문서"

  try {
    console.log("[PDF] 텍스트만 추출 시도...")
    const rawText = extractRawText(buffer)
    const koreanCount = (rawText.match(/[가-힣]/g) || []).length

    if (koreanCount > 10) {
      console.log(`[PDF] 텍스트 추출 성공: 한글 ${koreanCount}자`)
      return `파일명: ${name}\n\n설명:\n${rawText.substring(0, 4000)}`
    }

    console.log(`[PDF] 유효 텍스트 없음 (한글 ${koreanCount}자)`)
    return null
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[PDF] 텍스트 추출 실패:", message)
    return null
  }
}

export async function extractTextFromPDF(
  buffer: Buffer,
  fileName?: string,
  selectedModel?: string
): Promise<string> {
  const name = fileName || "문서"

  // 1단계: 간단한 텍스트 파싱
  try {
    console.log("[PDF] 텍스트 파싱 시도...")
    const rawText = extractRawText(buffer)
    // 한글이 최소 10자 이상 있어야 유효한 텍스트로 인정
    const koreanCount = (rawText.match(/[가-힣]/g) || []).length

    if (koreanCount > 10) {
      console.log(`[PDF] 텍스트 파싱 성공: 한글 ${koreanCount}자`)
      return `파일명: ${name}\n\n설명:\n${rawText.substring(0, 4000)}`
    }

    console.log(
      `[PDF] 유효 텍스트 없음 (한글 ${koreanCount}자) → pypdfium2로 전환`
    )
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[PDF] 텍스트 파싱 실패:", message)
  }

  // 2단계: pypdfium2 Python 스크립트로 PDF → PNG 변환
  try {
    console.log("[PDF] pypdfium2로 PDF → PNG 변환...")

    const tmpDir = os.tmpdir()
    const tmpPdf = path.join(tmpDir, `rv_${Date.now()}.pdf`)

    fs.writeFileSync(tmpPdf, buffer)

    try {
      const PYTHON_BIN = process.env.PYTHON_BIN || "python"
      console.log("[OCR] PYTHON_BIN:", PYTHON_BIN)

      const scriptPath = path.join(process.cwd(), "server", "pdf-to-image.py")

      const result = spawnSync(PYTHON_BIN, [scriptPath, tmpPdf, "0"], {
        timeout: 60000,
        maxBuffer: 50 * 1024 * 1024, // 50MB 버퍼
        encoding: "utf8",
      })

      if (result.error) throw result.error
      if (result.status !== 0) {
        console.error("[PDF] Python 오류:", result.stderr)
        throw new Error("pypdfium2 실행 실패")
      }

      const parsed = JSON.parse(result.stdout.trim())

      // 파일 삭제 - 약간 대기 후 삭제
      setTimeout(() => {
        try {
          fs.unlinkSync(tmpPdf)
        } catch (e) {}
      }, 1000)

      if (parsed.success && parsed.base64) {
        console.log(
          `[PDF] pypdfium2 변환 성공, ${parsed.total_pages}페이지`
        )
        const base64Image = parsed.base64
        const pngBuffer = Buffer.from(base64Image, "base64")

        const prefix =
          parsed.total_pages > 1
            ? `총 ${parsed.total_pages}페이지 문서입니다. 첫 페이지를 읽어드립니다.\n\n`
            : ""

        // 모델별 처리
        if (!selectedModel) {
          // 기본값: Tesseract 시도
          try {
            const ocrText = await extractTextOCR(pngBuffer, "image/png", name)
            return ocrText.replace(/^파일명: (.+)\n\n/, `파일명: $1\n\n${prefix}`)
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e)
            console.log("[PDF] Tesseract 실패:", message)
            throw e
          }
        } else {
          // Ollama Vision 직접 호출 (gemma4:e2b, gemma4:e4b, qwen3.5:9b만)
          const OCR_PROMPT = `이 문서의 모든 텍스트를 정확히 읽어줘.
위에서 아래로 순서대로 읽어줘.
줄바꿈은 문단이 바뀔 때만 해줘.
오타 없이 정확하게 읽어줘.
설명이나 해석 추가 금지.`

          const models = [selectedModel]
          const timeout = MODEL_TIMEOUTS[selectedModel || "gemma4:e4b"] || 120000

          for (const model of models) {
            try {
              console.log(`[PDF] ${model}으로 분석... (타임아웃: ${timeout / 1000}초)`)
              const res = await fetch("http://localhost:11434/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model,
                  messages: [{
                    role: "user",
                    content: OCR_PROMPT,
                    images: [base64Image]
                  }],
                  stream: false
                }),
                signal: AbortSignal.timeout(timeout)
              })

              if (!res.ok) {
                const errText = await res.text()
                console.error(`[PDF] ${model} HTTP오류:`, res.status, errText)
                throw new Error(`HTTP ${res.status}`)
              }

              const data = await res.json()
              const text = data.message?.content?.trim()
              if (text && text.length > 10) {
                console.log(`[PDF] ${model} 성공`)
                return `파일명: ${name}\n\n${prefix}${text}`
              }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e)
              console.error(`[PDF] ${model} fetch 실패:`, msg)
              throw new Error(`${model} 분석 실패: ${msg}`)
            }
          }
          throw new Error("분석 실패. 다른 모델을 선택해 주세요.")
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error("[PDF] pypdfium2 실패:", message)
      if (fs.existsSync(tmpPdf)) {
        try {
          fs.unlinkSync(tmpPdf)
        } catch (e) {}
      }
      throw e
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[PDF] PDF 변환 실패:", message)
    throw new Error(`PDF 변환 실패: ${message}`)
  }

  // 3단계: 모든 처리 실패
  throw new Error("PDF 처리 실패")
}
