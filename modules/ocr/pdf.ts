export async function extractTextFromPDF(
  buffer: Buffer,
  fileName: string = "문서"
): Promise<string> {
  try {
    // pdf-parse CommonJS 방식
    const pdfParse = require("pdf-parse")
    console.log("[OCR] Attempting text extraction from PDF...")
    const data = await pdfParse(buffer)
    const text = data.text?.trim()

    if (!text) {
      throw new Error(
        "PDF에서 텍스트를 찾을 수 없습니다. 이미지로만 된 PDF(스캔본)는 파일 업로드로 이미지 선택 후 다시 시도해주세요."
      )
    }

    console.log("[OCR] ✓ Text extracted from PDF")
    return text
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "PDF 읽기 실패. 텍스트가 포함된 PDF인지 확인하세요."
    throw new Error(message)
  }
}
