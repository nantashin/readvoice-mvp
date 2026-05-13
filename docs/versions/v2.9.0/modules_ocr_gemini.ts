// 이미지 묘사 모델 순서 (PDF OCR 제외, 이미지 describe 전용)
// 1. gemma4:e2b (빠름, 5~20초)
// 2. gemma4:e4b (균형, 20~40초)
// 3. llama3.2-vision (정밀, 2~3분, 사용자 직접 선택 시만)

// 이미지 유형 정의 (8종)
export type ImageType =
  | "photo"           // 1. 사진(인물/풍경/사물)
  | "document"        // 2. 문서(인쇄물)
  | "mixed"           // 3. 혼합(그림+글자)
  | "receipt"         // 4. 영수증/청구서
  | "namecard"        // 5. 명함
  | "chart"           // 6. 차트/그래프
  | "medicine"        // 7. 약봉투/의약품
  | "qrcode"          // 8. QR코드/바코드

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

중요: 텍스트 읽기가 최우선 과제야. 모든 글자를 정확히 읽어줘.

0. 먼저 제일 큰 것부터:
   - 가장 큰 이미지나 캐릭터가 있으면 먼저 설명
   - 가장 큰 글씨(제목)가 있으면 먼저 읽기 (위치 언급: "화면 중앙 상단에...")

1. 이미지 속 모든 텍스트 (큰 글씨→작은 글씨 순):
   중요: 보이는 모든 글자, 숫자, 기호를 정확히 읽어줘.

   - 가장 큰 텍스트(제목)부터 시작. 위치와 크기 언급: "화면 중앙 상단에 큰 글씨로: [텍스트]"
   - 이후 왼쪽→오른쪽, 위→아래 순서로 모든 텍스트 읽기
   - <>, <<>>, [], {} 기호 안의 텍스트는 제목/소제목이므로 반드시 읽어줘 (기호만 빼고 내용은 읽기)
   - 화살표(→, ⇒)나 연결선이 있으면 연결된 내용을 이어서 읽기
   - 작은 글씨도 놓치지 말고: "작은 글씨로: [텍스트]"
   - 이미지와 겹친 텍스트도 읽기

2. 주요 인물: 의상, 자세, 표정, 양손에 든 것 (없으면 생략)
3. 주변 인물이나 동물: 상세히 설명 (없으면 생략)
4. 배경: 하늘, 건물, 자연, 조명 색감
5. 전체적인 색감과 분위기

6. 이미지 요약: 큰 제목과 위 내용을 바탕으로 이 이미지가 무엇인지 한 문장으로 요약

규칙:
- 텍스트 읽기가 최우선! 모든 글자를 빠짐없이 정확히 읽어줘
- 연결선으로 연결된 항목은 함께 읽기
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

// ======== 유형별 전용 프롬프트 (8종) ========

// 1. 사진 전용 프롬프트
const PHOTO_PROMPT = `이 사진을 보고 장면을 상세히 묘사해줘.

중요: 듣는 사람이 장면을 머릿속으로 그릴 수 있도록 구체적으로 설명해줘.

1. 주요 인물/사물:
   - 누가/무엇이 있는지
   - 의상, 표정, 자세
   - 양손에 들고 있는 것

2. 배경과 환경:
   - 장소, 시간대, 날씨
   - 하늘, 건물, 자연

3. 색감과 분위기:
   - 전체적인 색상
   - 느낌과 분위기

4. 한 문장 요약:
   - 이 사진이 무엇인지 한 문장으로

규칙:
- 한국어로만 답해줘
- 추측 금지, 보이는 것만 설명
- 존댓말 사용`

// 2. 문서 전용 프롬프트
const DOCUMENT_PROMPT = `이 문서의 모든 텍스트를 정확히 읽어줘.

중요: 텍스트 읽기가 최우선! 모든 글자를 빠짐없이 읽어줘.

순서:
1. 제목 (가장 큰 글씨)
2. 발신자/수신자 정보
3. 본문 내용 (위→아래, 왼→오른쪽)
4. 날짜, 서명, 직인
5. 각주나 작은 글씨

규칙:
- 표는 행/열 구조 유지
- 모든 숫자, 날짜 정확히 읽기
- 한국어로만 답해줘`

// 3. 혼합 전용 프롬프트
const MIXED_PROMPT = `이 이미지는 그림과 글자가 함께 있어요. 글자를 먼저 읽고, 그림을 설명해줘.

순서:
1. 텍스트 읽기 (큰 글씨→작은 글씨):
   - 제목부터 순서대로
   - 모든 글자 정확히 읽기

2. 그림/이미지 설명:
   - 주요 인물/사물
   - 색상과 분위기

3. 텍스트와 그림의 관계:
   - 어떻게 연결되는지 설명

규칙:
- 글자 읽기 우선!
- 한국어로만 답해줘`

