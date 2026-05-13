import fs from "fs"
import path from "path"
import { NextRequest } from "next/server"

const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER_PATH || "C:/Users/tara0/ReadVoice_Upload"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const fileName = searchParams.get("file")

    if (!fileName) {
      return Response.json({ error: "파일명이 필요합니다" }, { status: 400 })
    }

    const uploadFolderResolved = path.resolve(UPLOAD_FOLDER)
    const filePath = path.resolve(uploadFolderResolved, fileName)
    const relativePath = path.relative(uploadFolderResolved, filePath)

    // 보안: 경로 이탈 방지 (상위 디렉토리 접근 차단)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      console.error("[read-file] 경로 이탈 감지:", { filePath, uploadFolderResolved, relativePath })
      return Response.json({ error: "잘못된 파일 경로" }, { status: 403 })
    }

    if (!fs.existsSync(filePath)) {
      return Response.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 })
    }

    // 보안: 파일 크기 제한 (10MB)
    const stats = fs.statSync(filePath)
    const sizeInMB = stats.size / (1024 * 1024)
    if (sizeInMB > 10) {
      return Response.json({
        error: "파일 크기가 너무 큽니다 (최대 10MB)",
        size: `${sizeInMB.toFixed(2)}MB`
      }, { status: 413 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    const base64 = fileBuffer.toString("base64")
    const ext = path.extname(fileName).toLowerCase()
    const mimeTypes: Record<string, string> = {
      // 이미지
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      // 문서
      ".pdf": "application/pdf",
      ".txt": "text/plain",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      // 기타
      ".json": "application/json",
      ".xml": "application/xml",
      ".csv": "text/csv"
    }
    const mimeType = mimeTypes[ext] || "application/octet-stream"

    return Response.json({
      fileName,
      mimeType,
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`
    })
  } catch (e) {
    console.error("[read-file] 에러:", e)
    return Response.json({ error: "파일 읽기 실패" }, { status: 500 })
  }
}
