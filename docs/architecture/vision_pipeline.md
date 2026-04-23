# 비전 파이프라인 (Vision Pipeline)

## 개요

READ VOICE Pro의 비전 파이프라인은 이미지와 PDF 문서를 분석하여 한국어 텍스트로 변환합니다.

```
이미지/PDF 파일
  ↓
파일 타입 판별
  ↓
이미지: 직접 Vision 분석
PDF: 텍스트 추출 시도 → pypdfium2 변환 → Vision 분석
  ↓
Vision 모델 순서 실행
(moondream → gemma3:4b → qwen2.5vl:7b → llama3.2-vision)
  ↓
영어 텍스트 결과
  ↓
한국어 번역 (EXAONE → Claude)
  ↓
최종 한국어 텍스트
```

---

## 1단계: 파일 타입 판별

### 구현 위치
- **파일:** `app/components/FileUpload.tsx`
- **함수:** 파일 타입 감지 로직

### 파일 타입 분류

```typescript
const isPDF =
  file.type === "application/pdf" ||
  file.name.toLowerCase().endsWith(".pdf")

const isImage = file.type.startsWith("image/")
```

### 특징

| 파일 타입 | 처리 방식 | 비고 |
|---------|---------|------|
| **이미지** (JPG, PNG) | 직접 Vision | 빠른 처리 |
| **PDF (텍스트 기반)** | 텍스트 추출 → Vision | 최적화됨 |
| **PDF (스캔 이미지)** | pypdfium2 → Vision | 자동 폴백 |

### 파일 크기 검증

```typescript
const MAX_SIZE = 800 * 1024 // 800KB

if (file.size > MAX_SIZE) {
  // 이미지 압축 필요
  const compressed = await compressImage(file)
  return compressed
}
```

---

## 2단계: 이미지 처리

### 구현 위치
- **파일:** `modules/ocr/gemini.ts`
- **함수:** `extractTextFromImage()`

### 처리 흐름

```
이미지 입력 (JPG, PNG)
  ↓
Base64 인코딩
  ↓
Vision 모델 순서 시도
  1. moondream (빠름, 기본)
  2. gemma3:4b (균형)
  3. qwen2.5vl:7b (정확함)
  4. llama3.2-vision (최후 수단)
  ↓ 첫 성공 시 중단
한국어 번역
  ↓
최종 결과
```

### Vision 모델 구성

#### 모델별 특징

| 모델 | 타임아웃 | 속도 | 정확도 | 장점 |
|------|--------|------|--------|------|
| **moondream** | 30초 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 가장 빠름 |
| **gemma3:4b** | 60초 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 빠르고 정확 |
| **qwen2.5vl:7b** | 180초 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 텍스트 인식 최고 |
| **llama3.2-vision** | 300초 | ⭐⭐ | ⭐⭐⭐⭐ | 마지막 선택지 |

#### Vision 프롬프트

```typescript
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
```

### 구현 패턴

```typescript
async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  selectedModel?: string
): Promise<string> {
  const base64 = buffer.toString("base64")
  
  const modelList = selectedModel
    ? [selectedModel]
    : ["moondream", "gemma3:4b", "qwen2.5vl:7b", "llama3.2-vision:11b-instruct-q4_K_M"]
  
  // Ollama 연결 확인
  try {
    await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new Error("Ollama 서버가 실행 중이지 않습니다.")
  }
  
  // 모델 순서대로 시도
  for (const model of modelList) {
    try {
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeout),
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: VISION_PROMPT,
            images: [base64],
          }],
          stream: false,
        }),
      })
      
      const data = await res.json()
      const englishResult = data.message?.content?.trim()
      
      if (englishResult && englishResult.length > 20) {
        const korean = await translateToKorean(englishResult, fileName)
        return korean
      }
    } catch (e) {
      console.error(`[Vision] ${model} 실패:`, e)
    }
  }
  
  throw new Error("이미지 분석 실패")
}
```

---

## 3단계: PDF 처리

### 구현 위치
- **파일:** `modules/ocr/pdf.ts`
- **Python 스크립트:** `server/pdf-to-image.py`

### PDF 처리 전략

PDF는 3가지 타입으로 나뉩니다:

#### 1. 텍스트 기반 PDF (공문서, 계약서)
```
PDF 파일
  ↓
정규식으로 바이너리 텍스트 추출
  ↓
한글 10자 이상 확인
  ↓ 있으면
전체 텍스트 반환
```