// 4. 영수증 전용 프롬프트
const RECEIPT_PROMPT = `이 영수증/청구서를 읽어줘. 핵심 정보만 추출해줘.

중요 순서:
1. 총 금액 (가장 중요!)
2. 날짜와 시간
3. 주요 항목 (상위 3개)
4. 가게명/업체명
5. 결제 방법

규칙:
- 금액은 숫자 정확히
- 불필요한 정보 제외
- 한국어로만 답해줘`

// 5. 명함 전용 프롬프트
const NAMECARD_PROMPT = `이 명함을 읽어줘. 중요 정보 순서대로 읽어줘.

순서:
1. 이름 (가장 큰 글씨)
2. 직책/직급
3. 회사명
4. 전화번호
5. 이메일
6. 주소

규칙:
- 연락처는 숫자 정확히
- 이름과 직책 우선
- 한국어로만 답해줘`

// 6. 차트 전용 프롬프트
const CHART_PROMPT = `이 차트/그래프를 설명해줘. 수치를 말로 풀어서 설명해줘.

순서:
1. 차트 제목과 종류 (막대/선/원형)
2. 주요 수치 (최댓값, 최솟값)
3. 추세와 변화:
   - 증가/감소 패턴
   - 특이점

4. 범례 설명 (색상별 의미)

규칙:
- 수치는 정확히
- 추측 금지, 보이는 것만
- 한국어로만 답해줘`

// 7. 약봉투 전용 프롬프트
const MEDICINE_PROMPT = `이 약봉투/처방전을 읽어줘. 복용법이 가장 중요해!

중요 순서:
1. 복용 방법 (하루 몇 번, 몇 알)
2. 복용 시간 (식전/식후)
3. 주의사항
4. 약 이름
5. 처방 날짜

규칙:
- 복용법 최우선!
- 숫자 정확히
- 한국어로만 답해줘`

// 8. QR코드 전용 프롬프트
const QRCODE_PROMPT = `이 이미지의 QR코드나 바코드를 인식해줘.

순서:
1. 코드 종류 (QR코드/바코드)
2. QR코드면: URL이나 텍스트 추출
3. 바코드면: 숫자 추출
4. 주변 텍스트가 있으면 함께 읽기

규칙:
- URL/숫자 정확히
- 한국어로만 답해줘`

// ======== 이미지 분류용 프롬프트 (8종) ========
const CLASSIFY_PROMPT = `이 이미지가 다음 중 무엇인지 한 단어로만 답해줘:
사진 (인물사진, 풍경, 일러스트),
문서 (공문서, 계약서, 통지서),
혼합 (문서+그림),
영수증 (영수증, 청구서, 명세서),
명함 (명함, 비즈니스 카드),
차트 (차트, 그래프, 도표),
약봉투 (약봉투, 처방전, 의약품),
QR코드 (QR코드, 바코드)`

// llama3.2-vision 전용 프롬프트 (항목별 분석 → 번역)
const LLAMA_PROMPT = `Analyze this image carefully and describe in the following order:

0. Start with the largest elements first:
   - If there is a largest image/character/figure, describe it first in detail
   - If there is largest text/title, read it first and mention its size and exact position (e.g., "center-top in very large font...")

1. All text in image (READ CAREFULLY - largest text→smallest text):
   IMPORTANT: Read ALL visible text, letters, numbers, and symbols accurately.

   Reading order:
   - Start with the LARGEST text (title/heading) at center-top if present
   - Mention exact position and size: "At [position] in [size] font: [exact text]"
   - Then read left→right, top→bottom for remaining text
   - Read EVERY word, number, and character you see
   - IMPORTANT: If text is inside symbols like <>, <<>>, [], {}, these are titles/subtitles - READ the text inside, just don't include the symbols themselves (e.g., "<Title>" → read as "Title")
   - If arrows (→, ⇒) or connection lines exist, read connected text together (they are related)
   - If text is vertically adjacent to an image, describe them together (e.g., "dog photo with caption 'cute' directly below")
   - For small text or fine print, read it carefully and mention "in small font: [text]"
   - If text overlaps images, read it and note the overlap

2. Main character (if present):
   - Clothing details
   - Body posture and position
   - Facial expression
   - What both hands are holding
   (SKIP this entire item if no character is present)

3. Other characters or animals (if present):
   - Describe each in detail
   (SKIP this entire item if none present)

4. Background elements:
   - Sky, buildings, nature
   - Lighting and time of day
   - Background colors

5. Overall colors and atmosphere:
   - Dominant colors throughout the image
   - Overall mood and feeling

6. Image summary:
   - Based on the large title/heading and all content above
   - Summarize what this image is about in one clear sentence

CRITICAL RULES:
- TEXT READING IS PRIORITY: Read ALL visible text accurately, don't skip any words
- Connection lines (→, ⇒, arrows, lines) = related content, read together
- SKIP items where you would say "none" - omit that section entirely
- Describe ONLY what is ACTUALLY VISIBLE, never guess or interpret
- Be extremely specific and detailed, especially for text
- For text, always mention position and relative size`

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
 * 이미지 자동 분류 (8종)
 */
