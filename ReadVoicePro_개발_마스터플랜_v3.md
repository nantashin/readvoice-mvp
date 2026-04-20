# READ VOICE Pro — 개발 마스터플랜 v3
> 최초: 2026-04-15 | 전면 개정: 2026-04-17
> 관리자: Claude (Orchestrator) | 기획자: NANTA
> 참조: Gemini 논의 문서 + hada.io 워크플로우 + 모델 벤치마크
> 핵심: **계획/실행 분리** + **LangChain 추상화** + **최소 비용 운영**

---

## 📌 v2 → v3 변경 핵심

| 항목 | v2 | v3 |
|------|----|----|
| 기본 LLM | Gemma3:8b | **Bllossom 8B** (국내 MVP) |
| 모델 전략 | 단일 | **이원화** (국내/글로벌) |
| 코드 구조 | 직접 Ollama 연결 | **LangChain 추상화** |
| 성능 최적화 | 미계획 | **NeMo + TensorRT-LLM 준비** |
| 보안 전략 | 미반영 | **공공기관 가이드라인 반영** |

---

## 🏆 모델 비교 및 최종 선택

### 3개 모델 비교표

| 항목 | Gemma3:8b | Bllossom 8B | EXAONE 3.5 (7.8B) |
|------|-----------|-------------|---------------------|
| **한국어 성능** | ⭐⭐⭐ (2025.3 개선) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Ollama 지원** | ✅ 공식 지원 | ⚠️ GGUF 수동 설치 | ✅ 공식 등록 |
| **공공기관 납품** | ❌ 구글 (외산) | ⚠️ 학술팀 개발 | ✅ LG (국산, 유리) |
| **라이선스** | 상업 가능 | 상업 가능 | 상업 가능 |
| **VRAM (8GB)** | ✅ 가능 | ✅ Q4 양자화 가능 | ✅ 가능 |
| **코딩 능력** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ (HumanEval 0.848) |
| **NeMo 최적화** | ✅ (NVIDIA 제휴) | ⚠️ 별도 작업 필요 | ✅ TensorRT-LLM 지원 |
| **글로벌 확장** | ✅ 140개 언어 | ❌ 한국어 전용 | ⚠️ 한국어 특화 |

### ✅ 최종 모델 전략 (이원화)

```
┌─────────────────────────────────────────────────────────┐
│  국내 MVP (Phase 1)                                      │
│  1차: Bllossom 8B  → 어색하면 → EXAONE 3.5로 교체      │
│  B2G 납품 최종: EXAONE 3.5 (국산, 공공기관 유리)        │
├─────────────────────────────────────────────────────────┤
│  글로벌 / B2C SaaS (Phase 2+)                           │
│  Gemma3:8b (멀티모달, 140개 언어)                       │
│  또는 Llama3.1:8b (Meta, 글로벌 표준)                   │
└─────────────────────────────────────────────────────────┘
```

> 💡 **Gemma3:8b는 왜 기본에서 제외?**
> 한국어 특화가 아님. 일반 대화는 무난하지만
> 행정 용어·복지 서비스·보조기기 관련 한국어 문맥은
> Bllossom/EXAONE이 훨씬 자연스러움.

---

## 🔧 Bllossom 8B Ollama 설치 방법

Bllossom은 Ollama 공식 라이브러리에 없어서 수동 설치 필요.

### 방법 A: Modelfile로 직접 등록 (권장)

```powershell
# 1. GGUF 파일 다운로드 (HuggingFace)
# https://huggingface.co/MLP-KTLim/llama-3-Korean-Bllossom-8B-gguf-Q4_K_M

# 2. Modelfile 생성
notepad C:\Users\tara0\Modelfile
```

```
# Modelfile 내용:
FROM C:\Users\tara0\llama-3-Korean-Bllossom-8B-Q4_K_M.gguf

SYSTEM """당신은 시각장애인과 거동불편인을 위한 AI 도우미 READ VOICE Pro입니다.
모든 답변은 음성으로 읽기 쉽게 간결하고 명확하게 작성하세요.
한국어로만 대답하고, 불필요한 기호나 특수문자는 사용하지 마세요."""

PARAMETER temperature 0.7
PARAMETER num_ctx 4096
```

```powershell
# 3. Ollama에 모델 등록
ollama create bllossom:8b -f C:\Users\tara0\Modelfile

# 4. 테스트
ollama run bllossom:8b
>>> 주민등록등본 발급 절차를 간단히 알려줘
```

