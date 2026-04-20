# READ VOICE Pro — 개발 마스터플랜 v2
> 최초 작성: 2026-04-15 | 전면 개정: 2026-04-17
> 관리자: Claude (Orchestrator) | 기획자: NANTA
> 핵심 원칙: **계획 승인 전 코드 없음** + **최소 비용 운영**

---

## 📌 이 플랜의 3가지 핵심 변화 (v1 → v2)

| 항목 | v1 (기존) | v2 (개정) |
|------|-----------|-----------|
| 워크플로우 | 바로 코딩 | Research → Plan → Annotation → 코딩 |
| AI 비용 | Claude API 의존 | 오픈소스 우선, API는 보조 |
| 배포 전략 | Vercel SaaS | 3트랙 병렬 (온디바이스/SaaS/하이브리드) |

---

## 💰 핵심 질문 3가지 답변

### Q1. API 키는 있는데 유료 플랜을 구매해야 하나?

**NO. 유료 월정액 플랜은 불필요.**

```
Anthropic API = 종량제 (Pay-as-you-go)
→ 신용카드 등록 + 크레딧 충전만 하면 됨
→ 월정액 구독 없음
→ 쓴 만큼만 과금

추천 방법:
1. console.anthropic.com → Billing → Add credit
2. $10~20 충전 (MVP 개발에 충분)
3. claude-haiku-4-5 모델 사용 시 매우 저렴
   (1M 토큰 입력 $0.80, 출력 $4.00)
```

> 💡 **Pro 요금제(claude.ai)와 API는 완전히 별개**
> claude.ai Pro = 웹에서 대화용 (지금 쓰는 것)
> Anthropic API = 앱/서비스 개발용 (별도 결제)

---

### Q2. 최소 비용 운영을 위한 오픈소스 스택

**목표: API 비용 = $0 (운영 시)**

<citation index="60-1">Whisper + Ollama + Kokoro TTS 조합으로 완전 로컬 음성 AI 구현 가능.
API 키 없음, 인터넷 불필요, 토큰 과금 없음.</citation>

```
STT (음성→텍스트): Whisper (OpenAI 오픈소스, 무료)
LLM (AI 두뇌):    Ollama + Llama3 / Gemma3 (무료, 로컬)
TTS (텍스트→음성): Kokoro TTS (82M 파라미터, Apache 2.0, 무료)
```

---

### Q3. ON DEVICE vs SaaS vs 하이브리드

```
3가지 트랙을 단계별로 진행:

Phase 1 (지금)    → SaaS API 방식 (MVP 빠르게)
Phase 2 (1~2개월) → 자체 서버 SaaS (비용 절감)
Phase 3 (3개월+)  → 온디바이스 (NeMo/Ollama, 미니PC)
```

---

## 🏗️ 3가지 배포 트랙 상세 비교

### 트랙 A: SaaS (클라우드 서버)

```
구성: 서버 임대 + 오픈소스 모델 직접 호스팅
서버: 가비아 or AWS EC2 (GPU 인스턴스)
비용: 월 5만~30만원 (서버 사양에 따라)

권장 서버 스펙 (최소):
- CPU: 8코어 이상
- RAM: 16GB 이상
- GPU: NVIDIA T4 (AWS g4dn.xlarge, 시간당 약 $0.5)
- SSD: 100GB

오픈소스 모델 호스팅:
- Ollama: LLM 서빙
- Faster-Whisper: STT
- Kokoro TTS: TTS
→ 월 API 비용 = $0
```

**가비아 vs AWS 비교:**

| 항목 | 가비아 VPS | AWS EC2 |
|------|-----------|---------|
| 가격 | 월 3만~15만 | 시간당 과금 |
| GPU | 없음 | g4dn.xlarge ($0.5/h) |
| 한국 서버 | ✅ | ✅ (서울 리전) |
| 추천 용도 | CPU 전용 서비스 | GPU 필요 시 |

> 💡 **MVP는 GPU 없이도 가능** (CPU 모드, 약간 느림)
> 추후 사용자 증가 시 GPU 추가

---

### 트랙 B: ON DEVICE (미니PC/노트북)

```
구성: 미니PC에 모든 AI 직접 설치
기반: Ollama + Whisper + Kokoro TTS
보안성: 최고 (데이터 외부 전송 없음)
운영비: $0 (인터넷 연결만 필요)

권장 미니PC 사양:
- CPU: Intel Core i7 또는 AMD Ryzen 7
- RAM: 32GB (LLM 구동에 필수)
- SSD: 512GB
- GPU: NVIDIA RTX 3060 (옵션, 속도 향상)
- 가격: 70만~200만원

NeMo 활용 (Phase 4):
- NVIDIA NeMo Framework
- 보안 최고 등급
- GPU 필수 (CUDA)
- 복잡하지만 가장 강력
```

