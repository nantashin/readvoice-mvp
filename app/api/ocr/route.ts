import { NextRequest, NextResponse } from "next/server"
import { extractText, SUPPORTED_TYPES, MAX_FILE_SIZE } from "@/modules/ocr"

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

    // 파일 타입 확인
    const isPDF =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

    let text: string

    if (isPDF) {
      console.log("[API] PDF OCR 파이프라인 실행")
      text = await extractText(buffer, "application/pdf", file.name)
    } else {
      console.log("[API] 이미지 Vision 분석")

      const validModels = [
        "gemma4:e2b",
        "gemma4:e4b",
        "qwen3.5:9b",
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
