export interface FileValidation {
  isPDF: boolean
  isImage: boolean
  isValid: boolean
  errorMessage?: string
}

const ACCEPT = ".png,.jpg,.jpeg,.pdf"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function validateFile(file: File): FileValidation {
  const isPDF =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")

  const isImage = file.type.startsWith("image/")

  if (!isImage && !isPDF) {
    return {
      isPDF: false,
      isImage: false,
      isValid: false,
      errorMessage: "지원하지 않는 파일 형식입니다. JPG, PNG, WEBP, PDF만 지원합니다.",
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isPDF,
      isImage,
      isValid: false,
      errorMessage: "파일 크기는 10MB 이하여야 합니다.",
    }
  }

  return {
    isPDF,
    isImage,
    isValid: true,
  }
}

export { ACCEPT, MAX_FILE_SIZE }