#### 2. 스캔 PDF (영수증, 증명서)
```
PDF 파일
  ↓
정규식으로 바이너리 텍스트 추출
  ↓
한글 10자 미만 확인
  ↓ 부족하면
pypdfium2로 PNG 변환
  ↓
Vision 분석
```

#### 3. 합본 PDF (여러 서류 합침)
```
PDF 파일
  ↓
텍스트/스캔 감지
  ↓ 텍스트만 있으면
전체 추출
  ↓ 스캔만 있거나 혼합이면
첫 페이지만 Vision으로 처리
```

### 단계 1: 텍스트 추출

```typescript
function extractRawText(buffer: Buffer): string {
  const str = buffer.toString("binary")
  const matches = str.match(/\(([^\)]{2,100})\)/g) || []
  
  const texts = matches
    .map((m) => m.slice(1, -1))
    .filter((t) => {
      // 한글 또는 읽기 가능한 영문/숫자만
      const koreanCount = (t.match(/[가-힣]/g) || []).length
      const readableCount = (
        t.match(/[a-zA-Z0-9가-힣\s.,!?:;()]/g) || []
      ).length
      const totalCount = t.length
      
      // 읽기 가능한 문자 비율 70% 이상 && 한글 최소 기준
      return readableCount / totalCount > 0.7 && (koreanCount > 0 || t.length > 3)
    })
    .join(" ")
    .trim()
  
  return texts
}

// 한글 10자 이상 확인
const koreanCount = (rawText.match(/[가-힣]/g) || []).length
if (koreanCount > 10) {
  return `파일명: ${name}\n\n설명:\n${rawText}`
}
```

### 단계 2: pypdfium2 변환

#### Python 스크립트 (`server/pdf-to-image.py`)

```python
import sys
import json
import base64
import pypdfium2 as pdfium
from io import BytesIO

def pdf_to_image(pdf_path, page_index):
    # PDF 파일 열기
    pdf = pdfium.PdfDocument.new()
    pdf = pdfium.PdfDocument.new()
    
    with open(pdf_path, "rb") as f:
        pdf = pdfium.PdfDocument.new_from_data(f.read())
    
    # 페이지 수
    num_pages = len(pdf)
    
    # 첫 페이지만 렌더링
    page = pdf.get_page(0)
    
    # 200dpi로 렌더링 (72dpi 기본)
    scale = 200 / 72
    bitmap = page.render(
        pdfium.PdfBitmap.BGR,
        matrix=pdfium.PdfMatrix().scale(scale, scale)
    )
    
    # PNG로 변환
    png_bytes = bitmap.get_png()
    
    # Base64 인코딩
    base64_str = base64.b64encode(png_bytes).decode("utf-8")
    
    # 결과 반환
    return {
        "success": True,
        "base64": base64_str,
        "total_pages": num_pages,
    }

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    page_index = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    
    result = pdf_to_image(pdf_path, page_index)
    print(json.dumps(result))
```

#### Node.js 실행

```typescript
import { spawnSync } from "child_process"

const pythonCmd = "python" // 자동 감지됨
const scriptPath = path.join(process.cwd(), "server", "pdf-to-image.py")

const result = spawnSync(pythonCmd, [scriptPath, tmpPdf, "0"], {
  timeout: 60000,
  maxBuffer: 50 * 1024 * 1024, // 50MB (Base64 PNG용)
  encoding: "utf8",
})

if (result.error) throw result.error
if (result.status !== 0) throw new Error("pypdfium2 실행 실패")

const parsed = JSON.parse(result.stdout.trim())
const base64Image = parsed.base64
```

### 단계 3: PDF Vision 분석

#### PDF 전용 모델 순서

```typescript
// PDF는 텍스트 인식에 특화된 모델 우선
for (const model of [
  "qwen2.5vl:7b",           // 텍스트 특화 (1순위)
  "llama3.2-vision:11b-instruct-q4_K_M"  // 일반 비전 (2순위)
]) {
  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: PDF_VISION_PROMPT,  // PDF 전용 프롬프트
          images: [base64Image],
        }],
        stream: false,
      }),
      signal: AbortSignal.timeout(180000),
    })
    
    const data = await res.json()
    const text = data.message?.content?.trim()
    
    if (text && text.length > 30) {
      const prefix = parsed.total_pages > 1
        ? `총 ${parsed.total_pages}페이지 문서입니다. 첫 페이지를 읽어드립니다.\n\n`
        : ""
      return `파일명: ${name}\n\n설명:\n${prefix}${text}`
    }
  } catch (e) {
    console.log(`[PDF] ${model} 실패:`, e.message)
  }
}
```

