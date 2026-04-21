import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434"

// 모델별 타임아웃 설정
const MODEL_TIMEOUTS: Record<string, number> = {
  moondream: 30000, // 30초
  "llava": 60000, // 60초
  "llama3.2-vision:11b-instruct-q4_K_M": 180000, // 180초 (3분)
  translate: 30000, // 번역: 30초
}

type VisionModel = "moondream" | "llama-vision-q4" | "claude-haiku"

function isValidApiKey(key: string | undefined): boolean {
  if (!key) return false
  if (key === "your-key-here" || key === "your-anthropic-key-here") {
    return false
  }
  return key.length > 20
}

// 1단계: Ollama Vision (영어로 이미지 묘사)
async function describeImageInEnglish(
  buffer: Buffer,
  model: "moondream" | "llama3.2-vision:11b-instruct-q4_K_M"
): Promise<string | null> {
  try {
    const modelName = model === "moondream" ? "Moondream" : "Llama Vision Q4"
    console.log(`[OCR] Step 1: Describing image in English with ${modelName}...`)
    const base64Image = buffer.toString("base64")
    const timeout_ms = MODEL_TIMEOUTS[model] || 30000

    const prompt = `Describe this image in detail.
Include: people, clothing, colors, background,
objects, mood, and atmosphere.
Be thorough and descriptive.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout_ms)

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [base64Image],
          },
        ],
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.message?.content?.trim()

    if (!text) {
      throw new Error("Empty response from Ollama Vision")
    }

    console.log(`[OCR] ✓ Step 1 succeeded (${modelName})`)
    return text
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const modelName = model === "moondream" ? "Moondream" : "Llama Vision Q4"
    console.error(`[OCR] ✗ Step 1 failed (${modelName}):`, error)
    return null
  }
}

// 결과가 영어인지 확인 (간단한 휴리스틱)
function isEnglish(text: string): boolean {
  const englishWords = ["the", "a", "and", "is", "are", "in", "on", "at", "to", "of", "with"]
  const words = text.toLowerCase().split(/\s+/)
  const englishCount = words.filter(w => englishWords.includes(w)).length
  return englishCount > 2
}

// 2단계: Ollama LLM (한국어 번역)
async function translateToKorean(
  englishDescription: string,
  fileName: string
): Promise<string | null> {
  try {
    console.log("[OCR] Step 2: Translating to Korean with EXAONE...")
    const timeout_ms = MODEL_TIMEOUTS.translate

    const prompt = `다음 영어 이미지 설명을 한국어로 번역해줘.
반드시 '이것은 ${fileName} 이미지입니다.'로 시작하고
이미지 내용을 자연스러운 한국어로 설명해줘.
영어는 절대 포함하지 마.

영어 설명: ${englishDescription}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout_ms)

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "exaone3.5:2.4b",
        prompt: prompt,
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.response?.trim()

    if (!text) {
      throw new Error("Empty response from EXAONE")
    }

    console.log("[OCR] ✓ Step 2 succeeded (Korean translation)")
    return text
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[OCR] ✗ Step 2 failed: ${errorMsg}`)
    return null
  }
}

// Step 2 실패 시 직접 한국어 Vision 재시도
async function describeImageInKorean(
  buffer: Buffer,
  fileName: string
): Promise<string | null> {
  try {
    console.log("[OCR] Step 2-Fallback: Describing image directly in Korean...")
    const base64Image = buffer.toString("base64")
    const timeout_ms = MODEL_TIMEOUTS.translate

    const prompt = `이 이미지를 한국어로 상세히 설명해줘.
반드시 '이것은 ${fileName} 이미지입니다.'로 시작해.
사람, 옷, 색상, 배경, 물건, 분위기를 모두 포함해서 설명해줘.
자연스러운 한국어로 작성해.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout_ms)

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2-vision:11b-instruct-q4_K_M",
        messages: [
          {
            role: "user",
            content: prompt,
            images: [base64Image],
          },
        ],
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.message?.content?.trim()

    if (!text) {
      throw new Error("Empty response from Llama Vision")
    }

    console.log("[OCR] ✓ Step 2-Fallback succeeded (direct Korean Vision)")
    return text
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[OCR] ✗ Step 2-Fallback failed: ${errorMsg}`)
    return null
  }
}

export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string,
  fileName: string = "이미지",
  preferredModel: VisionModel = "moondream"
): Promise<string> {
  console.log(`[OCR] Using model preference: ${preferredModel}`)
  console.log(`[OCR] Ollama base URL: ${OLLAMA_BASE_URL}`)
  console.log(`[OCR] Processing: Vision → Korean Translation`)

  const cleanFileName = fileName.replace(/\.[^/.]+$/, "") || "이미지"

  // Step 1: Vision (영어 묘사)
  let result: string | null = null

  if (preferredModel === "moondream" || preferredModel === "claude-haiku") {
    // Moondream 먼저 시도
    result = await describeImageInEnglish(buffer, "moondream")
    if (!result) {
      // Llama Vision Q4 시도
      result = await describeImageInEnglish(buffer, "llama3.2-vision:11b-instruct-q4_K_M")
    }
    if (!result) {
      // Claude fallback
      try {
        console.log("[OCR] Step 1: Using Claude Haiku as fallback...")
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType as
                      | "image/jpeg"
                      | "image/png"
                      | "image/gif"
                      | "image/webp",
                    data: buffer.toString("base64"),
                  },
                },
                {
                  type: "text",
                  text: `Describe this image in detail.
Include: people, clothing, colors, background,
objects, mood, and atmosphere.
Be thorough and descriptive.`,
                },
              ],
            },
          ],
        })
        result =
          response.content[0].type === "text"
            ? response.content[0].text.trim()
            : null
        if (result) {
          console.log("[OCR] ✓ Step 1 succeeded (Claude Haiku)")
        }
      } catch (e) {
        console.error("[OCR] ✗ Step 1 Claude fallback failed:", e)
      }
    }
  }

  // Step 1 실패 시 예외 발생
  if (!result) {
    throw new Error("이미지 분석 실패. Ollama Vision이 실행 중인지 확인하세요.")
  }

  // Step 2: 한국어 강제 (영어면 번역)
  if (isEnglish(result)) {
    console.log("[OCR] Step 2: English detected, translating to Korean...")
    let koreanResult = await translateToKorean(result, cleanFileName)

    // 번역 실패 시 Step 2-Fallback: 직접 한국어 Vision
    if (!koreanResult) {
      console.log("[OCR] Step 2 translation failed, trying Step 2-Fallback...")
      koreanResult = await describeImageInKorean(buffer, cleanFileName)
    }

    // 모두 실패 시 예외
    if (!koreanResult) {
      throw new Error("한국어 이미지 설명 생성 실패. 나중에 다시 시도해주세요.")
    }

    return koreanResult
  }

  // 이미 한국어면 그대로 반환
  console.log("[OCR] ✓ Result already in Korean")
  return result
}
