# READ VOICE Pro MVP

## 프로젝트 개요

**목표:** AI 음성 기반 웹 애플리케이션으로, 시각 장애인과 모든 사용자가 음성만으로 모든 기능을 사용할 수 있도록 설계.

**핵심 가치:**
- 음성 우선 인터페이스 (Voice-First UI)
- 접근성 제일 (A11y-First)
- 한국어 중심 (Korean-First)
- 로컬 처리 (Local-First, 프라이버시 중심)

---

## 기술 스택

### 프론트엔드
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Font:** Pretendard Variable (CDN)
- **UI/A11y:** Web Speech API (ko-KR), aria-label 필수

### 백엔드
- **LLM:** LangChain ChatOllama (로컬)
- **Default Model:** exaone3.5:2.4b
- **이미지 설명 모델 (5개, 정확도 순: Q3 > Gemma4:4G > Llama > Gemma4:2G > GLM):**
  - gemma4:e4b (1분, TTS명: "구글 사기가") - 정확하고 빠름
  - qwen3.5:9b (2분, TTS명: "큐쓰리") - 가장 정확
  - gemma4:e2b (30초, TTS명: "구글 이기가") - 가장 빠름
  - llama3.2-vision (1분 30초, TTS명: "라마비전") - 상세 묘사
  - glm-ocr (10초, TTS명: "지엘엠") - 초고속
- **문서 OCR 모델 (4개):**
  - qwen3.5:9b (30~60초, TTS명: "큐쓰리")
  - richardyoung/olmocr2:7b-q8 (1~2분, TTS명: "올름오씨알", 표/레이아웃 특화)
  - glm-ocr (30~60초, TTS명: "지엘엠")
  - gemma4:e4b (범용 fallback)
- **Translation:** EXAONE (로컬) → Claude API (폴백)
- **Claude Fallback:** claude-haiku-4-5

### 파일 처리
- **이미지:** pdfjs-dist (텍스트 파싱) → Ollama Vision
- **PDF 텍스트:** pdfjs-dist 레거시 빌드
- **PDF 스캔:** pypdfium2 (Python) → PNG 변환 → Ollama Vision
- **압축:** Canvas API (aspect ratio 유지, 800KB 제한)

---

## 색상 팔레트

- **Primary:** #0284C7 (파란색 - 메인 액션)
- **Secondary:** #0D9488 (녹색 - 보조 액션)
- **Background:** #EBF5FF (밝은 파란색 배경)
- **Text:** #1E3A5F (진한 파란색 텍스트)

---

## 개발 규칙 (CRITICAL)

### 타입 안정성
- **`any` 타입 절대 금지** - 모든 타입을 명시적으로 선언
- 함수 입출력 타입 필수
- 제네릭 활용으로 타입 유연성 확보

