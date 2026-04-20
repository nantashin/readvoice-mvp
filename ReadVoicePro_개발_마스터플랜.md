# READ VOICE Pro — 서비스 개발 마스터 플랜
> 최초 작성: 2026-04-15 | 관리자: Claude (Orchestrator)
> 개발 주체: (주)한소울지식정보 | 기획자: NANTA
> 상태: 🔴 기획 완료 · 개발 미착수
> 이 파일은 개발 진행에 따라 지속 업데이트됩니다.

---

## 📌 현재 상태 (2026-04-15 기준)

| 항목 | 상태 | 비고 |
|------|------|------|
| 사업계획서 | ✅ 완료 | planning\02_사업계획서.md |
| IR 발표자료 | ✅ 완료 | output\20260413_ReadVoicePro_IR_v2.html |
| 발표스크립트 | ✅ 완료 | output\20260413_ReadVoicePro_발표스크립트_v5.txt |
| 브로셔 | 🟡 제작 중 | output\ReadVoicePro_브로셔.html |
| **실제 개발** | 🔴 미착수 | 지금부터 시작 |

---

## 🎯 최종 목표 vs MVP 목표

### 최종 서비스 (Full Product)
```
📱 모바일 앱     (iOS / Android)
🌐 웹 앱        (SaaS, 브라우저)
💻 데스크탑 앱   (Windows / macOS)
🖥️ 온프레미스    (미니PC, 노트북 탑재)
📺 키오스크      (공공기관 설치형)
```

### MVP 목표 (지금 당장 만들 것)
```
🌐 웹 앱 (브라우저 기반)
→ 가장 빠름 (설치 불필요)
→ 모든 디바이스에서 즉시 테스트
→ 이후 앱·데스크탑·온프레미스로 확장 가능
```

**MVP 핵심 기능 (3가지만):**
1. 🎙️ 음성으로 명령 입력 (STT)
2. 📄 문서/이미지 업로드 → AI가 내용 읽어줌 (OCR + TTS)
3. 🤖 간단한 AI 질의응답 (LLM 연동)

**MVP 목표 기간:** 2~4주

---

## 🗺️ 개발 로드맵 (4단계)

```
Phase 0 (1~2일)   환경 설정 · API 키 발급
Phase 1 (1~2주)   MVP 웹앱 — 핵심 3기능
Phase 2 (2~4주)   기능 확장 — 에이전트 추가
Phase 3 (1~2개월) 앱·데스크탑 버전
Phase 4 (3개월+)  온프레미스 (NeMo/OpenClaw 기반)
```

---

## 🚀 Phase 0: 환경 설정 (오늘 시작)

### 필요한 것 목록

#### A. API 키 발급 (무료/유료)

| 서비스 | 용도 | 비용 | 발급 URL |
|--------|------|------|----------|
| **Anthropic Claude API** | AI 두뇌 (LLM) | 종량제 | console.anthropic.com |
| **Google Cloud STT** | 음성→텍스트 | 월 60분 무료 | console.cloud.google.com |
| **Google Cloud TTS** | 텍스트→음성 | 월 100만자 무료 | console.cloud.google.com |
| **Vercel** | 웹앱 배포 | 무료 | vercel.com |
| Gemini API | 이미지 인식 (이미 보유) | 유료 구독 중 | 이미 있음 |

> 💡 **토큰 절약 팁**: Claude API는 `claude-haiku-4-5` 모델 사용
> claude-sonnet보다 20배 저렴, MVP에는 충분한 성능

#### B. 설치 필요 항목

```powershell
# 이미 설치됨 (확인)
node --version    # v24.13.0 ✅
python --version  # 3.13 ✅
git --version     # 2.53 ✅

# 추가 설치 필요
npm install -g vercel      # 배포 도구
npm install -g pnpm        # 패키지 관리자 (빠름)
```

#### C. 프로젝트 폴더 생성

```powershell
mkdir C:\Users\tara0\readvoice-mvp
cd C:\Users\tara0\readvoice-mvp
```

---

## 🏗️ Phase 1: MVP 웹앱

### 기술 스택 (비개발자 친화적 선택)

```
프론트엔드: Next.js (React 기반, 가장 쉬운 풀스택)
AI:        Claude API (Anthropic)
음성입력:   Web Speech API (브라우저 내장, 무료!)
음성출력:   Google TTS API 또는 브라우저 내장 TTS
OCR:       Gemini Vision API (이미지 읽기)
배포:      Vercel (클릭 한 번으로 배포)
```

> 💡 **Web Speech API** = 크롬 브라우저에 내장된 STT/TTS
> 별도 API 키 불필요, 한국어 지원, 무료!

### MVP 파일 구조

