// 이미지 묘사 모델 순서 (PDF OCR 제외, 이미지 describe 전용)
// 1. gemma4:e2b (빠름, 5~20초)
// 2. gemma4:e4b (균형, 20~40초)
// 3. llama3.2-vision (정밀, 2~3분, 사용자 직접 선택 시만)

// 한국어 직접 출력 가능 모델
const KOREAN_NATIVE_MODELS = [
  "gemma4:e2b",
  "gemma4:e4b",
  "qwen3.5:9b",
  "richardyoung/olmocr2:7b-q8",
  "glm-ocr"
]

// 번역 필요 모델 (이미지 묘사 전용, PDF OCR 제외)
const NEEDS_TRANSLATION_MODELS = [
  "llama3.2-vision:11b-instruct-q4_K_M"
]

// 통합 프롬프트 (gemma4:e2b, qwen3.5용)
const UNIFIED_PROMPT = `이 이미지를 한국어로 분석해줘.

0. 먼저 제일 큰 것부터:
   - 가장 큰 이미지나 캐릭터가 있으면 먼저 설명
   - 가장 큰 글씨(제목)가 있으면 먼저 읽기

1. 이미지 속 텍스트 (큰 글씨→작은 글씨 순):
   - 화면 중앙 상단 제목 우선
   - 이후 왼쪽→오른쪽, 위→아래 순서
   - <>, <<>>, [], {} 같은 기호는 빼고 안의 텍스트만 읽기
   - 화살표(→, ⇒)나 연결선이 있으면 연결된 내용을 이어서 읽기

2. 주요 인물: 의상, 자세, 표정, 양손에 든 것
3. 주변 인물이나 동물: 있으면 상세히 설명 (없으면 이 항목 생략)
4. 배경: 하늘, 건물, 자연, 조명 색감
5. 전체적인 색감과 분위기

6. 이미지 요약: 큰 제목과 위 내용을 바탕으로 이 이미지가 무엇인지 한 문장으로 요약

주의사항:
- 연계선(→, ⇒, 선)으로 연결된 항목은 관계가 있으므로 연결해서 읽기
- 이미지와 텍스트가 상하로 붙어있으면 함께 설명
- "없음"이라고 답할 항목은 아예 건너뛰기
- 반드시 한국어로만 답해줘. 영어 금지.`

// gemma4:e4b 전용 프롬프트 (Claude Vision 스타일)
const GEMMA4_E4B_PROMPT = `이 이미지를 보고 아래 순서대로 한국어로 상세히 설명해줘.
영어는 절대 사용하지 마. 모든 내용을 자연스러운 한국어로만 써줘.

0. 먼저 제일 큰 것부터:
   - 가장 큰 이미지나 캐릭터가 있으면 먼저 설명
   - 가장 큰 글씨(제목)가 있으면 먼저 읽기 (크기와 위치 언급: "화면 중앙 상단에 큰 글씨로...")

1. 텍스트 (큰 글씨→작은 글씨 순):
   - 화면 중앙 상단 제목 우선
   - 이후 왼쪽→오른쪽, 위→아래 순서
   - <>, <<>>, [], {} 같은 기호는 빼고 안의 텍스트만 읽기
   - 화살표(→, ⇒)나 연결선이 있으면 연결된 내용을 이어서 읽기
   - 이미지와 텍스트가 상하로 붙어있으면 함께 설명 (예: "강아지 사진 아래 '귀여워'")

2. 주요 인물: 인물이 있다면 외모, 의상, 자세, 표정을 구체적으로 설명 (없으면 이 항목 생략)
3. 사물과 배경: 주요 사물, 배경, 장소를 설명
4. 색상과 분위기: 전체적인 색감과 분위기를 설명
5. 이미지 요약: 큰 제목과 위 내용을 바탕으로 이 이미지가 무엇인지 한 문장으로 요약

규칙:
- 연계선(→, ⇒, 선)으로 연결된 항목은 관계가 있으므로 연결해서 읽기
- 영어 단어 절대 금지 (고유명사도 한국어 발음으로)
- 추측하지 말고 보이는 것만 설명
- "없음"이라고 답할 항목은 아예 건너뛰기`

// olmOCR2 전용 프롬프트 (문서/테이블 읽기)
const OLMOCR2_PROMPT = `이 문서의 모든 텍스트를 순서대로 읽어줘.

순서:
1. 제일 큰 글씨 (제목) - 위치와 함께 언급
2. 화면 중앙 상단 제목이 있으면 먼저 읽기
3. 왼쪽→오른쪽, 위→아래 순서로 읽기
4. <>, <<>>, [], {} 같은 기호는 빼고 안의 텍스트만 읽기
5. 표는 행과 열 구조를 명확히 구분해서 읽기
6. 제목, 본문, 각주, 서명 등 모든 텍스트 빠짐없이

한국어로만 답해줘.`

// glm-ocr 전용 프롬프트 (문서 OCR)
const GLM_OCR_PROMPT = `이 문서의 모든 글자를 순서대로 읽어줘.

순서:
1. 제일 큰 글씨 먼저 (제목, 위치 언급)
2. 화면 중앙 상단 제목 우선
3. 왼쪽→오른쪽, 위→아래
4. <>, <<>>, [], {} 기호는 빼고 안의 텍스트만
5. 표가 있으면 표 형태 그대로

한국어로만 답해줘.`

// 이미지 분류용 프롬프트 (빠른 판단)
const CLASSIFY_PROMPT = `이 이미지가 다음 중 무엇인지 한 단어로만 답해줘:
문서 (텍스트가 주인 공문서, 양식, 계약서, 통지서),
사진 (인물사진, 풍경, 일러스트, 그림, 카드),
혼합 (문서인데 그림도 있음)`