### LLM 호출 중앙화
- **모든 LLM 호출은 `lib/llm/index.ts`를 통해서만 수행**
- 직접 fetch/API 호출 금지 (Vision 제외 - modules/ocr/*)
- 모델 선택, 폴백 로직을 중앙에서 관리

### 접근성 (A11y)
- **모든 대화형 요소에 `aria-label` 필수**
- 스크린 리더 호환성 필수
- role, aria-live, aria-hidden 적절히 사용
- 시각적 정보에 텍스트 대체 제공

### 코드 품질
- **SOLID 원칙:** Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- **DRY:** 중복 코드 제거
- **KISS:** 단순하고 명확한 구현
- **YAGNI:** 필요한 기능만 구현 (과도한 추상화 금지)

---

## 파이프라인 설계

### 1. 음성 파이프라인 (Voice Pipeline)
```
마이크 (Web Speech API ko-KR)
    ↓ STT (Speech-to-Text)
사용자 입력 (한국어 텍스트)
    ↓
LLM 처리 (exaone3.5 or Claude)
    ↓ 응답 텍스트
TTS (Text-to-Speech, Web Speech API ko-KR)
    ↓ 음성 재생
사용자 청취
```

### 2. Vision 파이프라인 (이미지)
```
이미지 파일 선택
    ↓
TTS: "파일을 확인하고 있어요" + BGM 시작
    ↓
classifyImage (gemma4:e2b, 30초)
    ↓
분류 결과별 TTS:
  [사진] "이미지로 판단했어요"
    → 모델 선택: 구글투지(15~20초) / 구글포지(30~40초) / 라마비전(2~3분)
  [문서] "문서 이미지로 판단했어요"
    → 모델 선택: 큐쓰리(30~60초) / 올름오씨알(1~2분) / 지엘엠(30~60초) / 구글포지(30~40초)
  [혼합] "그림과 글자가 함께 있어요"
    → 선택: 그림 먼저 / 글자 먼저
  [실패] "이미지인지 문서인지 말씀해주세요"
    ↓
STT로 모델 번호 선택
    ↓
선택 모델로 분석 실행
    ↓ 영문 설명 (번역 필요 모델만)
EXAONE 번역 (로컬) → Claude API 폴백
    ↓ 한국어 설명
TTS → 음성 재생
```

### 3. PDF 파이프라인
```
PDF 파일 선택
    ↓
TTS: "PDF 파일을 확인하고 있어요" + BGM 시작
    ↓
extractTextOnly 시도 (한글 10자 이상)
    ↓
[성공] 텍스트 PDF:
  → BGM 중지
  → TTS: "문서를 읽어드릴게요"
  → 텍스트 바로 읽기 (최대 4000자)

[실패] 스캔 PDF:
  → TTS: "스캔된 문서예요. 이미지로 변환해서 읽을게요"
  → pypdfium2로 첫 페이지 PNG 변환
  → TTS: "문서 준비가 됐어요. 어떤 모델로 읽어드릴까요?"
  → 5개 모델 선택:
    1. 큐쓰리 (추천, 30~60초)
    2. 올름오씨알 (레이아웃 특화, 1~2분)
    3. 지엘엠 (문서 전용, 30~60초)
    4. 구글 포지 (범용, 30~40초)
    5. 라마비전 (가장 정밀, 3분)
  → STT로 모델 선택
  → 선택 모델로 분석
  → TTS → 음성 재생
```

---

## 폴더 구조

```
readvoice-mvp/
├── app/
│   ├── page.tsx (메인 페이지)
│   ├── api/
│   │   ├── chat/ (음성 대화)
│   │   ├── ocr/ (파일 처리)
│   │   └── watch-folder/ (폴더 모니터링)
│   └── components/
│       ├── FileUpload.tsx
│       └── ... (UI 컴포넌트)
├── lib/
│   ├── llm/
│   │   └── index.ts (LLM 호출 중앙화)
│   ├── speech/
│   │   └── tts.ts (음성 합성)
│   └── ... (유틸리티)
├── modules/
│   └── ocr/
│       ├── gemini.ts (Vision + 번역)
│       └── pdf.ts (PDF 처리)
├── server/
│   └── pdf-to-image.py (PDF to PNG)
└── docs/
    └── architecture/
        ├── software_architecture.md
        ├── voice_pipeline.md
        └── vision_pipeline.md
```

---

## 주요 기능

### 음성 우선 파일 업로드
- **지원 형식:** JPG, PNG, WEBP, PDF
- **자동 압축:** 800KB 초과 시 aspect ratio 유지하며 축소
- **자동 분류:** classifyImage로 사진/문서/혼합 자동 판단 (gemma4:e2b, 30초)
- **음성 안내:** 분류 결과에 따라 적절한 모델 선택 TTS
- **폴더 경로:** C:/Users/tara0/ReadVoice_Upload

### Voice 대화
- **입력:** Web Speech API (ko-KR)
- **처리:** LangChain ChatOllama (exaone3.5)
- **출력:** Web Speech API (ko-KR) TTS
- **속도 조절:** 1x, 1.2x, 1.5x, 2x (음성 명령 지원)

### 이미지 분석 (5개 모델)
- **구글 사기가 (gemma4:e4b):** 정확하고 빠름 (1분) - 일번
- **큐쓰리 (qwen3.5:9b):** 가장 정확 (2분) - 이번
- **구글 이기가 (gemma4:e2b):** 가장 빠름 (30초) - 삼번
- **라마비전 (llama3.2-vision):** 상세 묘사 (1분 30초) - 사번
- **지엘엠 (glm-ocr):** 초고속 (10초) - 오번
- 음성 명령: "일번~오번" 또는 모델명
- 실사용 추천: 큐쓰리, 구글 사기가

### 문서 OCR (4개 모델)
- **큐쓰리 (qwen3.5:9b):** 추천, 범용 (30~60초)
- **올름오씨알 (olmocr2):** 표/레이아웃 특화 (1~2분)
- **지엘엠 (glm-ocr):** 문서 전용 (30~60초)
- **구글 포지 (gemma4:e4b):** 범용 fallback (30~40초)
- 음성 명령: "일번", "이번", "삼번", "사번" 또는 모델명

### PDF 처리
- **텍스트 PDF:** 자동 텍스트 추출 → 즉시 읽기
- **스캔 PDF:** 자동 감지 → PNG 변환 → 5개 모델 선택 (OCR 4개 + 라마비전)

---

## 설정 (Environment Variables)

```env
# LLM
LLM_PROVIDER=ollama
OLLAMA_MODEL=exaone3.5:2.4b
OLLAMA_BASE_URL=http://localhost:11434

# Claude API (폴백 용)
ANTHROPIC_API_KEY=sk-ant-...

# 파일 처리
UPLOAD_FOLDER_PATH=C:/Users/tara0/ReadVoice_Upload
NEXT_PUBLIC_UPLOAD_FOLDER_HINT=리드보이스 업로드 폴더

# 앱 정보
NEXT_PUBLIC_APP_NAME=READ VOICE Pro
```

---

## 개발 가이드

### 새로운 LLM 호출 추가
1. `lib/llm/index.ts`에 함수 작성
2. 모델 선택 로직 포함
3. 폴백 전략 고려
4. 타입 선언 필수

### UI 컴포넌트 추가
1. aria-label 필수
2. role 속성 명시 (필요 시)
3. Tailwind만 사용 (inline styles 최소화)
4. 색상은 CLAUDE.md 팔레트 사용

### Vision 모델 확장
1. `modules/ocr/gemini.ts`에 모델 추가
2. 타임아웃 설정 (모델별 상이)
3. 번역 프롬프트 통일
4. 영문→한국어 변환 규칙 추가

---

## 성능 목표

- **모든 LLM 응답:** 10초 이내 (단, Vision은 모델별 상이)
- **이미지 분류:** 15~30초 (gemma4:e2b)
- **이미지 설명:**
  - 구글 사기가: 1분
  - 큐쓰리: 2분
  - 구글 이기가: 30초
  - 라마비전: 1분 30초
  - 지엘엠: 10초
- **문서 OCR:**
  - 큐쓰리/지엘엠: 30~60초
  - 올름오씨알: 1~2분
- **PDF 텍스트 추출:** <5초
- **PDF PNG 변환:** <60초
- **TTS:** 실시간 (지연 <100ms)

---

## 알려진 제한사항

1. **Ollama 의존:** 로컬 실행 필수, 서버 배포 미지원
2. **PDF 이미지화:** 첫 페이지만 처리 (다중 페이지는 Vision 한계)
3. **Vision 모델 크기:** 로컬 메모리 필수 (추천: 16GB+)
4. **번역 품질:** EXAONE이 모든 상황을 커버하지 않음 (Claude 폴백 필요)

---

## 버전 관리 규칙

### 버전 저장 (코드나 MD 수정 시 반드시 실행)

```powershell
.\scripts\version-save.ps1 -Version "v버전" -Message "변경내용"
```

### 버전 복구

```powershell
.\scripts\version-restore.ps1 -Version "v1.2.3"
```

### 버전 형식

- **v1.x.x:** Phase 1 (STT/LLM/TTS)
- **v2.x.x:** Phase 2 (OCR/Vision) ← **현재**
- **v3.x.x:** Phase 3 (웹검색)
- **마이너(x.1.x):** 기능 추가
- **패치(x.x.1):** 버그 수정

### 버전 히스토리

전체 버전 기록: `docs/versions/VERSION_HISTORY.md`

---

**현재 버전:** v2.7.2  
**마지막 업데이트:** 2026-04-30  
**Phase:** Phase 2 (OCR/Vision)  
**주요 변경:** 라마비전 텍스트 읽기 능력 대폭 강화 (TEXT READING PRIORITY)
