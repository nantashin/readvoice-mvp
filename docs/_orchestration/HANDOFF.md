# Session Handoff

**마지막 업데이트:** 2026-05-14  
**현재 버전:** v2.9.0 🎉  
**다음 버전 목표:** v3.0.0 (Phase 3 시작)

---

## 완료된 작업 (Phase 2 완성 🎉)

### ✅ 음성 명령 완성 (v2.8.x)
- "다시" 명령: lastSpoken으로 마지막 멘트 재생
- "멈춰" 명령: TTS/BGM 즉시 중단
- 모델 선택: 일번~오번 (5개 모델)
- 속도 조절: 천천히/빠르게 (±0.5 배속)
- 메뉴 제어: 처음으로 (메인 메뉴 복귀)

### ✅ 보안 강화 (v2.8.x)
- watch-folder: 절대 경로 노출 제거, 10MB 필터
- read-file: path.relative() 안전 검증, 10MB 제한
- open-folder: execFile로 커맨드 인젝션 방지
- Codex Critical 이슈 완전 해결

### ✅ 이미지 8종 프롬프트 (v2.9.0)
- ImageType 8종 정의: photo/document/mixed/receipt/namecard/chart/medicine/qrcode
- 유형별 전용 프롬프트 8개 추가
- classifyImage 8종 분류
- 자동 유형 안내 TTS ("영수증으로 판단했어요")

### ✅ UX 개선 - 30초 절약 (v2.9.0)
- FileUpload classifyImage 중복 제거 (30초 절약)
- /api/ocr에서만 8종 분류 수행 (한 번만)
- 불필요한 이벤트 핸들러 3개 제거 (45줄)
- 코드 간소화: FileUpload 60줄 → 20줄

### ✅ 세션 관리 최적화
- SESSION_TIMEOUT: 10분 (600000ms)
- FEEDBACK_WINDOW: 30초 (30000ms)
- 파일 자동 삭제 제거

### ✅ 인프라
- TypeScript strict mode 유지
- CI 워크플로우 (npm install → lint → build)
- orchestration 폴더 (TODAY.md, HANDOFF.md)
- daily-report.ps1 완성 (2026-05-13)
  - Phase 상태 표시 (save-state.md 덤프 제거)
  - 오늘 커밋만 필터링 (날짜 기반)
  - PS5.1 호환성 (Join-String 제거, 이모지 → 아스키)
  - 로드맵 PPTX 자동 생성 (roadmap_YYYYMMDD.pptx)

---

## 오늘 완료된 작업 (2026-05-14 목요일) ✅

### ✅ [P0] GLM-OCR 삭제 완료
- `ollama rm glm-ocr` 실행
- `modules/ocr/gemini.ts`: GLM 모델 정의/프롬프트 제거
- `CLAUDE.md`: 이미지 모델 5→4개, 문서 OCR 4→3개, PDF 5→4개
- 커밋: `474cb8d` - feat: GLM-OCR 모델 삭제 완료 (P0)

### ✅ [P1] SOLAR:10.7b 설치 완료
- `ollama pull solar:10.7b` 실행 (6.1 GB)
- `CLAUDE.md`: 이미지 모델 4→5개, 문서 OCR 3→4개, PDF 4→5개
- TTS명: "솔라", 성능: 1.5~2분 추정
- 커밋: `a743ad7` - feat: SOLAR:10.7b 한국산 모델 설치 완료 (P1)

### ✅ [P2] Qwen3.5:4b 번역/대화 모델 교체 완료
- `ollama pull qwen3.5:4b` 실행
- `.env.local`: `OLLAMA_MODEL=qwen3.5:4b`
- `CLAUDE.md`: Default Model, Translation, Voice 처리 업데이트 (EXAONE → Qwen3.5)
- `app/api/chat/route.ts`: thinking mode 억제 추가
- `modules/ocr/gemini.ts`: translateToKorean 함수 qwen3.5:4b + thinking mode 억제
- 커밋: `cfa39ac` - feat: Qwen3.5:4b 번역/대화 모델 교체 완료 (P2)

---

## 다음에 할 일 (2026-05-15 이후)

