const MAX_SIZE = 2 * 1024 * 1024  // 2MB (800KB → 2MB로 변경)
const MIN_PX = 1200  // 작은 이미지 스케일업 기준

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
  const img = await loadImage(file)
  let { naturalWidth: w, naturalHeight: h } = img

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  // 작은 이미지 스케일업 (최소 1200px)
  if (w < MIN_PX && h < MIN_PX) {
    const scale = MIN_PX / Math.max(w, h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
    console.log(`[이미지] 스케일업: ${img.naturalWidth}x${img.naturalHeight} → ${w}x${h}`)
  }

  canvas.width = w
  canvas.height = h
  ctx.drawImage(img, 0, 0, w, h)

  let quality = 0.95
  let result = canvas.toDataURL("image/jpeg", quality)

  // 2MB 초과 시 품질 낮춤
  while (result.length * 0.75 > MAX_SIZE && quality > 0.5) {
    quality -= 0.05
    result = canvas.toDataURL("image/jpeg", quality)
  }

  const finalSize = result.length * 0.75

  console.log(
    `[이미지] 원본: ${(file.size / 1024).toFixed(0)}KB`,
    `→ 최종: ${(finalSize / 1024).toFixed(0)}KB`,
    `크기: ${w}x${h}, 품질: ${(quality * 100).toFixed(0)}%`
  )

  return result.split(",")[1]
}
