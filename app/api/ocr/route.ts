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

    const text = await extractText(buffer, file.type)

    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "텍스트 추출에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
