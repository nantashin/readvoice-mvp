import fs from "fs"
import path from "path"

const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER_PATH || "C:/Users/tara0/ReadVoice_Upload"

export async function POST() {
  try {
    console.log("[클리닝] 세션 정리 시작")

    // 업로드 폴더의 파일 목록
    if (!fs.existsSync(UPLOAD_FOLDER)) {
      return Response.json({ success: true, message: "폴더 없음" })
    }

    const files = fs.readdirSync(UPLOAD_FOLDER)
    const now = Date.now()
    const ONE_HOUR = 60 * 60 * 1000

    let deletedCount = 0

    // 1시간 이상 된 파일 삭제 (최근 세션은 유지)
    files.forEach(file => {
      const filePath = path.join(UPLOAD_FOLDER, file)
      const stats = fs.statSync(filePath)
      const fileAge = now - stats.mtimeMs

      if (fileAge > ONE_HOUR) {
        try {
          fs.unlinkSync(filePath)
          deletedCount++
          console.log(`[클리닝] 삭제: ${file}`)
        } catch (e) {
          console.error(`[클리닝] 삭제 실패: ${file}`, e)
        }
      }
    })

    console.log(`[클리닝] 완료 - ${deletedCount}개 파일 삭제`)

    return Response.json({
      success: true,
      message: `${deletedCount}개 파일 정리 완료`
    })
  } catch (e) {
    console.error("[클리닝] 오류:", e)
    return Response.json({ error: "클리닝 실패" }, { status: 500 })
  }
}