### 방법 B: EXAONE 3.5 (간단, 공식 지원)

```powershell
# 바로 설치 가능
ollama pull exaone3.5:7.8b
ollama run exaone3.5:7.8b
```

---

## 🏗️ LangChain 추상화 아키텍처

### 핵심 개념

```
LangChain = 모델 교체 가능한 '어댑터' 레이어

[앱 코드] → [LangChain] → Ollama (로컬)
                        → Claude API
                        → OpenAI API
                        → EXAONE API
                        
모델을 바꿔도 앱 코드는 변경 없음!
```

### 프로젝트 구조

```
readvoice-mvp/
├── CLAUDE.md
├── .env.local
├── app/
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts       ← LangChain 통해 LLM 호출
│       └── ocr/route.ts
├── lib/
│   ├── llm/
│   │   ├── index.ts            ← LLM 팩토리 (핵심!)
│   │   ├── ollama.ts           ← Ollama 연결
│   │   ├── claude.ts           ← Claude API 연결
│   │   └── openai.ts           ← OpenAI 연결
│   └── speech/
│       ├── stt.ts              ← 음성 입력
│       └── tts.ts              ← 음성 출력
└── docs/
    ├── research.md             ← Claude 조사 결과
    ├── plan.md                 ← 구현 계획 (NANTA 검토)
    └── todo.md                 ← 작업 목록
```

### LLM 팩토리 코드 구조 (Claude Code가 만들 것)

```typescript
// lib/llm/index.ts — 모델 스위칭 핵심
// LLM_PROVIDER 환경변수만 바꾸면 모델 교체

const provider = process.env.LLM_PROVIDER || 'ollama'

// ollama    → 로컬 Bllossom/EXAONE
// claude    → Anthropic Claude Haiku
// openai    → OpenAI GPT
// exaone    → LG EXAONE API (향후)
```

### .env.local 설정

```env
# 모델 전략 설정
LLM_PROVIDER=ollama              # ollama | claude | openai
OLLAMA_MODEL=bllossom:8b         # 또는 exaone3.5:7.8b
OLLAMA_BASE_URL=http://localhost:11434

# API 키 (필요 시)
ANTHROPIC_API_KEY=sk-ant-...     # Claude API (fallback)
OPENAI_API_KEY=sk-...            # OpenAI (글로벌용)

# 음성
STT_ENGINE=webspeech             # webspeech | whisper
TTS_ENGINE=webspeech             # webspeech | kokoro | google

# 앱 설정
NEXT_PUBLIC_APP_NAME=READ VOICE Pro
NEXT_PUBLIC_TARGET=ko            # ko (국내) | global
```

---

## ⚡ NeMo + TensorRT-LLM 준비 계획

### 개념 설명 (비개발자용)

```
일반 Ollama 실행:
음성 입력 → [Ollama] → 응답 (3~5초)

NeMo + TensorRT-LLM 최적화:
음성 입력 → [TensorRT-LLM 가속] → 응답 (0.5~1초)

속도 차이: 3~10배 빠름
필요 이유: 키오스크·미니PC에서 즉각 응답 필수
```

### 준비 단계 (지금 하지 않아도 됨, 코드만 준비)

```
Phase 1 (MVP): Ollama만 사용 (NeMo 없음)
Phase 2 (미니PC 상품화): NeMo + TensorRT-LLM 적용
Phase 3 (키오스크): 최적화 완성
```

### Phase 2에서 할 것 (준비 코드)

```python
# nemo_config.py — Phase 2에서 활성화
# 지금은 주석 처리, 코드 구조만 준비

# NVIDIA NeMo TensorRT-LLM 설정
# 필요 환경: CUDA 12.x, TensorRT-LLM 0.8+
# GPU: RTX 3070 Ti (현재 개발 노트북) 또는 미니PC GPU

NEMO_CONFIG = {
    "model": "exaone3.5_7b",        # EXAONE TensorRT 변환
    "max_batch_size": 4,
    "max_input_len": 2048,
    "max_output_len": 512,
    "dtype": "float16",              # GPU 최적화
    "quantization": "int4_awq",      # 4bit 양자화로 속도 극대화
}

# 예상 성능 (RTX 3070 Ti 기준):
# Ollama 기본: ~15 tokens/sec
# TensorRT-LLM: ~80-120 tokens/sec (5~8배 향상)
```

---

## 📋 개발 워크플로우 (계획/실행 분리)

### 핵심 규칙

