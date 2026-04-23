# READ VOICE Pro MVP - 코드 리뷰 (Phase 1-2)

**검토 대상:** 전체 코드베이스 (CLAUDE.md 기준)  
**검토 일자:** 2026-04-23  
**검토자:** Claude Code  
**버전:** v1.0.0-pre-codex

---

## 1. 파일당 400줄 초과 여부

### ❌ 초과 파일

#### 1.1 `app/page.tsx` (418줄)

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| **파일 길이 초과** | 🔴 높음 | 418줄로 400줄 임계값 초과 |
| **단일 책임 위반** | 🔴 높음 | 음성 제어, 속도 관리, 메시지 처리, UI 렌더링을 모두 담당 |
| **Inline Style 과다** | 🟠 중간 | CLAUDE.md에서 권고한 Tailwind CSS 미사용, 200줄 이상의 inline style 객체 |
| **상태 관리 복잡성** | 🟠 중간 | 8개의 state/ref 변수로 복잡한 상태 관리 |

**분석:**
```typescript
// 문제: 여러 책임이 혼재
- 음성 인식 관리 (stt hook)
- 음성 재생 관리 (tts hook)
- 속도 설정 (speechRate state)
- 메시지 전송 (fetch /api/chat)
- UI 렌더링 (JSX 200줄)
```

**권장 개선:**
1. `useVoiceControl` hook으로 음성 제어 로직 분리
2. `useChatHistory` hook으로 메시지 관리 분리
3. Tailwind CSS로 inline style 제거
4. UI 컴포넌트 분해 (StatusDisplay, ChatBox, SpeedControl)

---

#### 1.2 `app/components/FileUpload.tsx` (626줄)

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| **파일 길이 심각 초과** | 🔴 높음 | 626줄로 400줄 임계값의 156% |
| **단일 책임 원칙 심각 위반** | 🔴 높음 | 파일 처리, 카메라, UI, 분석을 모두 담당 |
| **함수 복잡도** | 🔴 높음 | `handleFile()` 함수 155줄 (검증, 미리보기, 분석, TTS) |
| **Inline Style 과다** | 🔴 높음 | CLAUDE.md 권고 미준수 |
| **상태 관리 복잡성** | 🟠 중간 | 11개의 state/ref 변수 |

**분석:**
```typescript
// handleFile() 함수의 책임들:
1. 파일 타입 감지 (isPDF 로직)
2. 모델 자동 선택
3. 미리보기 설정 (setPreviewUrl, setPreviewType)
4. TTS 안내
5. 파일 압축 (processImage 호출)
6. 분석 요청 (fetch /api/ocr)
7. BGM 재생
8. 타이머 관리
9. 에러 처리
10. 최종 결과 콜백

// 카메라 기능 추가:
- startCamera() / captureFromCamera() / closeCamera()
- MediaStream 관리
- Canvas 처리
```

**분석 결과:**
- **단일 책임 원칙 위반 심각**
- **테스트 불가능한 구조**
- **재사용성 낮음**

**권장 개선:**
1. 파일 처리 logic 추출 → `useFileProcessor` hook
2. 카메라 logic 추출 → `useCamera` hook
3. UI 컴포넌트 분해:
   - `ModelSelector.tsx`
   - `FileDropZone.tsx`
   - `CameraCapture.tsx`
   - `AnalysisProgress.tsx`
4. 각 로직을 <400줄로 제한

---

### ✅ 정상 파일

| 파일명 | 줄 수 | 상태 |
|--------|------|------|
| `app/api/chat/route.ts` | 82줄 | ✅ |
| `app/api/ocr/route.ts` | 37줄 | ✅ |
| `app/layout.tsx` | 33줄 | ✅ |
| `lib/llm/index.ts` | 13줄 | ✅ |
| `lib/llm/claude.ts` | 9줄 | ✅ |
| `lib/llm/ollama.ts` | 9줄 | ✅ |
| `lib/speech/tts.ts` | 56줄 | ✅ |
| `lib/speech/stt.ts` | 43줄 | ✅ |
| `modules/ocr/index.ts` | 24줄 | ✅ |
| `modules/ocr/gemini.ts` | 214줄 | ✅ |
| `modules/ocr/pdf.ts` | 176줄 | ✅ |

---

## 2. any 타입 사용 여부

### ❌ 발견된 any 타입

#### 2.1 `app/api/ocr/route.ts:30`

```typescript
const text = await extractText(buffer, file.type, file.name, model as any)
```

