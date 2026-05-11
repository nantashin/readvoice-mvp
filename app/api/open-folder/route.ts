import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER_PATH || "C:/Users/tara0/ReadVoice_Upload"

export async function POST() {
  try {
    // Windows 탐색기로 폴더 열기
    const folderPath = UPLOAD_FOLDER.replace(/\//g, "\\")
    await execAsync(`explorer "${folderPath}"`)

    return Response.json({ success: true, message: "폴더 열림" })
  } catch (e) {
    console.error("[폴더 열기] 오류:", e)
    return Response.json({ error: "폴더 열기 실패" }, { status: 500 })
  }
}
