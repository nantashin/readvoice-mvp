import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { extractTextOCR } from "./ocr-engine"

const PDF_TO_IMAGE_SCRIPT = path.join(process.cwd(), "server", "pdf-to-image.py")
const PYTHON_BIN = process.env.PYTHON_BIN || "python"
const OCR_PAGE_LIMIT = 3

function extractRawText(buffer: Buffer): string {
  const str = buffer.toString("binary")
  const matches = str.match(/\(([^\)]{2,100})\)/g) || []

  return matches
    .map((m) => m.slice(1, -1))
    .filter((t) => {
      const readableCount = (t.match(/[a-zA-Z0-9가-힣\s.,!?:;()]/g) || []).length
      const totalCount = t.length
      const koreanCount = (t.match(/[가-힣]/g) || []).length
      return totalCount > 0 && readableCount / totalCount > 0.7 && (koreanCount > 0 || t.length > 3)
    })
    .join(" ")
    .trim()
}

type PdfToImageResult = {
  totalPages: number
}

function convertPdfPageToPng(pdfPath: string, page: number, outputPath: string): PdfToImageResult {
  if (!fs.existsSync(PDF_TO_IMAGE_SCRIPT)) {
    throw new Error(`[PDF] 변환 스크립트가 없습니다: ${PDF_TO_IMAGE_SCRIPT}`)
  }

  const result = spawnSync(PYTHON_BIN, [PDF_TO_IMAGE_SCRIPT, pdfPath, String(page), outputPath], {
    timeout: 45000,
    encoding: "utf8",
    cwd: process.cwd(),
  })

  if (result.error) {
    throw new Error(`[PDF] Python 실행 실패: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim()
    throw new Error(`[PDF] PDF→PNG 변환 실패 (page=${page}, status=${result.status}): ${stderr || "stderr 없음"}`)
  }

  const stdout = (result.stdout || "").trim()
  if (!stdout) {
    throw new Error(`[PDF] 변환 출력이 비어 있습니다 (page=${page})`)
  }

  let parsed: { total_pages?: number } | null = null
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error(`[PDF] 변환 출력 JSON 파싱 실패: ${stdout.slice(0, 300)}`)
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`[PDF] PNG 파일이 생성되지 않았습니다: ${outputPath}`)
  }

  return {
    totalPages: parsed?.total_pages ?? page + 1,
  }
}

export async function extractTextFromPDF(buffer: Buffer, fileName?: string): Promise<string> {
  const name = fileName || "문서"

  try {
    const rawText = extractRawText(buffer)
    const koreanCount = (rawText.match(/[가-힣]/g) || []).length

    if (koreanCount > 10 || rawText.length > 200) {
      return `파일명: ${name}\n\n설명:\n${rawText.substring(0, 4000)}`
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("[PDF] 텍스트 파싱 실패:", message)
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rv_pdf_"))
  const tmpPdf = path.join(tmpDir, "input.pdf")
  fs.writeFileSync(tmpPdf, buffer)

  const pageTexts: string[] = []
  const pageErrors: string[] = []

  try {
    let totalPages = 1

    for (let page = 0; page < Math.min(totalPages, OCR_PAGE_LIMIT); page += 1) {
      const tmpPng = path.join(tmpDir, `page-${page}.png`)

      try {
        const converted = convertPdfPageToPng(tmpPdf, page, tmpPng)
        totalPages = Math.max(converted.totalPages, 1)

        const pngBuffer = fs.readFileSync(tmpPng)
        const ocrResult = await extractTextOCR(pngBuffer, "image/png", `${name} (page ${page + 1})`)
        const normalized = ocrResult.replace(/^파일명:[^\n]*\n\n/, "").trim()

        if (normalized.length > 0) {
          pageTexts.push(`[페이지 ${page + 1}]\n${normalized}`)
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        pageErrors.push(`page ${page + 1}: ${message}`)
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  if (pageTexts.length > 0) {
    return `파일명: ${name}\n\n${pageTexts.join("\n\n")}`
  }

  throw new Error(`PDF OCR 실패: ${pageErrors.join(" | ") || "원인을 확인할 수 없습니다."}`)
}