export async function classifyImage(
  buffer: Buffer,
  fileName: string
): Promise<ImageType> {
  // STEP 1: 파일명으로 1차 판단
  const lowerName = fileName.toLowerCase()

  const receiptKeywords = ["영수증", "receipt", "청구서", "명세서", "invoice"]
  const namecardKeywords = ["명함", "namecard", "business card", "card"]
  const chartKeywords = ["차트", "그래프", "chart", "graph", "도표"]
  const medicineKeywords = ["약", "medicine", "처방", "복용", "prescription"]
  const qrcodeKeywords = ["qr", "바코드", "barcode"]

  const documentKeywords = [
    "통지서", "증명서", "신청서", "등록증", "계약서",
    "공문", "신청", "확인서", "certificate",
    "contract", "document", "진단서"
  ]

  const photoKeywords = [
    "타로", "사진", "포스터", "그림", "일러스트",
    "photo", "picture", "illustration", "artwork", "drawing"
  ]

  // 특수 유형 우선 체크
  if (receiptKeywords.some(kw => lowerName.includes(kw))) {
    console.log("[분류] 파일명 기반: 영수증")
    return "receipt"
  }

  if (namecardKeywords.some(kw => lowerName.includes(kw))) {
    console.log("[분류] 파일명 기반: 명함")
    return "namecard"
  }

  if (chartKeywords.some(kw => lowerName.includes(kw))) {
    console.log("[분류] 파일명 기반: 차트")
    return "chart"
  }

  if (medicineKeywords.some(kw => lowerName.includes(kw))) {
    console.log("[분류] 파일명 기반: 약봉투")
    return "medicine"
  }

  if (qrcodeKeywords.some(kw => lowerName.includes(kw))) {
    console.log("[분류] 파일명 기반: QR코드")
    return "qrcode"
  }

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

    // 8종 분류 (우선순위: 특수 유형 먼저)
    if (result.includes("영수증") || result.includes("receipt")) {
      return "receipt"
    } else if (result.includes("명함") || result.includes("namecard") || result.includes("card")) {
      return "namecard"
    } else if (result.includes("차트") || result.includes("그래프") || result.includes("chart") || result.includes("graph")) {
      return "chart"
    } else if (result.includes("약") || result.includes("medicine") || result.includes("처방")) {
      return "medicine"
    } else if (result.includes("qr") || result.includes("바코드") || result.includes("barcode")) {
      return "qrcode"
    } else if (result.includes("문서") || result.includes("document")) {
      return "document"
    } else if (result.includes("혼합") || result.includes("mixed")) {
      return "mixed"
    } else if (result.includes("사진") || result.includes("photo")) {
      return "photo"
    }

    // 기본값: 사진으로 처리
    return "photo"
  } catch (e) {
    console.warn("[분류] AI 분석 실패:", e)

    // Fallback: 파일명 재검사
    if (receiptKeywords.some(kw => lowerName.includes(kw))) return "receipt"
    if (namecardKeywords.some(kw => lowerName.includes(kw))) return "namecard"
    if (chartKeywords.some(kw => lowerName.includes(kw))) return "chart"
    if (medicineKeywords.some(kw => lowerName.includes(kw))) return "medicine"
    if (qrcodeKeywords.some(kw => lowerName.includes(kw))) return "qrcode"
    if (documentKeywords.some(kw => lowerName.includes(kw))) return "document"

    console.log("[분류] Fallback: 기본값 사진으로 처리")
    return "photo"
  }
}

export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  selectedModel?: string,
  imageType?: ImageType
): Promise<{ korean: string; english: string }> {
  const name = fileName || "이미지"
  const base64 = buffer.toString("base64")
  const model = selectedModel || "gemma4:e2b"

  const isKoreanNative = KOREAN_NATIVE_MODELS.includes(model)
  const isLlama = model === "llama3.2-vision:11b-instruct-q4_K_M"
  const isGemma4E4B = model === "gemma4:e4b"
  const isOlmOCR2 = model === "richardyoung/olmocr2:7b-q8"
  const isGlmOCR = model === "glm-ocr"

  // 프롬프트 선택 (imageType 우선, 모델별 폴백)
  let prompt = UNIFIED_PROMPT  // 기본값

  // 1단계: imageType 기반 프롬프트 선택
  if (imageType === "receipt") {
    prompt = RECEIPT_PROMPT
  } else if (imageType === "namecard") {
    prompt = NAMECARD_PROMPT
  } else if (imageType === "chart") {
    prompt = CHART_PROMPT
  } else if (imageType === "medicine") {
    prompt = MEDICINE_PROMPT
  } else if (imageType === "qrcode") {
    prompt = QRCODE_PROMPT
  } else if (imageType === "photo") {
    prompt = PHOTO_PROMPT
  } else if (imageType === "document") {
    prompt = DOCUMENT_PROMPT
  } else if (imageType === "mixed") {
    prompt = MIXED_PROMPT
  }
  // 2단계: imageType 없으면 모델별 기본 프롬프트
  else if (isLlama) {
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
