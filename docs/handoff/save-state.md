# 작업 인계 (Account Handoff)

## 현재 상태
- **날짜:** 2026-05-14 (목요일) 저녁
- **버전:** v2.9.0 ✅ (Phase 2 완성)
- **브랜치:** master
- **Git 상태:** cfa39ac 커밋 완료
- **최근 커밋:** cfa39ac - feat: Qwen3.5:4b 번역/대화 모델 교체 완료 (P2)

## 최근 커밋 (오늘 작업)
```
cfa39ac - feat: Qwen3.5:4b 번역/대화 모델 교체 완료 (P2) ⭐ (최종)
a743ad7 - feat: SOLAR:10.7b 한국산 모델 설치 완료 (P1)
474cb8d - feat: GLM-OCR 모델 삭제 완료 (P0)
7a8405f - docs: 내일 작업 계획 업데이트 - 모델 교체 테스트
28d5a23 - docs: 다음주 → 내일(2026-05-14) 업데이트 + 모델 정리 작업 상세화
```

**오전:** 7a8405f (작업 계획 업데이트)  
**오후:** 474cb8d (P0), a743ad7 (P1), cfa39ac (P2) 완료

## 오늘 (5월 14일) 완료 작업

### ✅ [P0] GLM-OCR 모델 삭제 완료
- **ollama rm glm-ocr** 실행
- **modules/ocr/gemini.ts:** GLM 모델 정의 및 프롬프트 제거
  - KOREAN_NATIVE_MODELS 배열에서 제거
  - GLM_OCR_PROMPT 17줄 삭제
  - isGlmOCR 변수 및 조건문 제거
  - timeouts 객체에서 제거
- **CLAUDE.md:** GLM 관련 문서 전체 제거
  - 이미지 모델: 5개 → 4개
  - 문서 OCR: 4개 → 3개
  - PDF 모델: 5개 → 4개
  - 음성 명령: "일번~오번" → "일번~사번"
- **배경:** 품질 불량 + 중국산 + 납품 불가
- **커밋:** `474cb8d`

### ✅ [P1] SOLAR:10.7b 한국산 모델 설치 완료
- **ollama pull solar:10.7b** 실행 (6.1 GB)
- **CLAUDE.md:** SOLAR 모델 추가
  - 이미지 모델: 4개 → 5개 (solar 추가)
  - 문서 OCR: 3개 → 4개 (solar 추가)
  - PDF 모델: 4개 → 5개 (solar 추가)
  - 음성 명령: "일번~사번" → "일번~오번"
- **TTS명:** "솔라"
- **성능:** 1.5~2분 추정 (실제 테스트 필요)
- **배경:** 한국산 Upstage, Apache 2.0 라이선스, 납품 가능
- **커밋:** `a743ad7`

### ✅ [P2] Qwen3.5:4b 번역/대화 모델 교체 완료
- **ollama pull qwen3.5:4b** 실행
- **.env.local:** `OLLAMA_MODEL=qwen3.5:4b` 변경
- **CLAUDE.md:** Default Model, Translation, Voice 처리 업데이트
  - EXAONE → Qwen3.5로 전체 교체
  - 음성 파이프라인, Vision 파이프라인 설명 업데이트
- **app/api/chat/route.ts:** thinking mode 억제 추가
  - SYSTEM_PROMPT에 "생각 과정(<think> 블록)을 절대 출력하지 마세요" 추가
- **modules/ocr/gemini.ts:** translateToKorean 함수 업데이트
  - 모델: exaone3.5:2.4b → qwen3.5:4b
  - thinking mode 억제 추가
  - 로그 메시지: "EXAONE" → "Qwen3.5"
- **배경:** 번역/대화 품질 개선, qwen 모델의 thinking 블록 제거로 응답 속도 개선
- **커밋:** `cfa39ac`

## 다음 세션 할 일 (2026-05-15 이후)

### [P3] 4개 모델 비교 테스트 📊
**테스트 모델:**
- [ ] qwen3.5:4b (번역/대화)
- [ ] solar:10.7b (한국산 Vision)
- [ ] gemma4:e4b (Google Vision)
- [ ] llama3.2-vision (Meta Vision)

