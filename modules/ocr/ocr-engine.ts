const OCR_PROMPT = `이 문서의 모든 텍스트를 정확히 추출해줘.
규칙:
- 보이는 텍스트를 그대로 옮겨써
- 표는 마크다운 표 형식으로 변환
- 숫자, 코드, 특수문자 정확히
- 한국어, 영어, 일본어, 중국어 모두 그대로
- 설명이나 해석 추가 금지
- 줄바꿈과 구조 최대한 보존`

export async function extractTextOCR(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<string> {
  const base64 = buffer.toString("base64")
  const name = fileName || "문서"

  // GLM-OCR 시도 (초경량, OCR 특화)
  try {
    console.log("[OCR] GLM-OCR 시도...")
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "glm-ocr",
        messages: [
          {
            role: "user",
            content: OCR_PROMPT,
            images: [base64],
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (res.ok) {
      const data = await res.json()
      const text = data.message?.content?.trim()
      if (text && text.length > 10) {
        console.log("[OCR] GLM-OCR 성공:", text.length, "자")
        return `파일명: ${name}\n\n${text}`
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.log("[OCR] GLM-OCR 실패:", message)
  }

  // olmOCR-2 fallback
  try {
    console.log("[OCR] olmOCR-2 시도...")
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "richardyoung/olmocr2:7b-q8",
        messages: [
          {
            role: "user",
            content:
              "Extract all text from this document preserving structure and formatting.",
            images: [base64],
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(180000),
    })

    if (res.ok) {
      const data = await res.json()
      const text = data.message?.content?.trim()
      if (text && text.length > 10) {
        console.log("[OCR] olmOCR-2 성공:", text.length, "자")
        return `파일명: ${name}\n\n${text}`
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.log("[OCR] olmOCR-2 실패:", message)
  }

  // qwen2.5vl fallback
  try {
    console.log("[OCR] qwen2.5vl 시도...")
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5vl:7b",
        messages: [
          {
            role: "user",
            content: OCR_PROMPT,
            images: [base64],
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(180000),
    })

    if (res.ok) {
      const data = await res.json()
      const text = data.message?.content?.trim()
      if (text && text.length > 10) {
        console.log("[OCR] qwen2.5vl 성공:", text.length, "자")
        return `파일명: ${name}\n\n${text}`
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.log("[OCR] qwen2.5vl 실패:", message)
  }

  throw new Error("텍스트 추출 실패. 이미지 품질을 확인해주세요.")
}
