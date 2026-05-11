import fs from "fs"
import path from "path"

const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER_PATH || "C:/Users/tara0/ReadVoice_Upload"

export async function POST() {
  try {
    console.log("[클리닝] 세션 정리 시작")

    // CRITICAL: 업로드 폴더는 사용자가 수동으로 관리하는 영구 저장소입니다.
    // 파일을 자동으로 삭제하면 사용자의 작업 파일이 사라집니다.
    // 세션 정리는 브라우저 캐시와 로컬 스토리지만 정리하고,
    // 파일 삭제는 사용자가 직접 수행해야 합니다.

    console.log("[클리닝] 완료 - 파일 삭제 안 함 (사용자 영구 저장소)")

    return Response.json({
      success: true,
      message: "세션 정리 완료 (파일은 유지됨)"
    })
  } catch (e) {
    console.error("[클리닝] 오류:", e)
    return Response.json({ error: "클리닝 실패" }, { status: 500 })
  }
}