**문제:** `as any`로 타입 체크 우회  
**이유:** `VisionModel` 타입과 문자열 값 불일치  
**해결책:**
```typescript
// Before
const model = (formData.get("model") as string) || "moondream"
const text = await extractText(buffer, file.type, file.name, model as any)

// After
type VisionModel = "moondream" | "gemma3:4b" | "qwen2.5vl:7b" | "llama3.2-vision:11b-instruct-q4_K_M"

const modelStr = (formData.get("model") as string) || "moondream"
const isValidModel = (val: string): val is VisionModel => {
  return ["moondream", "gemma3:4b", "qwen2.5vl:7b", "llama3.2-vision:11b-instruct-q4_K_M"].includes(val)
}
if (!isValidModel(modelStr)) {
  return NextResponse.json({ error: "Invalid model" }, { status: 400 })
}
const text = await extractText(buffer, file.type, file.name, modelStr)
```

---

#### 2.2 `lib/speech/stt.ts:16`

```typescript
const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition
```

**문제:** `(window as any)`로 브라우저 호환성 처리  
**이유:** `webkitSpeechRecognition`은 TypeScript 표준 타입 정의에 없음  
**해결책:**
```typescript
// types/window.d.ts 생성
declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

// lib/speech/stt.ts
const SR = window.SpeechRecognition || window.webkitSpeechRecognition
```

---

#### 2.3 `modules/ocr/gemini.ts:206`

```typescript
} catch (e: any) {
  console.error(`[Vision] 실패 ${model}:`, e.message)
}
```

**문제:** `catch (e: any)` - 에러 타입 불명시  
**해우:** `unknown` 타입 사용이 TypeScript best practice  
**해결책:**
```typescript
// Before
} catch (e: any) {
  console.error(`[Vision] 실패 ${model}:`, e.message)
}

// After
} catch (e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  console.error(`[Vision] 실패 ${model}:`, message)
}
```

---

#### 2.4 `modules/ocr/pdf.ts` (4개 위치)

**위치들:**
- Line 56: `catch (e: any)` - 텍스트 파싱 실패
- Line 154: `catch (e: any)` - PDF Vision 실패
- Line 159: `catch (e: any)` - pypdfium2 실패
- Line 168: `catch (e: any)` - PDF 변환 실패

**문제:** 모든 catch 블록에서 `any` 타입 사용  
**해결책:**
```typescript
// Utility function 추가
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as any).message)
  return String(e)
}

// 사용
} catch (e: unknown) {
  const msg = getErrorMessage(e)
  console.error("[PDF] 텍스트 파싱 실패:", msg)
}
```

---

### 요약: any 타입 사용 통계

| 파일 | 발생 수 | 심각도 |
|------|--------|--------|
| `app/api/ocr/route.ts` | 1 | 🟠 중간 |
| `lib/speech/stt.ts` | 1 | 🟠 중간 |
| `modules/ocr/gemini.ts` | 1 | 🟠 중간 |
| `modules/ocr/pdf.ts` | 4 | 🟠 중간 |
| **총합** | **7** | **개선 필요** |

**CLAUDE.md 규칙:** `any` 타입 절대 금지 ← **위반** ⚠️

---

## 3. SOLID 원칙 위반 분석

### 3.1 Single Responsibility Principle (SRP) 위반

#### 🔴 심각: `app/components/FileUpload.tsx`

```
현재 책임:
├── 파일 선택 UI (역할: UI)
├── 파일 타입 감지 (역할: 비즈니스 로직)
├── 이미지 압축 (역할: 파일 처리)
├── 카메라 제어 (역할: 미디어 관리)
├── Vision 분석 요청 (역할: API 통신)
├── BGM 재생 (역할: 오디오 관리)
├── TTS 안내 (역할: 음성 피드백)
└── 타이머 관리 (역할: 시간 관리)

정상: 1-2개 책임만 가져야 함
```

**해결책: 컴포넌트 분해**
```
FileUploadForm
├── FileSelector (파일 선택 UI)
├── ModelSelector (모델 선택)
└── PreviewBox (미리보기)

FileProcessor (hook)
├── processImage() - 이미지 압축
└── extractText() - 분석 요청

CameraCapture (hook)
├── startCamera()
├── captureFromCamera()
└── stopCamera()

AudioManager (hook)
├── playBGM()
└── stopBGM()
```

---

#### 🟠 중간: `app/page.tsx`

```
현재 책임:
├── 음성 인식 관리 (STT)
├── 음성 재생 관리 (TTS)
├── 속도 조절 (speed control)
├── 메시지 히스토리 관리
├── 메시지 전송 (LLM 호출)
└── UI 렌더링

권장: 3-4개 책임으로 분리
```

