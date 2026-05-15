# READ VOICE PRO (가칭 IYE:V2V)

> READ VOICE PRO 가칭 'IYE:V2V'는 음성으로 시작하는 접근성 오케스트레이터입니다.
> 시각장애인에게는 눈이 되고, 거동불편인에게는 손이 되며,
> 노인에게는 복잡한 디지털 절차를 말로 풀어주는 안내자가 됩니다.
> 하나의 음성 입구에서 문서 읽기, 이미지 설명, 화면 안내,
> 웹 작업 보조, 사람 연결을 상황별로 제공합니다.

---

## 핵심 사용자

- **시각장애인** — 말로만 모든 기능 사용
- **거동불편인** — 손 대신 말로 PC/웹 조작
- **노인** — 공공서비스, 민원, 병원 등 절차 안내

---

## 3단계 서비스 구조

| 단계 | 모델 | 목적 |
|------|------|------|
| 무료형 | Ollama 로컬 (Qwen, SOLAR, Gemma4) | 누구나 설치 없이 바로 사용 |
| 저가형 | Gemini API / Claude API | 속도와 정확도 개선 |
| VIP/납품형 | 최고품질 API + SOLAR(한국산) | 공공기관·병원·키오스크 납품 |

---

## 현재 구현된 기능 (v2.9.0)

- ✅ 음성으로 파일 선택 (번호 또는 파일명)
- ✅ 이미지 분석 — 8종 유형별 최적화 프롬프트
  (사진/문서/혼합/영수증/명함/차트/약봉투/QR코드)
- ✅ PDF OCR — 텍스트/스캔 자동 분류
- ✅ 음성 명령 — 다시/멈춰/천천히/빠르게/처음으로
- ✅ 음성 선택 — 선희(밝음)/유진(차분)/현수(남성)
- ✅ Edge TTS — Azure Neural 품질 한국어 음성
- ✅ 세션 관리 — 타임아웃 시 부드러운 음성 안내

---

## 개발 중인 기능

- 🔄 Phase 3: 웹 검색 에이전트 (음성으로 검색 요약)
- 📅 Phase 4: PWA + 오프라인 지원 + 공공서비스 안내
- 📅 Phase 5: Computer Use + 키오스크 보조 + 사람 연결
- 📅 Phase 6: B2G 파일럿 납품 + 설치형 패키지

---

## 안전 정책

AI가 단독으로 하지 않는 것:
결제, 송금, 민원 신청 최종 제출, 개인정보 입력,
계정 삭제, 의료·법률·금융 판단

> AI는 설명하고 준비합니다.
> 사용자가 확인합니다.
> 위험 행동은 기록하고 되돌릴 수 있게 합니다.
> 불확실하면 사람에게 연결합니다.

---

## 납품 원칙 (B2G/B2B)

- 납품 허용: SOLAR (한국, Apache 2.0), Claude API (미국)
- 무료형 전용: Qwen (중국), Gemma4 (구글)
- 모든 납품 모델은 Apache 2.0 또는 상업 계약 기준

---

## 실행 방법

```bash
# 1. Ollama 설치 후 모델 다운로드
ollama pull qwen3.5:4b
ollama pull solar:10.7b

# 2. 의존성 설치
npm install
pip install edge-tts

# 3. 환경변수 설정
cp .env.example .env.local
# .env.local 에서 ANTHROPIC_API_KEY 설정

# 4. 개발 서버 실행
ollama serve
npm run dev
```

---

## 기술 스택

- **Frontend**: Next.js 16, TypeScript, React 19
- **음성**: Web Speech API (STT) + Edge TTS (Azure Neural)
- **AI 모델**: Ollama 로컬 + Claude API + Gemini API
- **OCR/Vision**: Gemma4, Qwen3.5, SOLAR, Llama3.2-vision, olmOCR2

---

## 저장소

https://github.com/nantashin/readvoice-mvp

---

_이 프로젝트는 시각장애인·거동불편인·노인이 디지털 세상에서 덜 막히게 만드는 서비스입니다._