**비교 항목:**
- [ ] 한국어 출력 품질
- [ ] 번역 품질 (영어→한국어)
- [ ] 응답 속도 (초 단위)
- [ ] 메모리 사용량
- [ ] 결과를 마크다운 비교표로 정리

### [TTS 개선] Web Speech API → Edge TTS 교체
- [ ] Edge TTS 설치 및 연동
- [ ] 음성 선택: sun-hi / yu-jin / hyunsu
- [ ] 음성 명령 유지 (일번~오번, 천천히/빠르게, 다시, 멈춰)
- [ ] 기존 Web Speech API 코드 대체

### [P4] 배포 모드 분기 설계 🔀
- [ ] `lib/llm/router.ts` 파일 신규 생성
- [ ] `DEPLOY_MODE` 환경변수 기반 모델 라우팅 설계
  - `public`: qwen, gemma, llama (범용)
  - `enterprise`: solar, claude API (납품용)
- [ ] 납품 제약사항 주석 추가 (중국산 제외, Apache 2.0만 허용)

## 알려진 이슈

### 없음 ✅
- Phase 2의 모든 주요 이슈 해결 완료
- 일일 보고서 자동화 안정화 완료

## 저장소
https://github.com/nantashin/readvoice-mvp

## 빌드 상태
- Node.js: v24.13.0
- npm: 11.6.2
- Ollama: 실행 중 ✅
- pptxgenjs: 설치됨 ✅
- Dev 서버: localhost:3000

## 핵심 파일 (오늘 수정)
- `modules/ocr/gemini.ts`: GLM 모델 제거 (P0)
- `CLAUDE.md`: 모델 목록 업데이트 (GLM 제거, SOLAR 추가)
- `docs/_orchestration/HANDOFF.md`: P0/P1 완료 표시
- `docs/handoff/save-state.md`: 이 파일 (계정 전환 후 시작 메시지)

## 참고 문서
- 오늘 커밋: `474cb8d` (P0), `a743ad7` (P1)
- 버전 히스토리: `docs/versions/VERSION_HISTORY.md`
- HANDOFF: `docs/_orchestration/HANDOFF.md`
- 일일 루틴: `docs/_orchestration/DAILY_ROUTINE.md`

---

## 📋 계정 전환 후 시작 메시지 (복사용)

```
안녕! 계정 전환 후 이어받았어.

docs/_orchestration/HANDOFF.md 읽고 다음 작업 확인해줘.

오늘 (2026-05-14) 완료:
✅ P0: GLM-OCR 삭제 완료 (474cb8d)
✅ P1: SOLAR:10.7b 설치 완료 (a743ad7)
✅ P2: Qwen3.5:4b 번역/대화 모델 교체 완료 (cfa39ac)

다음 작업:

P3: 4개 모델 비교 테스트 📊
  - qwen3.5:4b / solar:10.7b / gemma4:e4b / llama3.2-vision
  - 한국어 품질, 번역 품질, 응답 속도 비교표 작성

TTS 개선: Web Speech API → Edge TTS
  - sun-hi / yu-jin / hyunsu 음성 선택
  - 음성 명령 유지

P4: lib/llm/router.ts DEPLOY_MODE 분기 설계
  - public: qwen, gemma, llama
  - enterprise: solar, claude API

P3부터 시작하자!
```

---

## 🌙 오후 마무리 체크리스트 (계정 전환 전)

오늘 오후 완료:
- [x] P0: GLM-OCR 삭제 완료
- [x] P1: SOLAR:10.7b 설치 완료
- [x] P2: Qwen3.5:4b 번역/대화 모델 교체 완료
- [x] HANDOFF.md 업데이트 (P0/P1/P2 완료 표시)
- [x] save-state.md 업데이트 (P3부터 재개)
- [x] git push origin master

**다음 작업:** 계정 전환 후 P3부터 재개  
**다음 목표:** 4개 모델 비교 테스트

---

**마지막 업데이트:** 2026-05-14 저녁  
**다음 계정 로그인 시 이 파일 먼저 읽기**
