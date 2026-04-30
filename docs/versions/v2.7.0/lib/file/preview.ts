export type PreviewType = "image" | "pdf" | ""

export interface PreviewInfo {
  url: string
  type: PreviewType
}

export function createPreview(file: File, isPDF: boolean, isImage: boolean): PreviewInfo {
  if (isImage) {
    return {
      url: URL.createObjectURL(file),
      type: "image",
    }
  }

  if (isPDF) {
    return {
      url: "",
      type: "pdf",
    }
  }

  return {
    url: "",
    type: "",
  }
}

export function cleanupPreview(url: string): void {
  if (url) {
    URL.revokeObjectURL(url)
  }
}