```
readvoice-mvp/
├── CLAUDE.md              ← Claude Code 지시서 (핵심!)
├── package.json
├── .env.local             ← API 키 (git에 올리지 않음!)
├── app/
│   ├── page.tsx           ← 메인 화면
│   ├── api/
│   │   ├── chat/route.ts  ← Claude API 연결
│   │   └── ocr/route.ts   ← 이미지 OCR
│   └── components/
│       ├── VoiceInput.tsx  ← 마이크 버튼
│       ├── TextReader.tsx  ← TTS 출력
│       └── FileUpload.tsx  ← 파일 업로드
└── lib/
    ├── claude.ts          ← AI 연결
    └── speech.ts          ← 음성 처리
```

### CLAUDE.md 내용 (Claude Code가 읽는 지시서)

```markdown
# READ VOICE Pro MVP — 개발 지침

## 프로젝트 목적
시각장애인·거동불편인을 위한 AI 음성 보조 웹앱.
점자 없이 음성만으로 모든 기능을 사용할 수 있어야 한다.

## 핵심 원칙
1. 접근성 최우선: 모든 UI에 aria-label, tab 순서 준수
2. 음성 우선: 모든 기능은 음성으로도 작동해야 함
3. 단순하게: MVP는 3가지 기능만 (STT, OCR+TTS, AI챗봇)

## 기술 스택
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Claude API (claude-haiku-4-5 — 토큰 절약)
- Web Speech API (브라우저 내장 STT/TTS)
- Gemini Vision API (OCR)

## API 키 위치
.env.local 파일 참조

## 색상 팔레트 (브랜드 통일)
--primary: #0284C7
--secondary: #0D9488
--bg: #EBF5FF
--text: #1E3A5F
```

---

## 🤖 Claude Code 멀티 에이전트 전략

### 개념: 오케스트레이터 + 서브에이전트

```
[나 (기획자)]
    ↓ 지시
[Claude — 오케스트레이터 (메인 세션)]
    ↓ 작업 분배
    ├── [서브에이전트 1] 프론트엔드 (UI 개발)
    ├── [서브에이전트 2] 백엔드 (API 연결)
    └── [서브에이전트 3] 테스트 (품질 검증)
```

### 실제 사용 방법

**방법 A: Claude Code 서브에이전트 (`/agent` 명령)**
```
# 메인 세션에서 서브에이전트 실행
/agent "VoiceInput 컴포넌트 개발해줘. 
마이크 버튼, Web Speech API 연결, 한국어 설정"
```

**방법 B: 병렬 터미널 세션**
```powershell
# 터미널 1 (프론트엔드)
cd C:\Users\tara0\readvoice-mvp
claude --session frontend

# 터미널 2 (백엔드)
cd C:\Users\tara0\readvoice-mvp
claude --session backend

# 터미널 3 (테스트)
cd C:\Users\tara0\readvoice-mvp
claude --session testing
```

**방법 C: Git 브랜치 병렬 개발 (Superpowers 스킬 활용)**
```
main
├── feature/voice-input     ← 서브에이전트 1
├── feature/ocr-reader      ← 서브에이전트 2
└── feature/ai-chat         ← 서브에이전트 3
```

### 오케스트레이터 지시 템플릿

```
# Claude Code 메인 세션에서 입력:

나는 비개발자 기획자야.
CLAUDE.md를 읽고 아래 작업을 서브에이전트에 분배해줘.

작업1 (지금 바로): VoiceInput.tsx 컴포넌트
  - 마이크 버튼 UI
  - Web Speech API 연결 (한국어)
  - 음성 텍스트 실시간 표시

작업2 (작업1 완료 후): Claude API 연결
  - app/api/chat/route.ts
  - claude-haiku-4-5 모델 사용
  - 스트리밍 응답

작업3 (작업2 완료 후): 통합 테스트
  - 음성 입력 → AI 응답 → TTS 출력 전체 흐름 테스트

각 작업 완료 시 보고해줘.
```

---

## 💰 토큰 절약 전략 (Pro 요금제)

### 핵심 원칙

| 상황 | 비싼 방법 ❌ | 저렴한 방법 ✅ |
|------|------------|--------------|
| 개발 작업 | claude-sonnet | claude-haiku |
| 긴 파일 전달 | 전체 파일 | 핵심 부분만 |
| 반복 질문 | 매번 컨텍스트 재설명 | CLAUDE.md 활용 |
| 디버깅 | 에러 전체 | 에러 메시지만 |

### 구체적 절약 방법

**1. CLAUDE.md 최대 활용**
```
# 나쁜 예 (매번 설명, 토큰 낭비)
"이 프로젝트는 시각장애인용 AI 앱이고, Next.js 쓰고, 
색상은 #0284C7이고, claude-haiku 써야 하고..."

# 좋은 예 (CLAUDE.md에 써두고 참조)
"CLAUDE.md 읽고 VoiceInput 컴포넌트 만들어줘"
```

