import Anthropic from "@anthropic-ai/sdk"

const OLLAMA_URL = "http://localhost:11434/api/chat"

async function callOllamaVision(
  model: string,
  base64: string,
  prompt: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt, images: [base64] }],
        stream: false,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const text = data.message?.content || data.response || ""
    if (!text) throw new Error("빈 응답")
    return text
  } finally {
    clearTimeout(timer)
  }
}

async function translateToKorean(
  text: string,
  fileName: string
): Promise<string> {
  // EXAONE 시도
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "exaone3.5:2.4b",
        prompt: `다음 영어 이미지 설명을 한국어로 번역해줘.

규칙:
1. 반드시 '파일명: ${fileName}'으로 시작
2. 이미지에서 보이는 모든 텍스트를 정확히 그대로 인용
3. 텍스트 → 인물/사물 → 배경 순서로 설명
4. 자연스러운 한국어로 작성

영어 설명: ${text}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    const result = data.response?.trim()
    const koreanCount = (result?.match(/[가-힣]/g) || []).length
    if (result && koreanCount > 5) {
      console.log("[번역] EXAONE 성공")
      return result
    }
    console.log("[번역] EXAONE 한국어 부족, Claude로 전환")
  } catch (e) {
    console.log("[번역] EXAONE 실패:", e)
  }

  // Claude API 번역
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `다음 영어 이미지 설명을 한국어로 번역해줘.

규칙:
1. 반드시 '파일명: ${fileName}'으로 시작
2. 이미지에서 보이는 모든 텍스트를 정확히 그대로 인용
3. 텍스트 → 인물/사물 → 배경 순서로 설명
4. 자연스러운 한국어로 작성

영어 설명: ${text}`,
        },
      ],
    })
    console.log("[번역] Claude 성공")
    return res.content[0].type === "text" ? res.content[0].text : text
  } catch (e) {
    console.log("[번역] Claude 실패")
    return `파일명: ${fileName}. ${text}`
  }
}

export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  selectedModel?: string
): Promise<string> {
  const name = fileName || "이미지"
  const base64 = buffer.toString("base64")

  // Vision 프롬프트
  const generalPrompt = `You are analyzing an image for a visually impaired person.
IMPORTANT: Start your response with the filename immediately.
Format: Start with 'The filename is ${name}.' as the FIRST sentence.

Then describe in order:
1. Any text visible in the image (read ALL text exactly as written, top to bottom)
2. Main subject and people
3. Colors, clothing, objects
4. Background and setting
5. Overall mood

Be precise about text - read every word, number, and character you can see.`

  // OCR 전용 프롬프트 (llava, llama3.2-vision)
  const ocrPrompt = `Read and transcribe ALL text visible in this image exactly as written.
Include: numbers, letters, Korean characters, symbols.
List them from top to bottom, left to right.
Then describe the visual content.

Image filename: ${name}`

  const models =
    selectedModel && selectedModel !== "claude"
      ? [selectedModel]
      : ["moondream", "llava:7b-v1.5-q4_K_M", "llama3.2-vision:11b-instruct-q4_K_M"]

  const timeouts: Record<string, number> = {
    moondream: 30000,
    "llava:7b-v1.5-q4_K_M": 60000,
    "llama3.2-vision:11b-instruct-q4_K_M": 180000,
  }

  for (const model of models) {
    try {
      console.log(`[Vision] 시도: ${model}`)
      const timeout = timeouts[model] || 60000
      // llava, llama3.2-vision은 OCR 프롬프트, 나머지는 일반 프롬프트
      const isOcrModel = model === "llava:7b-v1.5-q4_K_M" || model === "llama3.2-vision:11b-instruct-q4_K_M"
      const prompt = isOcrModel ? ocrPrompt : generalPrompt
      const englishResult = await callOllamaVision(
        model,
        base64,
        prompt,
        timeout
      )
      console.log(`[Vision] 성공: ${model}`)
      const korean = await translateToKorean(englishResult, name)
      return korean
    } catch (e: any) {
      console.error(`[Vision] 실패 ${model}:`, e.message)
    }
  }

  // 모든 Ollama 실패 시 Claude API
  try {
    console.log("[Vision] Claude API 시도")
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    const res = await client.messages.create({
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
                  | "image/webp"
                  | "image/gif",
                data: base64,
              },
            },
            {
              type: "text",
              text: `파일명: ${name}

이 이미지를 시각장애인을 위해 한국어로 자세히 설명해줘.
순서:
1. 이미지에서 보이는 모든 텍스트 (정확히 그대로)
2. 주요 대상과 인물
3. 색상, 옷, 사물
4. 배경과 환경
5. 전체 분위기`,
            },
          ],
        },
      ],
    })
    return res.content[0].type === "text" ? res.content[0].text : "분석 실패"
  } catch (e: any) {
    console.error("[Vision] Claude API 실패:", e.message)
    throw new Error("이미지 분석에 실패했습니다.")
  }
}
