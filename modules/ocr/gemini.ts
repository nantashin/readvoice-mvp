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

핵심 목표: 시각장애인이 듣고 머릿속에 이 이미지를 그대로 그릴 수 있어야 해.

중요도 순서:
1. 제일 큰 이미지/캐릭터
2. 가장 중심에 위치한 이미지/캐릭터
3. 화면 상단 중앙 또는 중앙의 큰 텍스트 (제목/주제)
4. 이미지 상세 묘사 (중심→주변으로 파문처럼)
5. 나머지 텍스트 전체

묘사 방법:

1단계 - 제목 읽기:
   - 화면 상단 중앙 또는 중앙에 있는 가장 큰 텍스트를 먼저 읽어줘
   - 위치와 크기 언급: "화면 중앙 상단에 큰 글씨로: [텍스트]"
   - <>, <<>>, [], {} 기호는 빼고 안의 내용만 읽기

2단계 - 중심 이미지 상세 묘사:
   - 제일 큰 이미지나 캐릭터를 최대한 상세하게 묘사
   - 다음 항목들을 자연스럽게 포함: 분위기, 동작, 형태, 색깔, 디자인, 방향, 좌우 구분, 상하 구분, 정적/동적, 표정, 의상, 자세
   - 중심에서 바깥쪽으로 원을 그리듯이 파문처럼 묘사
   - 가까운 곳부터 먼 곳 순으로

3단계 - 주변 요소:
   - 중심 이미지 주변의 캐릭터, 도구, 아이템을 가까운 것부터 설명
   - 연결선이나 화살표가 있으면 관계를 함께 설명
   - 이미지와 연관된 텍스트가 있으면 함께 설명 (예: "강아지 사진 바로 아래 작은 글씨로 '귀여워'")

4단계 - 나머지 텍스트:
   - 왼쪽 상단→오른쪽 하단 순서로
   - 큰 글씨부터 작은 글씨 순으로
   - 작은 글씨는 "작은 글씨로: [텍스트]" 형식으로

5단계 - 배경과 전체 분위기:
   - 배경 요소 (하늘, 건물, 자연, 조명)
   - 전체 색감과 분위기

특수 경우:
- 반복 패턴이나 구조적 패턴이면 비유를 들어서 설명 (예: "벌집처럼", "물결무늬처럼")
- 중국어/한자/일본어는 오른쪽→왼쪽으로 읽을 수도 있으니 문자 방향 확인

규칙:
- 시각장애인이 머릿속에 그릴 수 있도록 최대한 상세하게
- "없음"이라고 답할 항목은 건너뛰기
- 반드시 한국어로만 답해줘. 영어 금지.`

// gemma4:e4b 전용 프롬프트 (시각장애인 중심)
const GEMMA4_E4B_PROMPT = `이 이미지를 보고 한국어로 상세히 설명해줘.
영어는 절대 사용하지 마. 모든 내용을 자연스러운 한국어로만 써줘.

핵심 목표: 시각장애인이 듣고 머릿속에 이 이미지를 그대로 그릴 수 있어야 해.

중요도 순서:
1. 제일 큰 이미지/캐릭터
2. 가장 중심에 위치한 이미지/캐릭터
3. 화면 상단 중앙 또는 중앙의 큰 텍스트 (제목/주제)
4. 이미지 상세 묘사 (중심→주변으로 파문처럼)
5. 나머지 텍스트 전체

묘사 방법:

1단계 - 제목 읽기:
   - 화면 상단 중앙 또는 중앙의 가장 큰 텍스트를 먼저 읽어줘
   - 위치와 크기 언급: "화면 중앙 상단에 큰 글씨로: [텍스트]"
   - <>, <<>>, [], {} 기호는 빼고 안의 내용만 읽기

2단계 - 중심 이미지 상세 묘사:
   - 제일 큰 이미지나 인물을 최대한 상세하게 묘사
   - 포함 요소: 외모, 의상, 자세, 표정, 동작, 형태, 색깔, 디자인, 방향, 좌우/상하 위치, 정적/동적
   - 중심에서 바깥쪽으로 원을 그리듯이 파문처럼 묘사
   - 가까운 곳부터 먼 곳 순으로

3단계 - 주변 요소:
   - 중심 인물/객체 주변의 캐릭터, 사물, 도구를 가까운 것부터 설명
   - 연결선이나 화살표가 있으면 관계를 함께 설명
   - 이미지와 연관된 텍스트가 있으면 함께 설명 (예: "강아지 사진 바로 아래 작은 글씨로 '귀여워'")

4단계 - 나머지 텍스트:
   - 왼쪽 상단→오른쪽 하단 순서로
   - 큰 글씨부터 작은 글씨 순으로
   - 화살표나 연결선으로 연결된 텍스트는 함께 읽기

