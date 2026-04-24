import { NextRequest, NextResponse } from "next/server"
import { extractText, SUPPORTED_TYPES, MAX_FILE_SIZE } from "@/modules/ocr"
import { extractTextOCR } from "@/modules/ocr/ocr-engine"

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 415 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!SUPPORTED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const modelStr = (formData.get("model") as string) || "moondream"
    const modeStr = (formData.get("mode") as string) || ""

    // mode 파라미터 처리
    let mode: "ocr" | "describe" = "describe"

    if (modeStr === "ocr") {
      mode = "ocr"
    } else if (modeStr === "describe") {
      mode = "describe"
    } else {
      // mode 없으면 파일타입으로 자동 판단
      const isPDF =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      mode = isPDF ? "ocr" : "describe"
    }

    let text: string

    if (mode === "ocr") {
      // OCR 모드: 텍스트 그대로 추출
      console.log("[API] OCR 모드로 처리")
      text = await extractTextOCR(buffer, file.type, file.name)
    } else {
      // Describe 모드: Vision 설명
      console.log("[API] Describe 모드로 처리")

      // 모델 검증
      const validModels = [
        "moondream",
        "gemma3:4b",
        "qwen2.5vl:7b",
        "llama3.2-vision:11b-instruct-q4_K_M",
      ]
      if (!validModels.includes(modelStr)) {
        return NextResponse.json({ error: "유효하지 않은 모델입니다." }, { status: 400 })
      }

      text = await extractText(
        buffer,
        file.type,
        file.name,
        modelStr as "moondream" | "llama-vision-q4" | "claude-haiku"
      )
    }

    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "텍스트 추출에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