// llama3.2-vision 전용 프롬프트 (항목별 분석 → 번역)
const LLAMA_PROMPT = `Analyze this image in the following order:

0. Start with the largest elements:
   - Describe the largest image/character/figure first if present
   - Read the largest text/title first (mention size and position: "center-top in large font...")

1. All text in image (largest→smallest):
   - Center-top title first if present
   - Then left→right, top→bottom order
   - Ignore symbols <>, <<>>, [], {} and read only the text inside (likely titles/subtitles)
   - If arrows (→, ⇒) or connection lines exist, read connected items together as they are related
   - If image and text are vertically adjacent, describe together (e.g., "dog photo with text 'cute' below")

2. Main character: Clothing, posture, expression, what both hands are holding
   (SKIP this item if no character present)

3. Other characters or animals: Describe in detail if present
   (SKIP this item if none)

4. Background: Sky, buildings, nature, lighting, colors

5. Overall colors and atmosphere

6. Image summary: Based on the large title and content above, summarize what this image is about in one sentence

Important rules:
- Connection lines (→, ⇒, arrows, lines) indicate relationships - read connected items together
- SKIP items where you would answer "none" - don't mention them at all
- Describe ONLY what is ACTUALLY VISIBLE
- Never guess or interpret
- Be extremely specific and detailed`

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

/**
 * 이미지 자동 분류 (문서/사진/혼합)
 */
export async function classifyImage(
  buffer: Buffer,
  fileName: string
): Promise<"document" | "photo" | "mixed"> {
  // STEP 1: 파일명으로 1차 판단
  const lowerName = fileName.toLowerCase()

  const documentKeywords = [
    "통지서", "증명서", "신청서", "등록증", "계약서", "영수증",
    "공문", "신청", "확인서", "invoice", "receipt", "certificate",
    "contract", "document", "명세서", "진단서", "처방전", "청구서"
  ]

  const photoKeywords = [
    "타로", "카드", "사진", "포스터", "그림", "일러스트",
    "photo", "picture", "illustration", "artwork", "drawing"
  ]

  if (documentKeywords.some(kw => lowerName.includes(kw))) {
    console.log("[분류] 파일명 기반: 문서")
    return "document"
  }

  if (photoKeywords.some(kw => lowerName.includes(kw))) {
    console.log("[분류] 파일명 기반: 사진")
    return "photo"
  }

  // STEP 2: gemma4:e2b로 빠른 분류 (30초 이내)
  try {
    console.log("[분류] gemma4:e2b로 이미지 내용 분석 중...")
    const base64 = buffer.toString("base64")

    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma4:e2b",
        messages: [
          {
            role: "user",
            content: CLASSIFY_PROMPT,
            images: [base64],
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(30000), // 30초 타임아웃
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const result = data.message?.content?.trim().toLowerCase() || ""

    console.log("[분류] AI 분석 결과:", result)

    if (result.includes("문서") || result.includes("document")) {
      return "document"
    } else if (result.includes("사진") || result.includes("photo")) {
      return "photo"
    } else if (result.includes("혼합") || result.includes("mixed")) {
      return "mixed"
    }

    // 기본값: 사진으로 처리
    return "photo"
  } catch (e) {
    console.warn("[분류] AI 분석 실패:", e)

    // Fallback: 파일명에 문서 키워드 없으면 기본값 photo
    const hasDocKeyword = documentKeywords.some(kw => lowerName.includes(kw))
    if (hasDocKeyword) {
      console.log("[분류] Fallback: 파일명 기반으로 문서 판단")
      return "document"
    }

    console.log("[분류] Fallback: 기본값 사진으로 처리")
    return "photo"
  }
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
  const isLlama = model === "llama3.2-vision:11b-instruct-q4_K_M"
  const isGemma4E4B = model === "gemma4:e4b"
  const isOlmOCR2 = model === "richardyoung/olmocr2:7b-q8"
  const isGlmOCR = model === "glm-ocr"

  // 프롬프트 선택
  let prompt = UNIFIED_PROMPT
  if (isLlama) {
    prompt = LLAMA_PROMPT
  } else if (isGemma4E4B) {
    prompt = GEMMA4_E4B_PROMPT
  } else if (isOlmOCR2) {
    prompt = OLMOCR2_PROMPT
  } else if (isGlmOCR) {
    prompt = GLM_OCR_PROMPT
  }

  console.log(`[Vision] 모델: ${model}, 한국어직접: ${isKoreanNative}, 라마: ${isLlama}, E4B: ${isGemma4E4B}`)

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
    "richardyoung/olmocr2:7b-q8": 120000,
    "glm-ocr": 120000,
    "llama3.2-vision:11b-instruct-q4_K_M": 600000,
  }
  const timeout = timeouts[model] || 120000

  // 라마비전 fetch 직전 로그
  if (isLlama) {
    console.log("[라마] 이미지 크기:", buffer.length, "bytes")
    console.log("[라마] timeout:", timeout, "ms")
  }

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

    // gemma4:e2b 타임아웃 시 gemma4:e4b로 자동 폴백
    if (model === "gemma4:e2b" && msg.includes("timeout")) {
      console.log("[Vision] gemma4:e2b 타임아웃 → gemma4:e4b로 자동 전환")
      return extractTextFromImage(buffer, mimeType, fileName, "gemma4:e4b")
    }

    throw new Error(`${model} 분석 실패: ${msg}`)
  }
}
