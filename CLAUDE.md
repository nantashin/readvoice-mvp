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
- **Vision Models:** moondream, gemma3:4b, qwen2.5vl:7b, llama3.2-vision
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
파일 선택 (이미지/PDF)
    ↓
모델 자동 선택 (파일 타입별)
    ↓ 크기 조정 (800KB 제한)
Ollama Vision 순차 시도:
  1. moondream (5~15초)
  2. gemma3:4b (10~20초)
  3. qwen2.5vl:7b (20~40초) ← PDF는 우선
  4. llama3.2-vision (1~3분)
    ↓ 영문 설명
EXAONE 번역 (로컬)
    ↓ Claude API 폴백
한국어 설명
    ↓ TTS → 음성 재생
```

### 3. PDF 파이프라인
```
PDF 파일 선택
    ↓
2가지 경로:

텍스트 PDF (pdf-parse 성공):
  → 텍스트 추출 (최대 4000자)
  → 직접 반환

스캔 PDF (pdf-parse 실패):
  → pypdfium2로 첫 페이지만 PNG 변환
  → qwen2.5vl:7b Vision 시도
  → llama3.2-vision 폴백
  → 한국어 텍스트 반환
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

### 파일 업로드
- **지원 형식:** JPG, PNG, WEBP, PDF
- **자동 압축:** 800KB 초과 시 aspect ratio 유지하며 축소
- **모델 선택:** PDF는 qwen2.5vl:7b 자동 선택
- **폴더 경로:** C:/Users/tara0/ReadVoice_Upload

### Voice 대화
- **입력:** Web Speech API (ko-KR)
- **처리:** LangChain ChatOllama (exaone3.5)
- **출력:** Web Speech API (ko-KR) TTS

### 파일 분석
- **이미지:** Vision 모델 + 자동 번역
- **PDF 텍스트:** 직접 추출
- **PDF 스캔:** Vision 분석 → 한국어 변환

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
- **이미지 압축:** <1초
- **PDF 처리:** <30초
- **TTS:** 실시간 (지연 <100ms)

---

## 알려진 제한사항

1. **Ollama 의존:** 로컬 실행 필수, 서버 배포 미지원
2. **PDF 이미지화:** 첫 페이지만 처리 (다중 페이지는 Vision 한계)
3. **Vision 모델 크기:** 로컬 메모리 필수 (추천: 16GB+)
4. **번역 품질:** EXAONE이 모든 상황을 커버하지 않음 (Claude 폴백 필요)

---

**마지막 업데이트:** 2026-04-23  
**버전:** v1.0.0-pre-codex
