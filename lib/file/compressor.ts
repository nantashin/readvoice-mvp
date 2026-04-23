const MAX_SIZE = 800 * 1024 // 800KB
const MAX_PX = 1920

interface ImageDimensions {
  width: number
  height: number
}

function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number,
  maxPx: number
): ImageDimensions {
  const ratio = originalWidth / originalHeight
  let width = originalWidth
  let height = originalHeight

  if (width > height && width > maxPx) {
    // 가로가 긴 이미지
    width = maxPx
    height = Math.round(maxPx / ratio)
  } else if (height > width && height > maxPx) {
    // 세로가 긴 이미지
    height = maxPx
    width = Math.round(maxPx * ratio)
  } else if (width === height && width > maxPx) {
    // 정사각형
    width = maxPx
    height = maxPx
  }

  return { width, height }
}

function compressCanvasImage(
  canvas: HTMLCanvasElement,
  maxSize: number
): string {
  let quality = 0.85
  let result = canvas.toDataURL("image/jpeg", quality)

  while (result.length * 0.75 > maxSize && quality > 0.5) {
    quality -= 0.1
    result = canvas.toDataURL("image/jpeg", quality)
  }

  return result
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.src = url
  })
}

export async function compressImage(file: File): Promise<string> {
  // 800KB 이하: 원본 그대로
  if (file.size <= MAX_SIZE) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        resolve((e.target?.result as string).split(",")[1])
      }
      reader.readAsDataURL(file)
    })
  }

  // 800KB 초과: 압축
  const img = await loadImage(file)
  const originalWidth = img.naturalWidth
  const originalHeight = img.naturalHeight
  const dims = calculateImageDimensions(originalWidth, originalHeight, MAX_PX)

  const canvas = document.createElement("canvas")
  canvas.width = dims.width
  canvas.height = dims.height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, dims.width, dims.height)

  const result = compressCanvasImage(canvas, MAX_SIZE)

  console.log(
    `[이미지] 원본: ${(file.size / 1024).toFixed(0)}KB`,
    `→ 압축: ${(result.length * 0.75 / 1024).toFixed(0)}KB`,
    `비율: ${originalWidth}x${originalHeight} → ${dims.width}x${dims.height}`
  )

  return result.split(",")[1]
}
