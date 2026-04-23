# 소프트웨어 아키텍처

## 설계 원칙

READ VOICE Pro MVP는 다음 5가지 핵심 원칙을 따릅니다.

---

## 1. SOLID 원칙

### Single Responsibility Principle (SRP)
각 모듈은 **하나의 책임만** 가집니다.

#### 적용 사례
- **`lib/llm/index.ts`:** LLM 호출만 담당 (모델 선택 제외)
- **`modules/ocr/gemini.ts`:** Vision + 번역 담당
- **`modules/ocr/pdf.ts`:** PDF 처리만 담당
- **`lib/speech/tts.ts`:** 음성 합성만 담당

#### 위반 사례 (피할 것)
```typescript
// 나쁜 예: 여러 책임
async function analyzeFile(file: File) {
  // 파일 검증
  // 모델 선택
  // Vision 호출
  // 번역 수행
  // 결과 저장
  // TTS 재생
}

// 좋은 예: 책임 분리
// 1. validateFile()
// 2. selectModel()
// 3. analyzeWithVision()
// 4. translateToKorean()
// 5. playTTS()
```

### Open/Closed Principle (OCP)
확장에는 열려있고, 수정에는 닫혀있어야 합니다.

#### 적용 사례
- **Vision 모델 추가:** `MODELS` 배열에만 추가 (기존 코드 수정 X)
- **번역 모델 추가:** `translateToKorean()`의 폴백 체인 확장
- **새 LLM 추가:** `lib/llm/index.ts`에 새 함수 작성

#### 구현 패턴
```typescript
// Vision 모델 확장 가능성
const MODELS = [
  { id: "moondream", timeout: 30000 },
  { id: "gemma3:4b", timeout: 60000 },
  // 새 모델 추가만으로 확장 가능
]

// 사용 코드는 변경 없음
for (const model of MODELS) {
  // 동일한 로직
}
```

### Liskov Substitution Principle (LSP)
하위 타입이 상위 타입을 대체할 수 있어야 합니다.

#### 적용 사례
- **VisionModel 타입:** 모든 Vision 모델이 동일한 인터페이스 제공
- **모든 모델이 동일한 프롬프트 형식 사용**
- **폴백 전략:** EXAONE → Claude (동일한 번역 결과 형식)

### Interface Segregation Principle (ISP)
클라이언트는 자신이 필요한 인터페이스만 사용해야 합니다.

#### 적용 사례
```typescript
// 좋은 예: 필요한 것만 노출
interface FileUploadProps {
  onResult: (text: string) => void
  onStatusChange: (status: Status) => void
}

// 나쁜 예: 불필요한 모든 것 노출
interface FileUploadProps {
  onResult: (text: string) => void
  onStatusChange: (status: Status) => void
  onImageSelect: () => void
  onPDFSelect: () => void
  onCameraStart: () => void
  // ... 너무 많음
}
```

### Dependency Inversion Principle (DIP)
상위 모듈은 하위 모듈에 의존하지 않아야 합니다.

#### 적용 사례
- **LLM 호출 중앙화:** `lib/llm/index.ts`가 구체적인 모델 선택 담당
- **Vision 서비스:** `modules/ocr/`에서 모델 선택 및 폴백 관리
- **컴포넌트는 구체적인 구현에 의존하지 않음**

```typescript
// 나쁜 예: 구체적 의존
import { OllamaAPI } from "@/lib/ollama"

// 좋은 예: 추상화에 의존
import { analyzePage } from "@/modules/ocr"
```

---

## 2. DRY (Don't Repeat Yourself)

중복 코드를 제거하고 재사용성을 극대화합니다.

### 적용 사례

#### Vision 모델 순서 중앙화
```typescript
// modules/ocr/gemini.ts
const modelList = selectedModel
  ? [selectedModel]
  : ["moondream", "gemma3:4b", "qwen2.5vl:7b", "llama3.2-vision"]

// 모든 호출에서 동일한 순서 사용
```

#### 번역 프롬프트 통일
```typescript
// 동일한 프롬프트 형식 (EXAONE & Claude)
prompt: `다음 영어를 한국어로만 번역해줘.

출력 형식:
파일명: ${fileName}

설명:
[번역 내용만]

절대 금지:
- 규칙 목록 출력 금지
- 메타 텍스트 금지
- 번역 내용만 출력

번역:
${englishText}`
```

