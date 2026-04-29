# READ VOICE Pro — 세션 인수인계 문서
생성일: 2026-04-29
버전: v2.6.0

---

## 프로젝트 개요
시각장애인, 거동불편인, 노인을 위한 AI 음성 도우미.
말로 묻고 → 말로 진행 → 말로 답한다. 버튼/UI는 보조 수단.
온디바이스(Ollama) 기반. API 최소화.

## 프로젝트 경로
C:\Users\tara0\readvoice-mvp

## GitHub
https://github.com/nantashin/readvoice-mvp

## 서버 실행 방법 (매일 시작 시)
창 1: ollama serve
창 2: cd C:\Users\tara0\readvoice-mvp && npm run dev
창 3: claude (Claude Code)
브라우저: http://localhost:3000

---

## 설치된 Ollama 모델
- gemma4:e2b → 구글 이기가 (이미지 묘사, 빠름 15~20초)
- gemma4:e4b → 구글 사기가 (이미지 묘사, 균형 30~40초)
- llama3.2-vision:11b-instruct-q4_K_M → 라마비전 (정밀 2~3분)
- qwen3.5:9b → 큐쓰리 (문서 OCR)
- richardyoung/olmocr2:7b-q8 → 올름오씨알 (레이아웃 특화, 미테스트)
- glm-ocr → 지엘엠 (파이프라인에서 제거, 파일 유지)
- exaone3.5:2.4b → 엑사원 (한국어 번역용)

---

## 완료된 기능 (작동 확인)

### Phase 1 완료 ✅
- STT (Web Speech API 한국어)
- LLM 응답 (Ollama EXAONE)
- TTS (마크다운 제거, 자연스러운 한국어)
- 스페이스바로 음성 제어
- 음성 속도 조절 (1x/1.2x/1.5x/2x)
- BGM 5곡 플레이리스트
- BGM 덕킹 (TTS 시 볼륨 자동 감소 → 복원)
- 자연어 명령 (멈춰/다시/처음으로/모델바꿔 등)

### Phase 2 진행 중 🔄
- 이미지 분석: gemma4 2종 + llama3.2-vision ✅ 작동
- 이미지 자동 분류 (사진/문서/혼합) ✅ 작동
- TTS 전처리 시스템 ✅ 작동
  - 마크다운 기호 제거
  - 숫자/수식 한국어 읽기
  - 특수기호 제거 (별표사인 등)
  - 문장부호 멈춤
- PDF OCR ❌ 미완성 (핵심 이슈)

---

## 핵심 이슈: PDF OCR 실패

### 증상
- PowerShell에서 직접 실행 → ✅ 성공
- 브라우저에서 실행 → ❌ fetch failed / 빈 응답

### 현재 파이프라인 (modules/ocr/pdf.ts)
1. pdfjs 텍스트 추출 시도
2. 실패 시 pypdfium2로 PNG 변환
3. pdf-enhance.py로 화질 강화
4. Tesseract로 초안 추출 (kor+eng)
5. Vision LLM으로 교정 → 최종 출력

### 문제점
- Tesseract 성공 (862자 추출) ✅
- Vision LLM (qwen3.5:9b) 빈 응답 반환 ❌
- 사용자가 구글2G 선택해도 자동으로 qwen으로 넘어가는 버그 ❌

### 관련 파일
- modules/ocr/pdf.ts (메인 파이프라인)
- app/api/ocr/route.ts (모델 라우팅)
- server/tesseract-ocr.py (Tesseract 실행)
- server/pdf-enhance.py (화질 강화)
- server/glm-ocr.py (비활성, 파일 유지)

### 환경변수 (.env.local)
PYTHON_BIN=C:\Users\tara0\AppData\Local\Programs\Python\Python313\python.exe
TESSERACT_PATH=C:\Users\tara0\AppData\Local\Programs\Tesseract-OCR\tesseract.exe

---

## 다음 작업 우선순위

### P1 — 즉시 해결 필요
1. PDF OCR 모델 선택 버그 수정
   - app/api/ocr/route.ts에서 사용자 선택 모델이 무시되고
     qwen으로 고정되는 부분 찾아서 수정
   - 파일: app/api/ocr/route.ts

2. Vision LLM 빈 응답 문제 해결
   - Tesseract 초안을 컨텍스트로 줬을 때
     qwen3.5:9b가 빈 응답 반환하는 원인 파악
   - gemma4:e2b로 테스트해서 모델 문제인지 코드 문제인지 확인
   - 파일: modules/ocr/pdf.ts

### P2 — 이번 주
3. BGM 자연어 명령 추가
   - "BGM 꺼줘" → bgmManager.stop()
   - "BGM 줄여줘" → bgmManager 볼륨 감소
   - 파일: app/page.tsx

4. 모델 선택 안내 끊김 완전 해결
   - 모델 메뉴 TTS가 구글 사기가 이후 끊기는 문제
   - 파일: app/page.tsx

### P3 — 다음 주
5. Phase 2 나머지
   - 대화 기록 저장
   - PWA 설치 가능하게
   - 웹 검색 연동 (Phase 3 준비)

6. olmOCR2 테스트
   - richardyoung/olmocr2:7b-q8 아직 미테스트
   - 레이아웃 특화 모델이라 PDF OCR에 유용할 수 있음

---

## 새 세션 시작 시 Claude Code 입력 문구