---

### 트랙 C: 하이브리드 (권장)

```
SaaS + 온디바이스 조합:
- 일반 사용자: 클라우드 SaaS (구독)
- 기관·보안 필요: 온프레미스 (미니PC 납품)
→ B2C = SaaS 월 구독
→ B2G/B2B = 온프레미스 번들
```

---

## 🛠️ 오픈소스 AI 스택 (비용 최적화)

### 최종 선택 스택

```
STT: faster-whisper (Whisper 경량화 버전)
     - 한국어 지원 ✅
     - CPU에서도 실시간 가능
     - 설치: pip install faster-whisper

LLM: Ollama + Gemma3:8b 또는 Qwen3:8b
     - 한국어 성능 좋음
     - 8GB RAM에서 구동 가능
     - 설치: ollama pull gemma3:8b

TTS: Kokoro TTS (82M 파라미터)
     - Apache 2.0 라이선스 (상업 사용 가능)
     - 한국어 음성: 추가 파인튜닝 필요
     - 대안: Google TTS API (월 100만자 무료)
     - 설치: pip install kokoro-onnx

OCR: NARA OCR (나라지식정보 자체 기술) ← 핵심 경쟁력
     - 없으면: Tesseract (무료) or Gemini Vision API
```

### 비용 시나리오 비교

| 구성 | 초기 비용 | 월 운영비 | 장점 | 단점 |
|------|----------|---------|------|------|
| 완전 오픈소스 로컬 | 서버/PC 구매 | 서버비만 | $0 API | 성능 제한 |
| API 방식 | 없음 | $20~200 | 빠른 구현 | 사용량 증가시 비용 |
| 하이브리드 | 서버비 | 최소화 | 균형 | 복잡도 |
| **MVP 추천** | 없음 | $0~10 | 가장 빠름 | 나중에 마이그레이션 |

---

## 📋 개발 워크플로우: 계획/실행 분리

<citation index="59-1">핵심 원칙: "계획 승인 전에는 Claude에게 코드를 쓰게 하지 않는다."
전체 과정: Research → Plan → Annotation → Todo List → Implementation → Feedback</citation>

### 각 단계 설명

```
1. Research (조사)
   Claude가 기술/코드베이스 분석 → research.md 저장
   → "아직 코딩 하지 마. research.md만 작성해줘."

2. Plan (계획)
   Research 바탕으로 구현 계획 → plan.md 저장
   → "아직 코딩 하지 마. plan.md만 작성해줘."

3. Annotation (주석 검토)
   내가 plan.md 열어서 직접 코멘트 추가
   → "내 주석 반영해서 plan.md 업데이트해줘. 아직 코딩 말고."
   → 이 과정 1~6회 반복

4. Todo List (작업 목록)
   세부 체크리스트 생성
   → "plan.md 기반으로 todo list 추가해줘."

5. Implementation (구현)
   모든 결정 완료 후 한 번에 실행
   → "이제 구현해. 멈추지 말고 todo 다 완료할 때까지."

6. Feedback (피드백)
   짧고 명확하게: "이 함수 빠졌어", "여기 색상 바꿔"
   잘못됐으면: git revert → 범위 축소 재시도
```

### READ VOICE Pro 개발에 적용

```
각 기능별 폴더 구조:
readvoice-mvp/
├── CLAUDE.md              ← 프로젝트 전체 지침
├── docs/
│   ├── research.md        ← 기술 조사 결과
│   ├── plan.md            ← 구현 계획 (내가 주석 달기)
│   └── todo.md            ← 세부 작업 목록
├── src/
│   ├── stt/               ← 음성 입력
│   ├── tts/               ← 음성 출력
│   ├── llm/               ← AI 연결
│   └── ui/                ← 화면
```

---

## 🚀 MVP 개발 순서 (수정된 버전)

### Step 0: 환경 설정 (1시간)

```powershell
# 1. 프로젝트 폴더
mkdir C:\Users\tara0\readvoice-mvp
cd C:\Users\tara0\readvoice-mvp

# 2. Ollama 설치 (로컬 LLM)
# https://ollama.com/download 에서 Windows 설치
ollama pull gemma3:8b        # 한국어 LLM (5GB)
ollama pull llama3.2:3b      # 가벼운 버전 (2GB)

# 3. Python 패키지
pip install faster-whisper kokoro-onnx sounddevice

# 4. Node.js 프로젝트
npx create-next-app@latest . --typescript --tailwind --app
```

