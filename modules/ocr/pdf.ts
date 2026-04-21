export async function extractTextFromPDF(
  buffer: Buffer,
  fileName?: string
): Promise<string> {
  // 1단계: pdf-parse 시도
  try {
    const pdfParse = require("pdf-parse")
    const data = await pdfParse(buffer)
    const text = data.text?.trim()
    if (text && text.length > 30) {
      console.log("[PDF] 텍스트 추출 성공")
      return text
    }
  } catch (e) {
    console.log("[PDF] pdf-parse 실패:", e)
  }

  // 2단계: Claude API로 PDF 직접 분석
  console.log("[PDF] Claude API로 분석 시도")
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === "your-key-here") {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.")
  }

  const base64 = buffer.toString("base64")

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: "이 PDF 문서의 모든 내용을 한국어로 읽어줘. 모든 항목과 내용을 빠짐없이 포함해줘.",
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error("[PDF] Claude API 오류:", err)
    throw new Error("PDF 분석 실패: " + err)
  }

  const data = await response.json()
  return data.content?.[0]?.text || "PDF 내용을 읽을 수 없습니다."
}