**2. 작업 단위 쪼개기**
```
# 나쁜 예 (한 번에 너무 많이)
"전체 앱 다 만들어줘"

# 좋은 예 (작은 단위)
"VoiceInput 버튼 UI만 만들어줘 (기능 없이)"
→ 완료 확인
"이제 Web Speech API 연결해줘"
→ 완료 확인
"이제 한국어 설정 추가해줘"
```

**3. /compact 명령 활용**
```
# 대화가 길어지면
/compact   ← 컨텍스트 압축 (토큰 절약)
```

**4. Cowork 활용 (반복 작업)**
```
Cowork = 비개발자용 자동화 도구
활용 케이스:
- 파일 정리, 폴더 구조 생성
- 반복적인 파일 수정
- 빌드·배포 자동화
→ 이런 작업은 Cowork에 맡기고
  Claude Code는 핵심 개발에만 사용
```

**5. 환경변수로 모델 설정**
```powershell
# .env.local
CLAUDE_MODEL=claude-haiku-4-5   # MVP 개발 시
# claude-sonnet-4-6              # 복잡한 로직만
```

---

## 🔧 Phase 1 실행 순서 (Step-by-Step)

### Step 1: 프로젝트 초기화 (30분)

```powershell
# PowerShell에서 순서대로
cd C:\Users\tara0
npx create-next-app@latest readvoice-mvp --typescript --tailwind --app
cd readvoice-mvp
```

### Step 2: API 키 설정 (10분)

```
# .env.local 파일 생성 (메모장으로 열기)
notepad .env.local
```

```env
# 아래 내용 입력 후 저장
ANTHROPIC_API_KEY=sk-ant-여기에_Claude_API_키_입력
GOOGLE_API_KEY=여기에_Gemini_API_키_입력
NEXT_PUBLIC_APP_NAME=READ VOICE Pro
```

> Claude API 키 발급: https://console.anthropic.com/settings/keys

### Step 3: Claude Code 시작 + CLAUDE.md 생성

```powershell
cd C:\Users\tara0\readvoice-mvp
claude
```

Claude Code 안에서:
```
프로젝트 초기화해줘.
CLAUDE.md 파일을 만들고 아래 내용을 넣어줘:
[위의 CLAUDE.md 내용 붙여넣기]
```

### Step 4: MVP 핵심 3기능 개발

```
# Claude Code에 입력:
CLAUDE.md를 읽고 MVP 핵심 3기능을 순서대로 개발해줘.

1단계: 메인 페이지 UI
   - 음성 입력 버튼 (크고 명확하게)
   - 파일 업로드 영역
   - AI 응답 표시 영역
   - 색상: #0284C7, #EBF5FF, Pretendard 폰트

2단계: 음성 입력 (Web Speech API)
   - 마이크 버튼 클릭 → 음성 인식 시작
   - 한국어 설정 (lang: 'ko-KR')
   - 인식된 텍스트 실시간 표시

3단계: Claude API 연결
   - app/api/chat/route.ts 생성
   - claude-haiku-4-5 사용
   - 스트리밍 응답 (실시간 출력)
   - 시스템 프롬프트:
     "당신은 시각장애인을 위한 AI 도우미 READ VOICE Pro입니다.
      모든 답변은 음성으로 읽기 쉽게 간결하고 명확하게 작성하세요."

4단계: TTS 출력 (Web Speech API)
   - AI 응답 완료 시 자동으로 음성 읽기
   - 한국어 음성 (lang: 'ko-KR')
   - 읽기 속도 조절 버튼

한 단계씩 완료 후 확인하고 진행해줘.
```

### Step 5: 로컬 테스트

```powershell
npm run dev
# http://localhost:3000 에서 확인
```

### Step 6: Vercel 배포 (5분)

```powershell
vercel
# 질문에 모두 Enter (기본값 선택)
# 배포 URL 자동 생성 (예: readvoice-mvp.vercel.app)
```

---

## 📱 Phase 2: 기능 확장 (MVP 완료 후)

### 추가 기능 목록

| 기능 | 설명 | 난이도 |
|------|------|--------|
| OCR 문서 읽기 | 이미지·PDF 업로드 → AI가 내용 읽어줌 | ⭐⭐ |
| 대화 기록 저장 | 이전 대화 저장·불러오기 | ⭐⭐ |
| 목소리 선택 | 남성/여성/속도 조절 | ⭐ |
| 즐겨찾기 | 자주 쓰는 명령어 저장 | ⭐⭐ |
| 키보드 단축키 | 시각장애인 접근성 강화 | ⭐⭐ |
| 사용자 계정 | 로그인·설정 저장 | ⭐⭐⭐ |

---

## 🖥️ Phase 3: 앱·데스크탑 버전

### 웹앱 → 앱 변환 (PWA)