### Step 1: Research (Claude Code에서)

```
# Claude Code 실행
claude

# 입력:
"READ VOICE Pro MVP를 만들려고 해.
기술 스택: faster-whisper(STT) + Ollama(LLM) + Kokoro(TTS) + Next.js(UI)
아직 코딩 하지 마. 먼저 docs/research.md 파일에
각 기술의 특징, 통합 방법, 주의사항을 조사해서 정리해줘."
```

### Step 2: Plan + 내 Annotation

```
# Claude Code 입력:
"research.md 읽고 MVP 구현 계획을 docs/plan.md에 작성해줘.
아직 코딩 하지 마.
파일 구조, 각 컴포넌트 역할, API 연결 방법, 예상 문제점 포함."
```

```
# 내가 plan.md 열어서 코멘트 추가:
# <!-- NANTA: 한국어 TTS는 Kokoro 대신 Google TTS 무료 티어 먼저 써 -->
# <!-- NANTA: LLM은 일단 Claude API로, 나중에 Ollama로 교체 -->

# Claude Code 입력:
"plan.md의 내 코멘트 반영해서 업데이트해줘. 아직 코딩 하지 마."
```

### Step 3: Todo List 생성

```
"plan.md 기반으로 docs/todo.md에 세부 작업 목록 만들어줘.
각 항목은 체크박스(- [ ])로."
```

### Step 4: 구현 시작

```
"이제 구현 시작해. todo.md 순서대로.
완료된 항목은 - [x]로 표시해가면서
모든 항목 완료할 때까지 멈추지 마."
```

---

## 🤖 멀티 에이전트 전략

### 구조

```
[NANTA — 기획·검토·승인]
         ↓
[Claude 오케스트레이터]
    ├── plan.md 관리
    ├── 작업 분배
    └── 통합 검수
         ↓
┌────────┬────────┬────────┐
[Agent1] [Agent2] [Agent3]
STT/TTS  LLM연결  UI/UX
```

### 병렬 실행 방법

```powershell
# 터미널 3개 동시 실행
# 터미널 1 (음성 처리)
cd C:\Users\tara0\readvoice-mvp
claude --dangerously-skip-permissions
# → "STT + TTS 파이프라인 구현해줘. plan.md의 음성 관련 섹션 참조."

# 터미널 2 (AI 연결)
cd C:\Users\tara0\readvoice-mvp
claude --dangerously-skip-permissions
# → "Ollama API 연결과 대화 관리 구현해줘. plan.md의 LLM 섹션 참조."

# 터미널 3 (UI)
cd C:\Users\tara0\readvoice-mvp
claude --dangerously-skip-permissions
# → "메인 UI 화면 만들어줘. plan.md의 UI 섹션 참조."
```

> ⚠️ `--dangerously-skip-permissions` = 허락 없이 파일 수정
> 신뢰하는 프로젝트 폴더에서만 사용

### Superpowers 스킬 활용 (이미 설치됨)

```
Claude Code에서:
/superpowers:brainstorm  ← 기능 기획할 때
/superpowers:write-plan  ← 복잡한 구현 계획 세울 때
/superpowers:execute-plan ← 계획대로 일괄 구현할 때
```

---

## 💡 토큰 절약 전략 (상세)

### CLAUDE.md 템플릿 (프로젝트 폴더에 저장)

```markdown
# READ VOICE Pro — Claude 작업 지침

## 핵심 규칙
1. 코딩 전 반드시 plan.md 확인
2. LLM은 Ollama 로컬 우선, 없으면 claude-haiku-4-5
3. 한국어 최우선
4. 접근성: 모든 UI에 aria-label 필수

## 기술 스택
- Frontend: Next.js 14 + TypeScript + Tailwind
- STT: faster-whisper (로컬) or Web Speech API
- LLM: Ollama (gemma3:8b) or Claude Haiku
- TTS: Kokoro ONNX or 브라우저 내장 TTS
- 폰트: Pretendard Variable

## 색상 (브랜드 통일)
--primary: #0284C7
--secondary: #0D9488
--bg: #EBF5FF
--text: #1E3A5F

## 절대 하지 말 것
- any 타입 사용 금지
- 불필요한 주석 금지
- plan.md 없이 큰 기능 구현 금지
```

### 단계별 토큰 비용 예측

