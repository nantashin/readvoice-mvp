import fs from "fs"
import path from "path"
import os from "os"
import { spawnSync } from "child_process"

const OCR_PROMPT = `다음 문서의 모든 텍스트를 한국어로 그대로 읽어줘.
- 보이는 글자를 빠짐없이 정확히 옮겨써
- 표는 그대로 유지
- 숫자, 날짜, 코드 정확히
- 설명이나 해석 절대 금지
- 텍스트만 출력`

export async function extractTextOCR(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<string> {
  const name = fileName || "문서"

  console.log("[OCR] 버퍼 크기:", buffer.length, "bytes")

  // GLM-OCR 시도 (Python 스크립트로 직접 호출)
  const tmpImg = path.join(os.tmpdir(), `rv_glm_${Date.now()}.png`)
  const scriptPath = path.join(process.cwd(), "server", "glm-ocr.py")

  console.log("[OCR] 스크립트 존재:", fs.existsSync(scriptPath))
  console.log("[OCR] tmpImg:", tmpImg)

  try {
    fs.writeFileSync(tmpImg, buffer)

    const result = spawnSync(
      "python",
      [scriptPath, tmpImg],
      {
        timeout: 90000,
        encoding: "utf8",
        cwd: process.cwd()  // 작업 디렉토리 명시
      }
    )

    console.log("[OCR] exit code:", result.status)
    console.log("[OCR] stdout:", result.stdout?.substring(0, 200))
    console.log("[OCR] stderr:", result.stderr?.substring(0, 200))

    // 임시 파일 삭제
    setTimeout(() => {
      try {
        fs.unlinkSync(tmpImg)
      } catch (e) {}
    }, 2000)

    if (result.status === 0 && result.stdout?.trim()) {
      try {
        const data = JSON.parse(result.stdout.trim())
        if (data.success && data.text && data.text.length > 5) {
          console.log("[OCR] GLM-OCR 성공:", data.text.length, "자")
          return `파일명: ${name}\n\n${data.text}`
        }
      } catch (e) {
        console.log("[OCR] JSON 파싱 실패:", result.stdout?.substring(0, 100))
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.log("[OCR] GLM-OCR 예외:", message)
  }

  throw new Error("GLM-OCR 실패. 서버 로그를 확인해주세요.")
}
