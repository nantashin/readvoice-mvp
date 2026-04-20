import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "")

export async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  const result = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType,
      },
    },
    "이 이미지에서 텍스트를 추출해줘. 텍스트만 출력하고, 설명이나 마크다운은 쓰지 마.",
  ])

  const text = result.response.text().trim()
  if (!text) throw new Error("이미지에서 텍스트를 찾을 수 없습니다.")
  return text
}
