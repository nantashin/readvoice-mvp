import fs from "fs"
import path from "path"
import { NextRequest } from "next/server"

const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER_PATH || "C:/Users/tara0/ReadVoice_Upload"

export async function POST(req: NextRequest) {
  try {
    const { title, imageData } = await req.json()

    if (!title || !imageData) {
      return Response.json({ error: "제목과 이미지 데이터가 필요합니다" }, { status: 400 })
    }

    // 폴더가 없으면 생성
    if (!fs.existsSync(UPLOAD_FOLDER)) {
      fs.mkdirSync(UPLOAD_FOLDER, { recursive: true })
    }

    // Base64 데이터 파싱 (data:image/jpeg;base64, 제거)
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    // 파일명 생성 (한글 포함, 공백 제거)
    const sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, "").trim()
    const timestamp = Date.now()
    const fileName = `${sanitizedTitle}_${timestamp}.jpg`
    const filePath = path.join(UPLOAD_FOLDER, fileName)

    // 파일 저장
    fs.writeFileSync(filePath, buffer)

    console.log(`[save-image] 저장 완료: ${fileName}`)

    return Response.json({
      success: true,
      fileName,
      filePath
    })
  } catch (e) {
    console.error("[save-image] 에러:", e)
    return Response.json({ error: "이미지 저장 실패" }, { status: 500 })
  }
}