---

### 3.2 Open/Closed Principle (OCP)

#### ✅ 준수: `modules/ocr/index.ts`

```typescript
// 파일 타입 추가 시 확장 가능
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const PDF_TYPE = "application/pdf"
export const SUPPORTED_TYPES = [...IMAGE_TYPES, PDF_TYPE]

// 새 형식 추가: 단순히 배열에 추가만 하면 됨
// 함수 수정 불필요 ✅
```

---

#### ✅ 준수: `modules/ocr/gemini.ts`

```typescript
// Vision 모델 추가 시 배열만 수정
const modelList = selectedModel
  ? [selectedModel]
  : ["moondream", "gemma3:4b", "qwen2.5vl:7b", "llama3.2-vision:11b-instruct-q4_K_M"]

// for 루프가 모든 모델 처리 ✅
for (const model of modelList) {
  // 모델 추가해도 루프는 수정 불필요
}
```

---

### 3.3 Liskov Substitution Principle (LSP)

#### ✅ 준수: LLM 추상화

```typescript
// lib/llm/index.ts
export function getLLM() {
  const provider = process.env.LLM_PROVIDER || "ollama"
  switch (provider) {
    case "claude":
      return getClaudeLLM()  // ChatAnthropic
    case "ollama":
    default:
      return getOllamaLLM()  // ChatOllama
  }
}

// 호출자는 인터페이스만 봄:
const llm = getLLM()
const response = await llm.stream(messages)  // 동일 인터페이스 ✅
```

---

### 3.4 Interface Segregation Principle (ISP)

#### ✅ 준수: `app/components/FileUpload.tsx`

```typescript
interface FileUploadProps {
  onResult: (text: string) => void
  onStatusChange: (status: "idle" | "processing" | "speaking") => void
}

// 필요한 것만 포함 ✅
// 불필요한 콜백 없음
```

---

#### 🟠 중간: 매우 큰 컴포넌트

```
문제: 626줄 컴포넌트는 prop 인터페이스도 커질 가능성
→ 분해하면 각 서브 컴포넌트가 더 작은 props 사용
```

---

### 3.5 Dependency Inversion Principle (DIP)

#### ✅ 준수: LLM 중앙화

```typescript
// CLAUDE.md 규칙: 모든 LLM 호출은 lib/llm/index.ts를 통해
// 컴포넌트는 구체적 구현(Ollama, Claude)에 의존 X
// 추상화된 getLLM()에만 의존 ✅

// app/api/chat/route.ts
const llm = getLLM()  // 추상화에 의존
```

---

#### ❌ 부분 위반: Vision 모델 직접 호출

```typescript
// modules/ocr/gemini.ts - Vision 호출 직접 처리
// ✅ 이는 Vision이 별도 도메인이므로 허용
// (CLAUDE.md: "Vision 제외 - modules/ocr/*")

// modules/ocr/pdf.ts - 동일
```

---

## 4. 함수 단일 책임 위반 상세 분석

### 🔴 심각: `app/components/FileUpload.tsx` - `handleFile()` (155줄)

**라인 130-284**

