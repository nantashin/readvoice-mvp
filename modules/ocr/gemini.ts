const VISION_PROMPT = `Describe this image vividly and in detail.
Cover these in order:
1. All text visible in the image (read exactly as written)
2. Main subject and what they are doing
3. Clothing, colors, accessories in detail
4. Background and environment
5. Colors and lighting
6. Overall atmosphere

Do NOT add conclusions or summaries at the end.
Pure description only.`

function removeEnglishWords(text: string): string {
  return text
    .replace(/\bsilhouette\b/gi, "실루엣")
    .replace(/\bskyline\b/gi, "스카이라인")
    .replace(/\bkimono\b/gi, "기모노")
    .replace(/\bcrescent\b/gi, "초승달")
    .replace(/\bpagoda\b/gi, "탑")
    .replace(/\bforeground\b/gi, "전경")
    .replace(/\bbackground\b/gi, "배경")
    .replace(/\batmosphere\b/gi, "분위기")
    .replace(/\btranquility\b/gi, "평온함")
    .replace(/\bvibrant\b/gi, "생동감 있는")
    .replace(/\belegant\b/gi, "우아한")
    .replace(/\bmystic(al)?\b/gi, "신비로운")
    .replace(/\bdynamic\b/gi, "역동적인")
    .replace(/\bharmony\b/gi, "조화")
    .replace(/\bsymbol(ic)?\b/gi, "상징적인")
    .replace(/\bornate\b/gi, "화려한")
    .replace(/\bintricat(e|ely)\b/gi, "정교한")
    .replace(/\bfloating\b/gi, "떠있는")
    .replace(/\bglowing\b/gi, "빛나는")
    .replace(/\bshimmering\b/gi, "반짝이는")
    .replace(/[A-Za-z]{4,}\b/g, (match) => {
      console.log("[후처리] 영어 단어 발견:", match)
      return match
    })
}

async function translateToKorean(
  englishText: string,
  fileName: string
): Promise<string> {
  // EXAONE으로 번역 시도
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "exaone3.5:2.4b",
        prompt: `다음 영어를 한국어로만 번역해줘.

출력 형식:
파일명: ${fileName}

설명:
[번역 내용만]

절대 금지:
- 규칙 목록 출력 금지
- 체크리스트 출력 금지
- "빈 줄 없음", "줄바꿈 사용" 같은 메타 텍스트 금지
- 번역 내용만 출력

번역:
${englishText}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    let result = data.response?.trim()
    const koreanCount = (result?.match(/[가-힣]/g) || []).length
    if (result && koreanCount > 20) {
      console.log("[번역] EXAONE 성공, 한국어 글자수:", koreanCount)
      result = removeEnglishWords(result)
      return result
    }
    console.log("[번역] EXAONE 한국어 부족:", koreanCount, "→ Claude로 전환")
  } catch (e) {
    console.log("[번역] EXAONE 실패:", e)
  }

  // Claude API로 번역
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === "your-key-here") throw new Error("API 키 없음")

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `다음 영어를 한국어로만 번역해줘.

출력 형식:
파일명: ${fileName}

설명:
[번역 내용만]

절대 금지:
- 규칙 목록 출력 금지
- 체크리스트 출력 금지
- "빈 줄 없음", "줄바꿈 사용" 같은 메타 텍스트 금지
- 번역 내용만 출력

번역:
${englishText}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    let result = data.content?.[0]?.text
    if (result) {
      console.log("[번역] Claude 성공")
      result = removeEnglishWords(result)
      return result
    }
  } catch (e) {
    console.log("[번역] Claude 실패:", e)
  }

  // 최후 수단: 그냥 파일명만 붙여서 반환
  return `파일명: ${fileName}\n\n설명:\n${englishText}`
}

export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  selectedModel?: string
): Promise<string> {
  const name = fileName || "이미지"
  const base64 = buffer.toString("base64")

  const modelList = selectedModel
    ? [selectedModel]
    : ["moondream", "gemma3:4b", "qwen2.5vl:7b", "llama3.2-vision:11b-instruct-q4_K_M"]

  const timeouts: Record<string, number> = {
    moondream: 30000,
    "gemma3:4b": 60000,
    "qwen2.5vl:7b": 180000,
    "llama3.2-vision:11b-instruct-q4_K_M": 300000,
  }

  // Ollama 연결 확인
  try {
    await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new Error("Ollama 서버가 실행 중이지 않습니다.")
  }

  for (const model of modelList) {
    try {
      console.log(`[Vision] 시도: ${model}`)
      const timeout = timeouts[model] || 60000

      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeout),
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: VISION_PROMPT,
              images: [base64],
            },
          ],
          stream: false,
        }),
      })

      if (!res.ok) {
        console.error(`[Vision] HTTP 오류 ${res.status}`)
        continue
      }

      const data = await res.json()
      const englishResult = data.message?.content?.trim()

      if (!englishResult || englishResult.length < 20) {
        console.log(`[Vision] ${model} 빈 결과`)
        continue
      }

      console.log(`[Vision] ${model} 성공, 번역 시작`)
      const korean = await translateToKorean(englishResult, name)
      return korean
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Vision] 실패 ${model}:`, message)
    }
  }

  throw new Error(
    "이미지 분석 실패. 다른 모델을 선택하거나 다시 시도해 주세요."
  )
}