```
"CLAUDE.md 없으면 코딩 시작 불가"
"plan.md 내 검토 전 구현 불가"
"아직 코딩 하지 마" = 가장 중요한 명령
```

### Claude Code 명령 패턴

```
# Step 1: Research
"READ VOICE Pro MVP 기술 조사해줘.
LangChain + Ollama + Web Speech API 통합 방법.
docs/research.md에 저장. 아직 코딩 하지 마."

# Step 2: Plan
"research.md 읽고 구현 계획 작성해줘.
LangChain 추상화 포함.
docs/plan.md에 저장. 아직 코딩 하지 마."

# Step 3: NANTA 검토 (plan.md에 코멘트 추가)
# <!-- NANTA: LLM은 Bllossom 8B 먼저, EXAONE은 fallback -->
# <!-- NANTA: TTS는 브라우저 내장으로 시작 -->

# Step 4: 계획 업데이트
"plan.md 내 코멘트 반영해서 업데이트. 아직 코딩 말고."

# Step 5: Todo 생성
"plan.md 기반 todo.md 작성해줘."

# Step 6: 구현
"이제 구현해. todo.md 순서대로. 완료까지 멈추지 마."
```

---

## 🚀 Phase 1 실행 순서 (수정된 버전)

### Step 0: 환경 설정 확인 (10분)

```powershell
# Ollama 설치 확인
ollama --version

# EXAONE 먼저 테스트 (Bllossom보다 설치 쉬움)
ollama pull exaone3.5:2.4b     # 가벼운 버전 먼저
ollama run exaone3.5:2.4b
>>> 시각장애인이 복지카드를 발급받으려면 어떻게 해야 해?
# 응답 품질 확인

# 만족스러우면 7.8b로 교체
ollama pull exaone3.5:7.8b
```

### Step 1: 프로젝트 생성

```powershell
cd C:\Users\tara0
npx create-next-app@latest readvoice-mvp --typescript --tailwind --app
cd readvoice-mvp

# LangChain 설치
npm install langchain @langchain/community @langchain/core
npm install @langchain/ollama

# Anthropic (fallback용)
npm install @anthropic-ai/sdk
```

### Step 2: Claude Code 시작

```powershell
claude
```

### Step 3: CLAUDE.md 생성 (Claude Code에 입력)

```
아래 내용으로 CLAUDE.md를 만들어줘:

---
# READ VOICE Pro MVP — 개발 지침

## 프로젝트 목적
시각장애인·거동불편인을 위한 AI 음성 보조 웹앱.
음성만으로 모든 기능 사용 가능.

## 핵심 아키텍처
LangChain을 통한 LLM 추상화 (모델 스위칭 가능)

## 기술 스택
- Frontend: Next.js 14 + TypeScript + Tailwind CSS
- LLM: LangChain → Ollama (기본) / Claude Haiku (fallback)
- 기본 모델: exaone3.5:2.4b (테스트) → 7.8b (품질) → bllossom:8b (비교)
- STT: Web Speech API (브라우저 내장, 무료, 한국어)
- TTS: Web Speech API (브라우저 내장, 무료)
- OCR: Gemini Vision API (이미지 읽기)
- 폰트: Pretendard Variable

## 환경변수 (.env.local)
LLM_PROVIDER, OLLAMA_MODEL, ANTHROPIC_API_KEY 참조

## 색상
--primary: #0284C7 / --secondary: #0D9488 / --bg: #EBF5FF

## 코딩 규칙
- any 타입 금지
- 모든 LLM 호출은 lib/llm/index.ts 통해서만
- 접근성: aria-label 필수
- LangChain OllamaEmbeddings, ChatOllama 사용

## NeMo 준비
- nemo_config.py는 주석 처리된 채로 준비
- Phase 2에서 활성화 예정
---
```

### Step 4: Research → Plan → 구현

```
# Research
"docs/research.md 작성해줘.
LangChain + Ollama + Web Speech API 통합.
시각장애인 접근성 best practice.
아직 코딩 하지 마."

# Plan
"research.md 읽고 docs/plan.md 작성해줘.
lib/llm/index.ts 구조 포함.
아직 코딩 하지 마."

# 구현
"plan.md와 todo.md 기반으로 구현해줘.
완료까지 멈추지 마."
```

---

## 🔒 공공기관 보안 전략

### 보안 등급별 모델 배치

