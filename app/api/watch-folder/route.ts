import fs from "fs"
import path from "path"

const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER_PATH ||
  "C:/Users/tara0/ReadVoice_Upload"

export async function GET() {
  try {
    // 폴더 없으면 자동 생성
    if (!fs.existsSync(UPLOAD_FOLDER)) {
      fs.mkdirSync(UPLOAD_FOLDER, { recursive: true })
    }

    const files = fs.readdirSync(UPLOAD_FOLDER)
      .filter(f => {
        // 숨김 파일 제외
        if (f.startsWith('.')) return false
        // 파일인지 확인
        const fullPath = path.join(UPLOAD_FOLDER, f)
        return fs.statSync(fullPath).isFile()
      })
      .map(f => ({
        name: f,
        path: path.join(UPLOAD_FOLDER, f),
        modified: fs.statSync(path.join(UPLOAD_FOLDER, f)).mtime
      }))
      .sort((a, b) => b.modified.getTime() - a.modified.getTime())

    return Response.json({ files, folder: UPLOAD_FOLDER })
  } catch (e) {
    return Response.json({ error: "폴더 접근 실패", files: [] })
  }
}