### [P3] 4개 모델 비교 테스트 📊
**테스트 모델:**
- `qwen3.5:4b` (번역/대화)
- `solar:10.7b` (한국산 Vision)
- `gemma4:e4b` (Google Vision)
- `llama3.2-vision` (Meta Vision)

**비교 항목:**
- 한국어 출력 품질
- 번역 품질 (영어→한국어)
- 응답 속도 (초 단위)
- 메모리 사용량

**결과 형식:** 마크다운 비교표 생성

---

### [TTS 개선] Web Speech API → Edge TTS 교체
**배경:** 더 자연스러운 한국어 TTS 필요

**작업:**
- Edge TTS 설치 및 연동
- 음성 선택: sun-hi / yu-jin / hyunsu
- 음성 명령 유지 (일번~오번, 천천히/빠르게, 다시, 멈춰)
- 기존 Web Speech API 코드 대체

---

### [P4] 배포 모드 분기 설계 🔀
**파일:** `lib/llm/router.ts` (신규 생성)

**설계 내용:**
```typescript
// DEPLOY_MODE 환경변수 기반 모델 라우팅
// - public: qwen, gemma, llama (범용)
// - enterprise: solar, claude API (납품용)
```

**납품 제약사항:**
- ❌ 납품 제외: qwen(중국), glm(중국)
- ✅ 납품 허용: solar(한국), claude API(미국), gemma(Google), llama(Meta)
- 📄 라이선스: Apache 2.0 모델만 납품 계약서 명시
- 📦 납품 버전: 모델 다운로드 포함 패키지 제공

---

### [추가 작업] 실제 이미지 테스트 🔬
- **영수증** 이미지로 금액/날짜 추출 테스트
- **명함** 이미지로 이름/연락처 추출 테스트
- **차트** 이미지로 수치 설명 테스트
- **약봉투** 이미지로 복용법 우선 읽기 테스트
- **QR코드** 이미지로 URL 추출 테스트
- 8종 프롬프트 품질 검증 및 개선

---

### [Phase 3 준비] 웹 검색 기능 설계
- Google Search API 또는 Serper API 연동 방안
- YouTube 검색 및 요약 기능 설계
- "유튜브에서 ○○ 찾아줘" 음성 명령 파이프라인
- 검색 결과 TTS 요약 전략

---

## 막힌 부분

### 없음 (Phase 2 완전 완성 ✅)
- 모든 주요 이슈 해결됨
- /api/open-folder 500 에러: execFile로 전환하여 해결

---

## 내일 아침(2026-05-15)에 알려줄 것

1. **오늘(05-14) 완료 🎉:**
   - P0: GLM-OCR 삭제 완료
   - P1: SOLAR:10.7b 설치 완료 (한국산 모델)
   - P2: Qwen3.5:4b 번역/대화 모델 교체 완료 (thinking mode 억제 포함)
   
2. **다음 작업 우선순위:**
   - P3: 4개 모델 비교 테스트 (qwen3.5:4b / solar / gemma4 / llama3.2)
   - TTS 개선: Web Speech API → Edge TTS (sun-hi/yu-jin/hyunsu)
   - P4: lib/llm/router.ts DEPLOY_MODE 분기 설계
   
3. **납품 준비 상태:**
   - ❌ 제외: qwen(중국), glm(중국)
   - ✅ 허용: solar(한국), claude API, gemma(Google), llama(Meta)
   - Apache 2.0 라이선스만 납품 가능

---

## 컨텍스트 복구용 핵심 정보

### 프로젝트 구조
```
app/page.tsx - 메인 UI + 음성 로직 (MenuState 14번째 줄)
lib/session/session-manager.ts - 세션 타임아웃 관리
app/api/watch-folder/route.ts - 파일 목록 반환
app/api/read-file/route.ts - 파일 Base64 변환
app/api/open-folder/route.ts - Windows 탐색기 실행
```

### 환경 변수
```
UPLOAD_FOLDER_PATH=C:/Users/tara0/readvoice-mvp/public/ReadVoice_Upload
```

### 중요 규칙
- **파일 삭제 절대 금지** (사용자 작업 공간)
- **any 타입 금지** (TypeScript strict mode)
- **LLM 호출은 lib/llm/index.ts 경유** (중앙화)
- **접근성 필수** (aria-label 필수, 음성 우선)
- **장애 언급 금지** (patronizing 방지)