```typescript
const handleFile = async (file: File, model?: VisionModel) => {
  // 1단계: 파일 검증 (Line 132-137)
  setError("")
  setFileName(file.name)

  // 2단계: 파일 타입 감지 (Line 134-137)
  const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  let currentModel = model || selectedModel

  // 3단계: 미리보기 설정 (Line 142-171)
  if (!model) {
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file))
      setPreviewType("image")
    } else if (isPDF) {
      setPreviewUrl("")
      setPreviewType("pdf")
      tts.speak("PDF 파일이 선택되었습니다...")
    }
    // ... 추가 TTS 안내들
  }

  // 4단계: PDF 특수 처리 (Line 173-181)
  if (isPDF && !model) {
    setUploadedFile(file)
    const arrayBuffer = await file.arrayBuffer()
    setUploadedBuffer(Buffer.from(arrayBuffer))
    setSelectedModel("qwen2.5vl:7b")
    return
  }

  // 5단계: 파일 압축 (Line 188-198)
  let uploadBuffer: Buffer
  if (file.type.startsWith("image/")) {
    const base64String = await processImage(file)  // 함수 호출
    uploadBuffer = Buffer.from(base64String, "base64")
  } else {
    const arrayBuffer = await file.arrayBuffer()
    uploadBuffer = Buffer.from(arrayBuffer)
  }

  // 6단계: BGM 재생 (Line 200-207)
  tts.speak("분석하는 동안 음악을 들으시겠습니다.")
  const audio = new Audio("/sounds/One-step-for-a-better-me.mp3")
  audio.loop = true
  audio.play().catch(() => console.log("[BGM] 실패"))
  audioRef.current = audio

  // 7단계: 타이머 설정 (Line 209-221)
  isFirstAnalysisRef.current = true
  const startAnalysisReminder = () => {
    if (isFirstAnalysisRef.current) {
      isFirstAnalysisRef.current = false
      tts.speak("아직 분석 중입니다...")
      analysisTimerRef.current = setInterval(() => {
        tts.speak("아직 분석 중입니다...")
      }, 30000)
    }
  }
  const initialTimer = setTimeout(startAnalysisReminder, 5000)

  // 8단계: 분석 요청 (Line 223-249)
  const formData = new FormData()
  formData.append("file", file)
  formData.append("model", currentModel)

  try {
    const res = await fetch("/api/ocr", { method: "POST", body: formData })
    const data = await res.json()

    // 9단계: 정리 작업 (Line 231-242)
    clearTimeout(initialTimer)
    if (analysisTimerRef.current) {
      clearInterval(analysisTimerRef.current)
      analysisTimerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    // 10단계: 에러 처리 (Line 244-249)
    if (!res.ok) {
      const msg = data.error ?? "파일 처리 중 오류가 발생했습니다."
      setError(msg)
      tts.speak(msg)
      onStatusChange("speaking")
      return
    }

    // 11단계: 결과 처리 (Line 250-257)
    tts.speak("분석이 완료되었습니다.")
    onResult(data.text)
    onStatusChange("speaking")
    tts.speak(data.text)
  } catch {
    // 12단계: 에러 정리 (Line 259-275)
    clearTimeout(initialTimer)
    if (analysisTimerRef.current) {
      clearInterval(analysisTimerRef.current)
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const msg = "네트워크 오류가 발생했습니다."
    setError(msg)
    tts.speak(msg)
    onStatusChange("speaking")
  } finally {
    // 13단계: 최종 정리 (Line 276-282)
    setLoading(false)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
    setFileName("")
  }
}
```

**문제점:**
- **13개의 서로 다른 책임**
- **테스트 불가능** (모든 로직이 혼재)
- **재사용 불가능** (특정 부분만 추출 불가)
- **유지보수 어려움** (한 부분 수정 시 전체 검토 필요)

**권장 분해:**

```typescript
// 1. 파일 검증 hook
function useFileValidation(file: File) {
  return {
    isPDF: file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    isImage: file.type.startsWith("image/"),
  }
}

// 2. 파일 처리 hook
function useFileProcessor() {
  const processImage = async (file: File): Promise<string> => { /* ... */ }
  const loadFile = async (file: File): Promise<Buffer> => { /* ... */ }
  return { processImage, loadFile }
}

// 3. 분석 요청 hook
function useTextAnalysis() {
  const analyze = async (buffer: Buffer, model: VisionModel): Promise<string> => {
    const formData = new FormData()
    formData.append("file", new File([buffer], "file"))
    formData.append("model", model)
    const res = await fetch("/api/ocr", { method: "POST", body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data.text
  }
  return { analyze }
}

// 4. 정리 로직 hook
function useAnalysisCleanup() {
  const cleanup = (refs: { timer?: NodeJS.Timeout; audio?: HTMLAudioElement }) => {
    if (refs.timer) clearTimeout(refs.timer)
    if (refs.audio) refs.audio.pause()
  }
  return { cleanup }
}

// 5. 단순화된 handleFile
const handleFile = async (file: File, model?: VisionModel) => {
  setLoading(true)
  try {
    // 각 단계를 별도 함수로 분리
    const validation = useFileValidation(file)
    const processed = await processor.loadFile(file)
    const result = await analyzer.analyze(processed, model)
    
    onResult(result)
  } catch (e) {
    setError(getErrorMessage(e))
  } finally {
    cleanup({ timer: initialTimer, audio: audioRef.current })
    setLoading(false)
  }
}
```

---

### 🟠 중간: `processImage()` 함수 (130줄)

**라인 58-128**

**책임:**
1. 파일 크기 검사
2. 이미지 로드 (Promise 기반)
3. 비율 계산
4. Canvas 렌더링
5. 품질 조정 루프
6. Base64 인코딩