```
B2G (공공기관):
→ EXAONE 3.5 로컬 (국산, 폐쇄망, LG 보안 검증)
→ 인터넷 차단 온프레미스
→ 국정원 보안 가이드라인 준수

B2B (기업 키오스크):
→ Bllossom 8B 또는 EXAONE 3.5 로컬
→ NeMo + TensorRT-LLM 가속

B2C SaaS (개인):
→ EXAONE API 또는 HyperCLOVA X API
→ CSAP 인증 서버 (향후)

글로벌 B2C:
→ Gemma3:8b 또는 Llama3.1:8b
→ AWS/Azure 서버
```

### 중국 모델 정책

```
Qwen, DeepSeek → MVP 개발용만 (개인 테스트)
공공기관 납품 절대 불가
나라장터 등록 시 국산 모델 명시 필수
```

---

## 🤖 멀티 에이전트 전략

### 병렬 개발 구조

```
터미널 1: 메인 (기획·검토)
claude
→ Research / Plan 검토 / 통합

터미널 2: LLM 연결 (lib/llm/)
claude --dangerously-skip-permissions
→ "LangChain LLM 팩토리 구현해줘"

터미널 3: UI (app/)
claude --dangerously-skip-permissions  
→ "메인 음성 인터페이스 UI 만들어줘"

터미널 4: 음성 처리 (lib/speech/)
claude --dangerously-skip-permissions
→ "STT/TTS 파이프라인 구현해줘"
```

---

## 💰 비용 최적화

### 월 운영비 시나리오

| 단계 | LLM | STT | TTS | 월 비용 |
|------|-----|-----|-----|---------|
| MVP 개발 | Ollama 로컬 | 브라우저 내장 | 브라우저 내장 | **$0** |
| SaaS 오픈 | EXAONE API | Google STT | Google TTS | **$20~50** |
| 서버 자체 | 자체 서버 Ollama | Faster-Whisper | Kokoro TTS | **서버비만** |

### 개발 중 Claude API 토큰 절약

```
개발 단계별 모델 선택:
- Research/Plan: claude-sonnet-4-6 (정확도 중요)
- 코드 구현: claude-haiku-4-5 (빠르고 저렴, 20배 차이)
- 단순 수정: claude-haiku-4-5

/compact 명령: 대화가 길어지면 컨텍스트 압축
에러 디버깅: 에러 메시지만 전달 (전체 코드 X)
```

---

## 📅 전체 로드맵

```
Week 1: 환경 설정 + EXAONE 테스트 + Research/Plan
Week 2: LangChain 추상화 + 음성 파이프라인 MVP
Week 3: UI 완성 + 통합 테스트 + Vercel 배포
Week 4: Bllossom 비교 테스트 + 품질 개선

Month 2: SaaS 서버 구축 (가비아 or AWS)
Month 3: 미니PC 온디바이스 버전 + NeMo 최적화 시작
Month 4+: 키오스크 + 공공기관 납품 준비
```

---

## 📊 개발 진행 체크리스트

### Phase 0 — 환경 (오늘)
- [x] Ollama 설치
- [ ] EXAONE 3.5 2.4b 테스트
- [ ] EXAONE 3.5 7.8b 설치
- [ ] Bllossom 8B GGUF 다운로드 + Modelfile 등록
- [ ] Node.js 프로젝트 생성
- [ ] LangChain 설치
- [ ] CLAUDE.md 작성

### Phase 1 — MVP
- [ ] docs/research.md
- [ ] docs/plan.md (NANTA 검토 완료)
- [ ] docs/todo.md
- [ ] lib/llm/index.ts (LangChain 팩토리)
- [ ] 음성 입력 UI
- [ ] Ollama LLM 연결
- [ ] 음성 출력
- [ ] 로컬 테스트
- [ ] Vercel 배포
- [ ] Bllossom vs EXAONE 비교 테스트

### Phase 2 — SaaS 서버
- [ ] 서버 선택 결정
- [ ] Docker 환경 구성
- [ ] nemo_config.py 활성화
- [ ] TensorRT-LLM 변환 테스트

---

## 📝 변경 이력

| 날짜 | 내용 | 변경자 |
|------|------|--------|
| 2026-04-15 | v1 최초 작성 | Claude |
| 2026-04-17 | v2 오픈소스 스택 + 3트랙 | Claude |
| 2026-04-17 | v3 Bllossom/EXAONE 전략 + LangChain + NeMo 준비 | Claude |

---

*파일 위치: C:\Users\tara0\readvoice-pro-agent\개발_마스터플랜_v3.md*