5단계 - 배경과 전체 분위기:
   - 배경 요소 (하늘, 건물, 자연, 장소, 조명)
   - 전체 색감과 분위기

특수 경우:
- 반복 패턴이면 비유로 설명 (예: "벌집처럼", "물결무늬처럼")

규칙:
- 시각장애인이 머릿속에 그릴 수 있도록 최대한 상세하게
- 영어 단어 절대 금지 (고유명사도 한국어 발음으로)
- 추측하지 말고 보이는 것만 설명
- "없음"이라고 답할 항목은 건너뛰기`

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
const GLM_OCR_PROMPT = `이 이미지의 모든 글자를 정확히 읽어줘.

중요: 텍스트 읽기가 최우선 과제야. 보이는 모든 글자, 숫자, 기호를 빠짐없이 읽어줘.

순서:
1. 제일 큰 글씨(제목) 먼저 - 위치와 크기 언급: "화면 중앙 상단에 큰 글씨로: [텍스트]"
2. 화면 중앙 상단 제목 우선
3. 이후 왼쪽→오른쪽, 위→아래 순서로 모든 텍스트 읽기
4. <>, <<>>, [], {} 기호 안의 텍스트는 제목/소제목이므로 반드시 읽어줘 (기호만 빼고 내용은 읽기)
5. 작은 글씨도 놓치지 말고 읽기: "작은 글씨로: [텍스트]"
6. 표가 있으면 표 형태 그대로 읽기
7. 화살표(→, ⇒)나 연결선이 있으면 연결된 내용을 이어서 읽기

규칙:
- 모든 글자를 정확히 읽는 것이 최우선!
- 한국어로만 답해줘. 영어 금지.`

// 이미지 분류용 프롬프트 (빠른 판단)
const CLASSIFY_PROMPT = `이 이미지가 다음 중 무엇인지 한 단어로만 답해줘:
문서 (텍스트가 주인 공문서, 양식, 계약서, 통지서),
사진 (인물사진, 풍경, 일러스트, 그림, 카드),
혼합 (문서인데 그림도 있음)`

// llama3.2-vision 전용 프롬프트 (시각장애인 중심 → 번역)
const LLAMA_PROMPT = `Analyze this image in detail for a blind person who needs to visualize it mentally.

CORE GOAL: Describe so clearly that a blind person can mentally draw this entire image from your words.

Priority order:
1. Largest image/character/figure
2. Most centrally positioned image/character
3. Largest text at top-center or center (title/main subject)
4. Detailed image description (center→outward like ripples)
5. All remaining text

Description method:

STEP 1 - Read the title:
   - Find the LARGEST text at top-center or center of screen
   - Mention position and size: "At top-center in very large font: [exact text]"
   - Remove only decorative symbols: <>, <<>>, [], {} but READ the text inside them

STEP 2 - Describe central image in extreme detail:
   - Describe the largest image/character with maximum detail
   - Include naturally: atmosphere, motion, shape, colors, design, direction, left/right position, up/down position, static/dynamic, facial expression, clothing, posture
   - Describe from center outward like ripples in water
   - Describe nearby elements before distant ones

STEP 3 - Surrounding elements:
   - Describe characters, tools, items around the central image, starting from nearest
   - If connection lines or arrows exist, explain relationships
   - If text is associated with an image, describe together (e.g., "dog photo with small text directly below: 'cute'")

STEP 4 - All remaining text:
   - Read from top-left→bottom-right
   - Largest font→smallest font
   - If arrows (→, ⇒) or connection lines link text, read together
   - For small text: "in small font: [text]"
   - Check if text might be Chinese/Japanese (right→left reading)

STEP 5 - Background and overall atmosphere:
   - Background elements (sky, buildings, nature, lighting)
   - Overall colors and mood

Special cases:
- If repeating patterns or structural patterns exist, use metaphors (e.g., "like a honeycomb", "like waves")

CRITICAL RULES:
- Describe so a blind person can mentally draw this image
- Connection lines (→, ⇒, arrows) = related content, describe together
- SKIP items where you would say "none"
- Describe ONLY what is ACTUALLY VISIBLE, never guess
- Be extremely specific and detailed
- For text and images, always mention exact position and relative size`

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
- 친절한 상담원이 고객에게 설명하듯이 존댓말로 (예: ~입니다, ~있습니다, ~드립니다)
- 부드럽고 정중한 톤 유지
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
- 친절한 상담원이 고객에게 설명하듯이 존댓말로 (예: ~입니다, ~있습니다, ~드립니다)
- 부드럽고 정중한 톤 유지
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
