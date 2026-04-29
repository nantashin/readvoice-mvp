import { NextRequest, NextResponse } from "next/server"
import { SUPPORTED_TYPES, MAX_FILE_SIZE } from "@/modules/ocr"
import { extractTextFromPDF, extractTextOnly } from "@/modules/ocr/pdf"
import { extractTextFromImage } from "@/modules/ocr/gemini"

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      console.error("[API] Invalid content type:", contentType)
      return NextResponse.json({ error: "Invalid content type" }, { status: 415 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      console.error("[API] No file provided. formData keys:", Array.from(formData.keys()))
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("[API] 파일 수신:", file.name, file.type, file.size)

    if (!SUPPORTED_TYPES.includes(file.type)) {
      console.error("[API] 지원하지 않는 파일 형식:", file.type)
      return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      console.error("[API] 파일 크기 초과:", file.size, "MAX:", MAX_FILE_SIZE)
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const model = (formData.get("model") as string) || "auto"

    // 파일 타입 확인
    const isPDF =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

    // PDF 텍스트만 추출 (모델 없이)
    if (isPDF && model === "auto") {
      console.log("[API] PDF 텍스트만 추출 시도")
      const text = extractTextOnly(buffer, file.name)

      if (text) {
        console.log("[API] PDF 텍스트 추출 성공")
        return NextResponse.json({ text })
      } else {
        // 스캔본일 경우 기본 모델(qwen3.5:9b)로 OCR 실행
        console.log("[API] PDF 스캔본 감지 - qwen3.5:9b로 OCR 실행")
        const ocrText = await extractTextFromPDF(buffer, file.name, "qwen3.5:9b")
        return NextResponse.json({ text: ocrText })
      }
    }

    const validModels = [
      "gemma4:e2b",
      "gemma4:e4b",
      "llama3.2-vision:11b-instruct-q4_K_M",
      "qwen3.5:9b",
      "richardyoung/olmocr2:7b-q8",
      "glm-ocr"
    ]

    console.log("[API] 받은 모델:", model)
    console.log("[API] validModels:", validModels)
    console.log("[API] 유효한 모델 여부:", validModels.includes(model))

    if (!validModels.includes(model)) {
      console.error("[API] 유효하지 않은 모델:", model, "유효한 모델:", validModels)
      return NextResponse.json({ error: "유효하지 않은 모델입니다." }, { status: 400 })
    }

    if (isPDF) {
      console.log("[API] PDF OCR 파이프라인 실행 (모델:", model, ")")
      const text = await extractTextFromPDF(buffer, file.name, model)
      return NextResponse.json({ text })
    } else {
      // 이미지 파일은 Vision 모델로만 처리 (Tesseract 제외)
      console.log("[API] 이미지 Vision 분석 (모델:", model, ")")
      const result = await extractTextFromImage(buffer, file.type, file.name, model)
      // extractTextFromImage는 { korean, english } 객체를 반환
      return NextResponse.json({ text: result.korean, original: result.english })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "텍스트 추출에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
