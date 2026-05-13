import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs"

const execFileAsync = promisify(execFile)

const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER_PATH || "C:/Users/tara0/ReadVoice_Upload"

export async function POST() {
  try {
    // 보안: 폴더 존재 확인
    if (!fs.existsSync(UPLOAD_FOLDER)) {
      fs.mkdirSync(UPLOAD_FOLDER, { recursive: true })
    }

    // Windows 탐색기로 폴더 열기
    const folderPath = UPLOAD_FOLDER.replace(/\//g, "\\")

    // 보안: execFile로 커맨드 인젝션 방지
    await execFileAsync("explorer", [folderPath])

    return Response.json({ success: true, message: "폴더 열림" })
  } catch (e) {
    console.error("[폴더 열기] 오류:", e)
    return Response.json({ error: "폴더 열기 실패" }, { status: 500 })
  }
}