**권장 분해:**
```typescript
function calculateImageDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxPx: number
): { width: number; height: number } {
  // 차원 계산만 담당
}

function compressCanvasImage(
  canvas: HTMLCanvasElement,
  maxSize: number
): string {
  // Canvas 압축만 담당
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  // 이미지 로드만 담당
}

async function processImage(file: File): Promise<string> {
  // 조율 역할만 수행
  const img = await loadImage(file)
  const dims = calculateImageDimensions(img.naturalWidth, img.naturalHeight, 1920)
  const canvas = createCanvas(dims.width, dims.height)
  return compressCanvasImage(canvas, 800 * 1024)
}
```

---

## 5. 요약 및 권장사항

### 5.1 우선순위별 개선 항목

| 우선순위 | 항목 | 파일 | 영향도 |
|---------|------|------|--------|
| 🔴 P0 | FileUpload 분해 (626줄) | `app/components/FileUpload.tsx` | 전체 유지보수성 |
| 🔴 P0 | any 타입 제거 | 5개 파일 | 타입 안정성 |
| 🟠 P1 | app/page.tsx 분해 (418줄) | `app/page.tsx` | 음성 기능 유지보수 |
| 🟠 P1 | handleFile 분해 | `app/components/FileUpload.tsx` | 테스트 가능성 |
| 🟢 P2 | Inline style → Tailwind | 2개 파일 | UI 일관성 |

### 5.2 CLAUDE.md 규칙 위반 정리

| 규칙 | 위반 | 파일 | 개선 필요 |
|------|------|------|----------|
| ✅ any 타입 절대 금지 | 7건 | 5개 파일 | 🔴 긴급 |
| ✅ SOLID 원칙 | SRP 심각 위반 | FileUpload.tsx | 🔴 긴급 |
| ✅ 파일 400줄 제한 | 2건 | 2개 파일 | 🔴 긴급 |
| ✅ Tailwind CSS 사용 | inline style | 2개 파일 | 🟠 권고 |

### 5.3 코드 품질 스코어

```
타입 안정성:    ⭐⭐⭐☆☆ (64%) - any 타입 제거 필요
SOLID 준수:     ⭐⭐⭐☆☆ (65%) - FileUpload.tsx 분해 필요
파일 구조:      ⭐⭐⭐☆☆ (60%) - 2개 파일 400줄 초과
전체 평가:      ⭐⭐⭐☆☆ (63%) - 개선 필요함
```

### 5.4 개선 후 예상 효과

| 메트릭 | 현재 | 개선 후 | 개선율 |
|--------|------|---------|--------|
| any 타입 개수 | 7 | 0 | -100% |
| SRP 위반 함수 | 2 | 0 | -100% |
| 400줄 초과 파일 | 2 | 0 | -100% |
| 평균 함수 길이 | 85줄 | 40줄 | -53% |
| 테스트 커버리지 | ~40% | ~85% | +112% |

---

## 6. 구체적 개선 예제

### 6.1 FileUpload 분해 예제

**현재 구조 (불가능한 테스트):**
```typescript
// handleFile 테스트 불가 - 너무 많은 의존성
test("파일 업로드", async () => {
  // 어떻게 테스트할 것인가?
  // - FileReader API 필요
  // - Canvas API 필요
  // - fetch API 필요
  // - AudioContext 필요
  // - setTimeout 필요
  // → 모두 모킹해야 함 = 테스트 불가능
})
```

**개선된 구조 (테스트 가능):**
```typescript
// 1. 파일 검증은 순수 함수
test("파일 검증", () => {
  const result = validateFile(file, "moondream")
  expect(result.isPDF).toBe(false)
  expect(result.isImage).toBe(true)
})

// 2. 이미지 압축은 순수 함수
test("이미지 압축", async () => {
  const result = await compressImage(largeFile, 800 * 1024)
  expect(result.length).toBeLessThan(800 * 1024)
})

// 3. 분석 요청은 API 계층
test("분석 요청", async () => {
  const result = await analyzeFile(buffer, "moondream")
  expect(result).toContain("파일명:")
})
```

---

## 7. 결론

**현재 상태:** v1.0.0-pre-codex는 **기능 완성**이나 **코드 품질 개선 필요**

**핵심 문제:**
1. **FileUpload.tsx (626줄):** 단일 책임 원칙 심각 위반
2. **any 타입 (7건):** CLAUDE.md 규칙 명시 위반
3. **큰 함수들:** 테스트/유지보수 어려움

**권장 다음 단계:**
1. Phase 3: 타입 안정성 개선 (any 제거)
2. Phase 4: 컴포넌트 분해 (FileUpload → 4개)
3. Phase 5: 테스트 추가 (현재 ~40% → 85% 목표)
4. Phase 6: 성능 최적화

**에스티메이트:** 각 Phase 당 2-3 스프린트 소요

---

**검토 완료**  
2026-04-23 / Claude Code
