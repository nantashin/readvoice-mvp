import fs from "fs"
import path from "path"
import os from "os"
import { execSync, spawnSync } from "child_process"

const PDF_VISION_PROMPT = `Read ALL text in this document image exactly as written.
Output the complete text content from top to bottom.
Do not describe the image. Only output the text you see.
Preserve the original formatting and structure.`

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

export async function extractTextFromPDF(
  buffer: Buffer,
  fileName?: string
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
      const pythonCommands = ["python", "python3", "py"]
      let pythonCmd = "python"

      // 사용 가능한 python 명령어 찾기
      for (const cmd of pythonCommands) {
        try {
          execSync(`${cmd} --version`, {
            timeout: 5000,
            encoding: "utf8",
          })
          pythonCmd = cmd
          console.log(`[PDF] Python 명령어: ${pythonCmd}`)
          break
        } catch (e) {
          continue
        }
      }

      const scriptPath = path.join(process.cwd(), "server", "pdf-to-image.py")

      const result = spawnSync(pythonCmd, [scriptPath, tmpPdf, "0"], {
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

        // PDF 전용 Vision 모델 순서
        for (const model of [
          "qwen2.5vl:7b",
          "llama3.2-vision:11b-instruct-q4_K_M",
        ]) {
          try {
            console.log(`[PDF] ${model} Vision 시도...`)
            const res = await fetch("http://localhost:11434/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: "user",
                    content: PDF_VISION_PROMPT,
                    images: [base64Image],
                  },
                ],
                stream: false,
              }),
              signal: AbortSignal.timeout(180000),
            })

            if (!res.ok) continue

            const data = await res.json()
            const text = data.message?.content?.trim()

            if (text && text.length > 30) {
              console.log(`[PDF] ${model} Vision 성공`)
              const prefix =
                parsed.total_pages > 1
                  ? `총 ${parsed.total_pages}페이지 문서입니다. 첫 페이지를 읽어드립니다.\n\n`
                  : ""
              return `파일명: ${name}\n\n설명:\n${prefix}${text}`
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e)
            console.log(`[PDF] ${model} 실패:`, message)
          }
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
  }

  // 3단계: 모든 처리 실패
  throw new Error(
    "PDF 변환 실패. pypdfium2가 설치되어 있는지 확인하세요."
  )
}