#### PDF Vision 프롬프트

```typescript
const PDF_VISION_PROMPT = `Read ALL text in this document image exactly as written.
Output the complete text content from top to bottom.
Do not describe the image. Only output the text you see.
Preserve the original formatting and structure.`
```

---

## 4단계: 한국어 번역

### 구현 위치
- **파일:** `modules/ocr/gemini.ts`
- **함수:** `translateToKorean()`

### 번역 전략

```
영어 텍스트 입력
  ↓
EXAONE 번역 시도 (로컬, 무료)
  ↓ 한글 20자 이상 확인
성공 → 최종 반환
실패 → Claude API 폴백
  ↓
Claude 번역 (외부 API, 유료)
  ↓
최종 반환
```

### EXAONE 번역

```typescript
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

// 한글 20자 이상 확인
const koreanCount = (result?.match(/[가-힣]/g) || []).length
if (result && koreanCount > 20) {
  result = removeEnglishWords(result)
  return result
}
```

### Claude API 폴백

```typescript
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `다음 영어를 한국어로만 번역해줘.

출력 형식:
파일명: ${fileName}

설명:
[번역 내용만]

절대 금지:
- 규칙 목록 출력 금지
- 체크리스트 출력 금지
- 메타 텍스트 금지
- 번역 내용만 출력

번역:
${englishText}`,
    }],
  }),
  signal: AbortSignal.timeout(30000),
})
```

### 영어 단어 제거

```typescript
function removeEnglishWords(text: string): string {
  const replacements: Record<string, string> = {
    silhouette: "실루엣",
    skyline: "스카이라인",
    kimono: "기모노",
    crescent: "초승달",
    pagoda: "탑",
    foreground: "전경",
    background: "배경",
    atmosphere: "분위기",
    tranquility: "평온함",
    vibrant: "생동감 있는",
    elegant: "우아한",
    mystic: "신비로운",
    dynamic: "역동적인",
    harmony: "조화",
    symbol: "상징적인",
    ornate: "화려한",
    intricate: "정교한",
    floating: "떠있는",
    glowing: "빛나는",
    shimmering: "반짝이는",
  }
  
  let result = text
  for (const [english, korean] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\b${english}\\b`, "gi"), korean)
  }
  
  return result
}
```

---

## 전체 플로우

### 사용자 관점

#### 이미지 분석
```
1. 이미지 선택/촬영
   ↓
2. "사진을 분석하고 있습니다"
   ↓
3. Vision 모델 실행 (moondream → gemma3 → qwen → llama)
   ↓
4. "사진 분석이 완료되었습니다."
   ↓
5. 한국어 설명 TTS 재생
   ↓
6. 완료
```

#### PDF 분석
```
1. PDF 파일 선택
   ↓
2. "PDF 파일이 선택되었습니다. 처리 중입니다."
   ↓
3. 텍스트 추출 시도
   ↓ 성공하면
4. "텍스트 추출 완료"
   ↓ 실패하면
4. pypdfium2로 PNG 변환
   ↓
5. Vision 분석 (qwen → llama)
   ↓
6. "PDF 분석이 완료되었습니다."
   ↓
7. 한국어 텍스트 TTS 재생
   ↓
8. 완료
```

### 기술적 상세 흐름

```
Frontend                          Backend
   ↓                                ↓
1. FileUpload 컴포넌트
   파일 선택
   ↓
2. 파일 타입 판별
   (image vs PDF)
   ↓
3. Base64 인코딩
   ↓
4. POST /api/ocr
                                5. 파일 타입 확인
                                   ↓
                         Image → extractTextFromImage()
                         PDF   → extractTextFromPDF()
                                   ↓
                                6. Vision 처리
                                   Model 1 시도
                                   ↓ 실패하면
                                   Model 2 시도
                                   ↓ ... 계속
                                   ↓ 성공
                                7. 영어 결과
                                   ↓
                                8. translateToKorean()
                                   EXAONE 시도
                                   ↓ 실패/부족하면
                                   Claude 폴백
                                   ↓
                                9. 최종 한국어 텍스트
                                   ↓
                                10. JSON 응답
   ↓