```
PWA(Progressive Web App) = 웹앱을 앱처럼 설치
→ 추가 개발 없이 웹앱에서 바로 변환 가능
→ iOS/Android 홈화면에 추가 가능
→ 오프라인에서도 일부 기능 작동
```

### 데스크탑 앱 (Electron)

```
웹앱 코드 → Electron 래핑 → Windows/macOS 설치 파일
→ 별도 개발 최소화
→ 나중에 진행 (Phase 3)
```

---

## 🔒 Phase 4: 온프레미스 (NeMo/OpenClaw)

> ⚠️ 이 단계는 MVP 완성 후 진행

### OpenClaw vs NeMo 선택

| 항목 | OpenClaw | NeMo Framework |
|------|----------|----------------|
| 보안 | 좋음 | 매우 좋음 (NVIDIA) |
| 설치 난이도 | 중간 | 어려움 |
| GPU 필요 | 선택적 | 필수 (권장) |
| 한국어 지원 | 보통 | 모델 의존 |
| 적합한 환경 | 미니PC·노트북 | 서버·고성능PC |

### 미니PC 권장 사양 (온프레미스용)

```
CPU:  Intel Core i7 또는 AMD Ryzen 7
RAM:  32GB 이상
SSD:  512GB 이상
GPU:  NVIDIA RTX 3060+ (NeMo 사용 시 필수)
OS:   Windows 11 Pro 또는 Ubuntu 22.04
```

---

## 🛠️ Cowork 활용 계획

### Cowork이 적합한 작업

```
✅ 파일·폴더 정리 및 구조 생성
✅ 반복적인 텍스트 치환
✅ 빌드·배포 자동화 스크립트
✅ 이미지·파일 일괄 처리
✅ 개발 환경 설정 자동화
```

### Claude Code가 해야 하는 작업

```
✅ 코드 작성·수정·디버깅
✅ 아키텍처 설계
✅ API 연결
✅ 복잡한 로직 구현
✅ 테스트 코드 작성
```

---

## 📊 개발 진행 상황 추적

### 체크리스트

#### Phase 0 — 환경 설정
- [ ] Anthropic Claude API 키 발급
- [ ] Google Cloud (STT/TTS) 프로젝트 생성
- [ ] Vercel 계정 생성
- [ ] readvoice-mvp 폴더 생성
- [ ] Next.js 프로젝트 초기화
- [ ] .env.local API 키 입력
- [ ] CLAUDE.md 생성

#### Phase 1 — MVP 웹앱
- [ ] 메인 페이지 UI 완성
- [ ] 음성 입력 (STT) 작동
- [ ] Claude API 연결 (AI 응답)
- [ ] TTS 출력 (AI 응답 읽기)
- [ ] 로컬 테스트 완료
- [ ] Vercel 배포 완료
- [ ] 실제 시각장애인 테스트

#### Phase 2 — 기능 확장
- [ ] OCR 문서 읽기
- [ ] 대화 기록 저장
- [ ] 목소리 선택
- [ ] 즐겨찾기
- [ ] PWA 변환 (앱처럼 설치)

#### Phase 3 — 앱·데스크탑
- [ ] iOS PWA 테스트
- [ ] Android PWA 테스트
- [ ] Windows 데스크탑 앱 (Electron)

#### Phase 4 — 온프레미스
- [ ] OpenClaw 미니PC 설치
- [ ] NeMo 환경 구성
- [ ] 로컬 LLM 연동

---

## 🆘 막혔을 때 대처법

### 에러 발생 시

```
Claude Code에 입력:
"아래 에러가 났어. 해결해줘.
[에러 메시지만 복사해서 붙여넣기]
파일: [파일명]
```

### 모르는 개념 나올 때

```
"[개념]이 뭐야? 비개발자인 나도 이해할 수 있게 설명해줘."
```

### 진행이 막힐 때

```
"지금까지 진행 상황을 요약해줘.
다음 단계가 뭔지 알려줘."
```

---

## 📝 변경 이력

| 날짜 | 변경 내용 | 변경자 |
|------|-----------|--------|
| 2026-04-15 | 최초 작성 | Claude |
| | | |

---

## ⏭️ 지금 당장 할 일 (다음 세션 시작 시)

```
1. PowerShell 열기
2. Claude API 키 발급 (5분)
   → https://console.anthropic.com/settings/keys
3. 아래 명령 실행:
   cd C:\Users\tara0
   npx create-next-app@latest readvoice-mvp --typescript --tailwind --app
4. cd readvoice-mvp
5. claude
6. "CLAUDE.md 만들고 MVP 개발 시작해줘" 입력
```

---

*파일 위치: C:\Users\tara0\readvoice-pro-agent\개발_마스터플랜.md*
*다음 업데이트: Phase 0 완료 후*
