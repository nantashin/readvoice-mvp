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

function hasEnglish(text: string): boolean {
  const englishWords = text.match(/\b[a-zA-Z]{3,}\b/g) || []
  return englishWords.length > 5
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
        prompt: `다음 영어 이미지 설명을 자연스러운 한국어로 번역해줘.

규칙:
1. '파일명: ${fileName}' 으로 시작
2. 섹션 구조 유지하되 자연스러운 한국어로
3. 텍스트 섹션에서 이미지 속 글자는 원문 그대로 인용
4. 배경 묘사 절대 생략 금지
5. 시각장애인이 눈앞에 그림이 그려지도록 생생하게

영어 설명: ${text}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    const result = data.response?.trim()
    const koreanCount = (result?.match(/[가-힣]/g) || []).length
    if (result && koreanCount > 5 && !hasEnglish(result)) {
      console.log("[번역] EXAONE 성공")
      return result
    }
    console.log("[번역] EXAONE 한국어 부족 또는 영어 잔존, Claude로 전환")
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
          content: `다음 영어 이미지 설명을 자연스러운 한국어로 번역해줘.

규칙:
1. '파일명: ${fileName}' 으로 시작
2. 섹션 구조 유지하되 자연스러운 한국어로
3. 텍스트 섹션에서 이미지 속 글자는 원문 그대로 인용
4. 배경 묘사 절대 생략 금지
5. 시각장애인이 눈앞에 그림이 그려지도록 생생하게

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

  // moondream 프롬프트
  const moondreamPrompt = `Describe this image in detail for a blind person.
List ALL text visible first, then describe the scene,
people, colors, objects, and background.`

  // qwen2.5vl 프롬프트 (OCR 특화)
  const qwen2_5vlPrompt = `You are an expert OCR and image description system.
STEP 1 - READ ALL TEXT: Extract every single character,
word, number, symbol visible in this image exactly as written.
List from top-left to bottom-right.
STEP 2 - DESCRIBE SCENE: Full visual description including
people, clothing, colors, background, atmosphere.
Be extremely detailed. Output in English.`

  // gemma3 프롬프트
  const gemma3Prompt = `Analyze this image completely for a visually impaired person.
First: transcribe ALL visible text exactly.
Then: describe people, objects, colors, background, and mood
in vivid detail so the person can visualize it clearly.`

  // llama3.2-vision 프롬프트
  const llamaVisionPrompt = `You are an expert image describer for visually impaired people.
Analyze this image with maximum detail.

Provide a structured description:

SECTION 1 - ALL TEXT IN IMAGE:
Read every word, number, and character visible, top to bottom,
left to right. Quote them exactly.

SECTION 2 - SCENE OVERVIEW:
What type of image is this? What is the overall composition?

SECTION 3 - PEOPLE & CHARACTERS:
For each person: age appearance, clothing details, colors,
accessories, posture, facial expression, what they are doing

SECTION 4 - OBJECTS & DETAILS:
List every significant object with its position and description

SECTION 5 - BACKGROUND & SETTING:
Describe the complete background - sky, environment,
buildings, nature, time of day, weather if visible

SECTION 6 - COLORS & LIGHTING:
Describe the color palette and lighting conditions

SECTION 7 - ATMOSPHERE:
What feeling or story does this image convey?

Be thorough. Leave nothing out.`

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
      // 모델별 프롬프트 선택
      let prompt = moondreamPrompt
      if (model === "qwen2.5vl:7b") {
        prompt = qwen2_5vlPrompt
      } else if (model === "gemma3:4b") {
        prompt = gemma3Prompt
      } else if (model === "llama3.2-vision:11b-instruct-q4_K_M") {
        prompt = llamaVisionPrompt
      }
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
              text: `당신은 시각장애인을 위한 이미지 설명 전문가입니다.
이 이미지를 머릿속에 완전히 그릴 수 있도록 상세히 설명해주세요.

반드시 아래 순서로 설명하세요:

1. 이미지 속 모든 텍스트:
   보이는 모든 글자, 숫자, 기호를 위에서 아래로 정확히 읽기

2. 전체 구도:
   이미지의 전반적인 구성과 종류

3. 인물/캐릭터:
   각 인물의 의상 색상과 스타일, 자세, 표정, 머리 스타일,
   소품, 하고 있는 행동을 구체적으로

4. 사물과 소품:
   눈에 띄는 모든 사물과 위치

5. 배경:
   하늘, 건물, 자연환경, 빛의 방향, 시간대, 색감을 구체적으로

6. 색상:
   주요 색상들과 전체적인 색감

7. 분위기:
   이 이미지가 전달하는 감정과 이야기

파일명 ${name}의 이미지입니다.
배경 묘사를 절대 생략하지 마세요.`,
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