#### PDF 처리 폴백 체인
```typescript
// 1단계: 텍스트 파싱
// 2단계: pypdfium2 변환
// 3단계: Vision 분석

// 모든 단계가 동일한 형식 반환
return `파일명: ${name}\n\n설명:\n${content}`
```

### 반복 제거 체크리스트
- [ ] 프롬프트 템플릿 (중앙화 ✓)
- [ ] 모델 순서 (중앙화 ✓)
- [ ] 에러 메시지 (중앙화 ✓)
- [ ] 타임아웃 값 (MODELS 배열 ✓)

---

## 3. KISS (Keep It Simple, Stupid)

**단순함이 최고의 설계입니다.**

### 적용 사례

#### 텍스트 파싱 (단순한 정규식)
```typescript
function extractRawText(buffer: Buffer): string {
  const str = buffer.toString("binary")
  const matches = str.match(/\(([^\)]{2,100})\)/g) || []
  // 복잡한 분석 불필요, 정규식으로 충분
}
```

#### 순차 폴백 (단순한 for 루프)
```typescript
for (const model of modelList) {
  try {
    // 시도
  } catch (e) {
    // 다음으로 이동
  }
}
```

#### 파일 타입 감지 (단순 확인)
```typescript
const isPDF =
  file.type === "application/pdf" ||
  file.name.toLowerCase().endsWith(".pdf")
```

### 피해야 할 복잡성
- ❌ 복잡한 상태 관리 (Context/Redux)
- ❌ 고차 함수의 중첩
- ❌ 조건부 타입의 과도한 사용
- ❌ 프록시 패턴의 불필요한 적용

---

## 4. YAGNI (You Aren't Gonna Need It)

**필요한 기능만 구현합니다.**

### 적용 사례

#### 이미지 압축
```typescript
// 필요한 것: 800KB 이상 파일만 압축
// 불필요한 것: 고급 압축 알고리즘, 필터 체인, 프리셋

if (file.size <= MAX_SIZE) {
  return // 원본
}

// 단순 JPEG 품질 조정만 사용
while (result.length * 0.75 > MAX_SIZE && quality > 0.5) {
  quality -= 0.1
  result = canvas.toDataURL("image/jpeg", quality)
}
```

#### PDF 처리
```typescript
// 필요한 것: 텍스트 파싱 + Vision
// 불필요한 것: 다중 페이지 처리, 이미지 추출, 메타데이터

// 첫 페이지만 처리
execSync(`python "${scriptPath}" "${tmpPdf}" 0`)
```

#### 번역
```typescript
// 필요한 것: EXAONE → Claude 폴백
// 불필요한 것: Google Translate, DeepL, 다국어 지원

// 2가지만 시도
for (const model of ["exaone", "claude"]) {
  // 시도
}
```

### 기능 제외 결정 기준
| 기능 | 필요? | 이유 |
|------|-------|------|
| 다중 페이지 PDF | ❌ | 첫 페이지만으로 충분 |
| 실시간 프리뷰 | ❌ | TTS가 피드백 제공 |
| 이미지 필터 | ❌ | Vision이 충분히 강력 |
| 캐싱 | ❌ | 단순 앱에서는 불필요 |
| 설정 UI | ❌ | 환경변수로 충분 |

---

## 아키텍처 결정 이력

### PDF Vision 처리
**결정:** Claude API → Ollama Vision 변경

**이유:**
- ✓ API 키 오류 제거
- ✓ 로컬 처리로 프라이버시 강화
- ✓ 비용 절감 (무료 로컬)

### PDF 텍스트 추출
**결정:** pdf-parse → pdfjs-dist 레거시 → 직접 정규식

**이유:**
- ✓ 간단한 정규식으로 충분 (바이너리 파싱)
- ✓ 의존성 감소
- ✓ 성능 향상

### Vision 모델 순서
**결정:** 속도순 (moondream → gemma3 → qwen → llama)

**이유:**
- ✓ 빠른 응답 시간
- ✓ PDF는 qwen2.5vl 우선 (텍스트 특화)
- ✓ 사용자 경험 최적화

---

## 결론

READ VOICE Pro MVP의 아키텍처는 **단순성과 명확성**을 최우선으로 합니다.

- **SOLID:** 확장 가능하고 유지보수하기 좋은 구조
- **DRY:** 중복 제거로 버그 감소
- **KISS:** 복잡성 최소화
- **YAGNI:** 필요한 것만 구현

이 원칙들은 초기 개발 속도를 빠르게 하면서도 장기 유지보수성을 확보합니다.
