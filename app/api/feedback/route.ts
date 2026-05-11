import fs from "fs"
import path from "path"
import { NextRequest } from "next/server"

const FEEDBACK_FOLDER = process.env.FEEDBACK_FOLDER_PATH || "C:/Users/tara0/ReadVoice_Feedback"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, feedback, data, timestamp } = body

    // 피드백 폴더 생성
    if (!fs.existsSync(FEEDBACK_FOLDER)) {
      fs.mkdirSync(FEEDBACK_FOLDER, { recursive: true })
    }

    // 날짜별 폴더
    const date = new Date().toISOString().split("T")[0]
    const dateFolderPath = path.join(FEEDBACK_FOLDER, date)
    if (!fs.existsSync(dateFolderPath)) {
      fs.mkdirSync(dateFolderPath, { recursive: true })
    }

    // 피드백 데이터 저장
    const feedbackData = {
      sessionId,
      feedback,
      data,
      timestamp,
      date: new Date().toISOString()
    }

    const fileName = `${sessionId}_${feedback}.json`
    const filePath = path.join(dateFolderPath, fileName)

    fs.writeFileSync(filePath, JSON.stringify(feedbackData, null, 2), "utf-8")

    console.log(`[피드백] 저장 완료: ${fileName}`)

    return Response.json({ success: true, message: "피드백 저장 완료" })
  } catch (e) {
    console.error("[피드백] 저장 실패:", e)
    return Response.json({ error: "피드백 저장 실패" }, { status: 500 })
  }
}