11. 응답 수신
   ↓
12. TTS 재생 (한국어)
    [설명 텍스트]
    ↓
13. 완료
```

---

## 성능 최적화

### 응답 시간

| 작업 | 예상 시간 | 최적화 |
|------|---------|--------|
| 이미지 Vision | 2~5초 | moondream 우선 (가장 빠름) |
| PDF 텍스트 추출 | <1초 | 정규식 직접 파싱 |
| PDF Vision | 5~10초 | qwen2.5vl 우선 (텍스트 특화) |
| 번역 (EXAONE) | 2~3초 | 로컬 처리 (네트워크 지연 X) |
| 번역 (Claude) | 3~5초 | 폴백 전용 (필요 시만) |

### 모델 선택 최적화

```typescript
// 사용자가 모델을 지정하면 그것만 사용
// → 불필요한 폴백 제거
if (selectedModel) {
  return await tryModel(selectedModel)
}

// 기본값: 빠른 모델부터 시작
// → 80% 사례에서 첫 시도로 완료
for (const model of modelList) {
  const result = await tryModel(model)
  if (result.success) return result
}
```

### 파일 크기 최적화

```typescript
// 800KB 이상 이미지는 자동 압축
if (file.size > MAX_SIZE) {
  const canvas = await compressImage(file)
  return canvas.toDataURL("image/jpeg", 0.8)
}
```

---

## 에러 처리

### Vision 모델 실패

```typescript
for (const model of modelList) {
  try {
    const res = await fetch(...)
    if (!res.ok) {
      console.error(`[Vision] HTTP ${res.status}`)
      continue
    }
    
    const data = await res.json()
    const result = data.message?.content?.trim()
    
    if (!result || result.length < 20) {
      console.log(`[Vision] ${model} 빈 결과`)
      continue
    }
    
    return result
  } catch (e: any) {
    console.error(`[Vision] ${model} 실패:`, e.message)
  }
}

throw new Error("이미지 분석 실패. 다른 모델을 선택하거나 다시 시도해 주세요.")
```

### PDF 처리 실패

```typescript
try {
  // 1단계: 텍스트 추출
  const rawText = extractRawText(buffer)
  if (koreanCount > 10) return rawText
  
  // 2단계: pypdfium2 변환
  const base64Image = await convertPdfToPng(buffer)
  
  // 3단계: Vision 분석
  const text = await analyzeWithVision(base64Image)
  return text
} catch (e) {
  console.error("[PDF] 처리 실패:", e)
  throw new Error("PDF 변환 실패. pypdfium2가 설치되어 있는지 확인하세요.")
}
```

### 번역 실패

```typescript
try {
  // EXAONE 시도
  const result = await exaoneTranslate(text)
  const koreanCount = (result.match(/[가-힣]/g) || []).length
  if (koreanCount > 20) return result
} catch (e) {
  console.log("[번역] EXAONE 실패:", e)
}

try {
  // Claude 폴백
  const result = await claudeTranslate(text)
  if (result) return result
} catch (e) {
  console.log("[번역] Claude 실패:", e)
}

// 최후 수단: 원본 영어 텍스트 반환
return englishText
```

---

## 제한사항 및 개선 방안

| 제한사항 | 현재 상황 | 개선 방안 |
|---------|---------|---------|
| 다중 페이지 PDF | 첫 페이지만 처리 | 전체 페이지 순차 처리 |
| 이미지 방향 감지 | 자동 회전 없음 | EXIF 기반 방향 조정 |
| 손글씨 인식 | 모델 의존 (낮은 정확도) | 손글씨 특화 모델 추가 |
| 번역 정확도 | 일반 텍스트만 최적화 | 도메인별 프롬프트 커스터마이징 |
| 오프라인 번역 | EXAONE 필수 API | 로컬 번역 모델 추가 (ollama) |

---

## 결론

READ VOICE Pro의 비전 파이프라인은 **Ollama 기반 로컬 Vision 모델**과 **Python pypdfium2**를 활용하여 이미지와 PDF를 한국어로 분석합니다.

- **이미지:** 빠른 모델부터 순서 실행
- **PDF:** 텍스트 추출 → 스캔 감지 → Vision 분석
- **번역:** EXAONE (빠름) + Claude (정확함) 전략
- **사용자 경험:** 음성 기반 피드백으로 시각 장애인 완전 지원
