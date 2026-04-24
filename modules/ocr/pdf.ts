import fs from "fs"
import path from "path"
import os from "os"
import { spawnSync } from "child_process"
import { extractTextOCR } from "./ocr-engine"

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

  // 2단계: pypdfium2로 PDF → PNG 변환
  console.log("[PDF] pypdfium2로 PDF → PNG 변환...")

  // PDF → PNG 변환
  const tmpPdf = path.join(os.tmpdir(), `rv_${Date.now()}.pdf`)
  const tmpPng = path.join(os.tmpdir(), `rv_${Date.now()}.png`)
  fs.writeFileSync(tmpPdf, buffer)

  const convertResult = spawnSync(
    "python",
    [path.join(process.cwd(), "server", "pdf-to-image.py"), tmpPdf, "0", tmpPng],
    { timeout: 30000, encoding: "utf8" }
  )

  console.log("[PDF] 변환 결과:", convertResult.status, convertResult.stdout)

  // 임시 PDF 삭제
  setTimeout(() => {
    try {
      fs.unlinkSync(tmpPdf)
    } catch (e) {}
  }, 1000)

  if (convertResult.status === 0 && fs.existsSync(tmpPng)) {
    console.log("[PDF] PNG 변환 성공, GLM-OCR 시작...")
    const pngBuffer = fs.readFileSync(tmpPng)
    setTimeout(() => {
      try {
        fs.unlinkSync(tmpPng)
      } catch (e) {}
    }, 1000)
    return await extractTextOCR(pngBuffer, "image/png", name)
  }

  throw new Error("PDF 변환 실패")
}