```
MVP 개발 전체 = 약 $3~8 (Claude API 사용 시)

절약 방법:
1. Research/Plan 단계: claude-sonnet (정확도 중요)
2. Implementation 단계: claude-haiku (빠르고 저렴)
3. 반복 수정: /compact 명령으로 압축
4. 오류 수정: 에러 메시지만 전달 (전체 코드 X)
5. 로컬 Ollama: 개발·테스트 시 API 비용 $0
```

---

## 📅 수정된 개발 로드맵

```
Week 1-2: MVP (브라우저 웹앱)
  ├── 환경 설정 + Ollama 설치
  ├── research.md → plan.md → 구현
  ├── 음성 입력 (Web Speech API, 무료)
  ├── AI 응답 (Ollama 로컬 LLM, 무료)
  └── 음성 출력 (브라우저 TTS, 무료)
  → 운영비: $0

Week 3-4: MVP 고도화
  ├── OCR 문서 읽기 (Gemini Vision, 무료 티어)
  ├── 대화 기록 저장
  └── Vercel 배포 (무료)
  → 운영비: $0~5

Month 2: SaaS 서버 구축
  ├── 가비아 VPS 또는 AWS 임대
  ├── Docker로 Ollama + Whisper + Kokoro 배포
  ├── 사용자 인증 시스템
  └── 구독 결제 연동 (토스페이먼츠 or 아임포트)
  → 운영비: 월 5~30만원

Month 3+: 온디바이스 버전
  ├── Windows 앱 (Electron 래핑)
  ├── 미니PC 번들 패키지
  └── NeMo 기반 보안 버전
  → 추가 API 비용: $0
```

---

## 🔧 즉시 실행 가이드

### 오늘 할 일 (순서대로)

```
1. Ollama 설치
   → https://ollama.com/download
   → Windows 설치 파일 다운로드·실행

2. PowerShell에서:
   ollama pull gemma3:8b

3. 테스트:
   ollama run gemma3:8b
   → "안녕하세요, 테스트입니다" 입력 → 응답 확인

4. 프로젝트 생성:
   cd C:\Users\tara0
   npx create-next-app@latest readvoice-mvp --typescript --tailwind --app
   cd readvoice-mvp

5. Claude Code 시작:
   claude
   → "CLAUDE.md 만들고 research.md 작성 시작해줘.
      아직 코딩 하지 말고."
```

---

## ❓ 자주 막히는 상황 대처법

```
Ollama 응답이 느릴 때:
→ gemma3:8b 대신 llama3.2:3b 사용 (더 가벼움)
→ ollama pull llama3.2:3b

한국어 인식이 안 될 때 (STT):
→ Whisper 모델에 language='ko' 명시
→ from faster_whisper import WhisperModel
   model = WhisperModel("small", language="ko")

에러 발생 시 Claude Code 입력 방법:
→ "아래 에러 났어. 해결해줘:
   [에러 메시지만 복사]
   파일: [파일명]"
```

---

## 📊 개발 진행 체크리스트

### Phase 0 — 환경 설정
- [ ] Ollama 설치 및 모델 다운로드
- [ ] Python 패키지 설치 (faster-whisper, kokoro-onnx)
- [ ] Next.js 프로젝트 생성
- [ ] CLAUDE.md 작성
- [ ] Anthropic API 크레딧 충전 ($10)

### Phase 1 — MVP
- [ ] research.md 작성 (Claude 담당)
- [ ] plan.md 작성 (Claude 담당)
- [ ] plan.md 검토 및 주석 추가 (NANTA 담당)
- [ ] todo.md 생성
- [ ] 음성 입력 UI 구현
- [ ] Ollama LLM 연결
- [ ] 음성 출력 구현
- [ ] 로컬 테스트
- [ ] Vercel 배포

### Phase 2 — SaaS 서버
- [ ] 서버 선택 (가비아 or AWS)
- [ ] Docker 환경 구성
- [ ] Ollama 서버 배포
- [ ] 사용자 인증
- [ ] 결제 시스템

### Phase 3 — 온디바이스
- [ ] Electron 앱 패키징
- [ ] 미니PC 테스트
- [ ] NeMo 환경 검토

---

## 📝 변경 이력

| 날짜 | 변경 내용 | 변경자 |
|------|-----------|--------|
| 2026-04-15 | v1 최초 작성 | Claude |
| 2026-04-17 | v2 전면 개정 — 오픈소스 스택, 계획/실행 분리, 3트랙 전략 | Claude |

---

*파일 위치: C:\Users\tara0\readvoice-pro-agent\개발_마스터플랜_v2.md*
*다음 업데이트: Phase 0 완료 후*
