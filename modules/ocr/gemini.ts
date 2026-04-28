// 이미지 묘사 모델 순서 (PDF OCR 제외, 이미지 describe 전용)
// 1. gemma4:e2b (빠름, 5~20초)
// 2. gemma4:e4b (균형, 20~40초)
// 3. llama3.2-vision (정밀, 2~3분, 사용자 직접 선택 시만)

// 한국어 직접 출력 가능 모델
const KOREAN_NATIVE_MODELS = [
  "gemma4:e2b",
  "gemma4:e4b",
  "qwen3.5:9b"
]

// 번역 필요 모델 (이미지 묘사 전용, PDF OCR 제외)
const NEEDS_TRANSLATION_MODELS = [
  "llama3.2-vision:11b-instruct-q4_K_M"
]

// 통합 프롬프트 (모든 모델 공통)
const UNIFIED_PROMPT = `이 이미지를 한국어로 분석해줘.

1. 이미지 속 텍스트: 보이는 모든 글자, 숫자, 기호
2. 주요 인물: 의상, 자세, 표정, 양손에 든 것
3. 주변 인물이나 동물: 있으면 상세히, 없으면 "없음"
4. 배경: 하늘, 건물, 자연, 조명 색감
5. 전체적인 색감과 분위기

반드시 한국어로만 답해줘. 영어 금지.`

// 영어 프롬프트 (llama, glm용 - 번역 필요)
const ENGLISH_PROMPT = `Describe this image in vivid detail.
Order: 1.Text in image 2.Main subject 3.Clothing/colors 4.Background 5.Atmosphere
Rules: No conclusions. Be specific.`

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
    .replace(/\bcharacter\b/gi, "인물")
    .replace(/\bfigure\b/gi, "형상")
    .replace(/\bperson\b/gi, "사람")
    .replace(/\bwoman\b/gi, "여성")
    .replace(/\bman\b/gi, "남성")
    .replace(/\bchild\b/gi, "아이")
    .replace(/\bbuilding\b/gi, "건물")
    .replace(/\bmountain\b/gi, "산")
    .replace(/\briver\b/gi, "강")
    .replace(/\bocean\b/gi, "바다")
    .replace(/\bsky\b/gi, "하늘")
    .replace(/\bcloud\b/gi, "구름")
    .replace(/\bsun\b/gi, "태양")
    .replace(/\bmoon\b/gi, "달")
    .replace(/\bstar\b/gi, "별")
    .replace(/\btree\b/gi, "나무")
    .replace(/\bflower\b/gi, "꽃")
    .replace(/\bbird\b/gi, "새")
    .replace(/\banimal\b/gi, "동물")
    .replace(/\bwearing\b/gi, "입고 있는")
    .replace(/\bholding\b/gi, "들고 있는")
    .replace(/\bstanding\b/gi, "서있는")
    .replace(/\bsitting\b/gi, "앉아있는")
    .replace(/\bwalking\b/gi, "걷고 있는")
    .replace(/\blooking\b/gi, "보고 있는")
    .replace(/\bsmiling\b/gi, "미소 짓는")
    .replace(/\bbeautiful\b/gi, "아름다운")
    .replace(/\bserene\b/gi, "고요한")
    .replace(/\bpeaceful\b/gi, "평화로운")
    .replace(/\bcolorful\b/gi, "화려한")
    .replace(/\bbright\b/gi, "밝은")
    .replace(/\bdark\b/gi, "어두운")
    .replace(/\bwarm\b/gi, "따뜻한")
    .replace(/\bcool\b/gi, "시원한")
    .replace(/\boutfit\b/gi, "의상")
    .replace(/\bposture\b/gi, "자세")
    .replace(/\bexpression\b/gi, "표정")
    .replace(/\bjoyful\b/gi, "기쁜")
    .replace(/\bmajestic\b/gi, "웅장한")
    .replace(/\blandscape\b/gi, "풍경")
    .replace(/\btraditional\b/gi, "전통적인")
    .replace(/\bcontrast\b/gi, "대비")
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
        prompt: `아래 영어를 자연스러운 한국어로만 번역해 주세요.

반드시 지켜주세요:
- 한국어로만 출력
- 영어 단어 절대 사용 금지
- 자연스러운 일상 한국어로
- '파일명: ${fileName}' 으로 시작

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
    } else {
      console.log("[번역] EXAONE 한국어 부족:", koreanCount, "→ Claude로 전환")
    }
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
            content: `아래 영어를 자연스러운 한국어로만 번역해 주세요.

반드시 지켜주세요:
- 한국어로만 출력
- 영어 단어 절대 사용 금지
- 자연스러운 일상 한국어로
- '파일명: ${fileName}' 으로 시작

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
): Promise<{ korean: string; english: string }> {
  const name = fileName || "이미지"
  const base64 = buffer.toString("base64")
  const model = selectedModel || "gemma4:e2b"

  const isKoreanNative = KOREAN_NATIVE_MODELS.includes(model)
  const prompt = isKoreanNative ? UNIFIED_PROMPT : ENGLISH_PROMPT

  console.log(`[Vision] 모델: ${model}, 한국어직접: ${isKoreanNative}`)

  // Ollama health check
  try {
    await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    throw new Error("Ollama 서버가 실행 중이지 않아요.")
  }

  const timeouts: Record<string, number> = {
    "gemma4:e2b": 60000,
    "gemma4:e4b": 120000,
    "qwen3.5:9b": 180000,
    "llama3.2-vision:11b-instruct-q4_K_M": 600000,
  }
  const timeout = timeouts[model] || 120000

  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [base64],
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(timeout),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    let result = data.message?.content?.trim()

    if (!result || result.length < 10) {
      throw new Error("분석 결과가 없어요.")
    }

    console.log(`[Vision] ${model} 성공 (${result.length}자)`)

    // 한국어 직접 출력 모델은 번역 불필요
    if (isKoreanNative) {
      // 영어 단어 후처리만 적용
      result = removeEnglishWords(result)
      const finalText = `파일명: ${name}\n\n${result}`
      // 한국어 직접 출력이므로 original은 빈 문자열
      return { korean: finalText, english: "" }
    }

    // 번역 필요 모델은 번역 진행
    console.log(`[Vision] 번역 시작...`)
    const korean = await translateToKorean(result, name)
    return { korean, english: result }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${model} 분석 실패: ${msg}`)
  }
}
