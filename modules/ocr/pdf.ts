import { PDFParse } from "pdf-parse"

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  const text = result.text.trim()
  if (!text) throw new Error("PDF에서 텍스트를 찾을 수 없습니다.")
  return text
}
