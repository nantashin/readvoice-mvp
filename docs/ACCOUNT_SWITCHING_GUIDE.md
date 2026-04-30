# Claude Code 계정 전환 가이드

## 📋 문제 상황

- **제1계정:** shinnanta88@gmail.com
- **제2계정:** arsenwatson@gmail.com
- **문제:** 계정 전환 시 대화 컨텍스트가 끊기고, 작업 연속성이 유지되지 않음

---

## ✅ 해결 방법: 3단계 전환 프로토콜

### 🔄 STEP 1: 계정 전환 전 (현재 계정에서)

#### 1-1. Git 상태 저장 (필수)
```bash
cd C:\Users\tara0\readvoice-mvp
git add .
git commit -m "계정 전환 전 저장 - [현재 작업 내용]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin master
```

#### 1-2. Handoff 문서 작성 (필수)
```bash
# 현재 상태를 상세히 기록
# 파일: docs/handoff/save-state.md
```

**save-state.md 템플릿:**
```markdown
# 작업 인계 (Account Handoff)

## 현재 시각
2026-XX-XX XX:XX

## 계정 전환
제1계정 → 제2계정 전환 예정

## 현재 작업 중인 내용
[구체적으로 작성]

## 다음 할 일
1. [작업 1]
2. [작업 2]
3. [작업 3]

## 주의사항
- [중요한 사항]

## 참고 파일
- [관련 파일 경로]
```

#### 1-3. 대화 요약 생성 (권장)
Claude에게 요청:
```
"지금까지의 대화를 요약해서 docs/handoff/conversation-summary.md로 저장해줘"
```

---

### 🔄 STEP 2: 계정 전환 (CLI 명령)

#### 2-1. Claude Code 로그아웃
```bash
claude logout
```

#### 2-2. 새 계정으로 로그인
```bash
claude login
# 브라우저에서 arsenwatson@gmail.com으로 로그인
```

#### 2-3. 프로젝트 디렉토리 확인
```bash
cd C:\Users\tara0\readvoice-mvp
claude chat
```

---

### 🔄 STEP 3: 계정 전환 후 (새 계정에서)

#### 3-1. Git 최신 상태 동기화
```bash
git pull origin master
```

#### 3-2. 첫 메시지 전송 (컨텍스트 로드)
```
"docs/handoff/save-state.md 파일을 읽고, 이전 작업을 이어서 진행해줘."
```

또는 더 구체적으로:
```
"제1계정에서 작업하던 내용을 이어받았어. 다음 파일들을 확인해줘:
1. docs/handoff/save-state.md
2. docs/handoff/conversation-summary.md
3. docs/TODO_2026-XX-XX.md

이어서 [다음 작업] 진행해줘."
```

---

## 🎯 핵심 원칙

### ✅ 항상 해야 할 것
1. **Git 커밋 & Push** - 계정 전환 전 필수
2. **Handoff 문서 작성** - save-state.md 업데이트
3. **명시적 컨텍스트 전달** - 새 계정에서 첫 메시지에 상황 설명

### ❌ 하지 말아야 할 것
1. Git 커밋 없이 계정 전환
2. "이어서 해줘"만 말하고 상황 설명 없음
3. 작업 파일 경로 언급 없이 진행

---

## 🔧 계정별 설정 동기화

### 공통 설정 파일 (Git으로 동기화)
```
.claude/
├── settings.json          ← Git 저장소에 포함 (모델 설정)
└── projects/              ← 프로젝트별 memory
```

### 계정별 분리 파일 (Git 제외)
```
.claude/
├── .credentials.json      ← .gitignore에 포함
├── history.jsonl          ← 대화 히스토리 (계정별 분리)
└── sessions/              ← 세션 정보 (계정별 분리)
```

---

## 💡 고급 팁

### 1. 프로젝트별 Memory 활용
Claude Code는 프로젝트별로 memory를 저장합니다.
```
C:\Users\tara0\.claude\projects\C--Users-tara0-readvoice-mvp\memory\
```

이 폴더는 **계정과 무관하게 유지**되므로, 계정 전환 후에도 자동으로 로드됩니다.

### 2. CLAUDE.md 활용
프로젝트 루트의 `CLAUDE.md`는 항상 자동으로 로드됩니다.
중요한 규칙과 컨텍스트는 여기에 기록하세요.

### 3. 대화 히스토리 백업 (선택)
```bash
# 계정 전환 전
cp ~/.claude/history.jsonl ~/backups/history-account1-2026-04-30.jsonl
```

---

## 📅 실전 예시

### 제1계정 → 제2계정 전환 시나리오

**제1계정 마지막 명령:**
```bash
# 1. Git 저장
git add .
git commit -m "계정 전환 전 저장: 라마비전 프롬프트 개선 완료"
git push origin master

# 2. Claude에게 요청
"지금까지 작업한 내용을 docs/handoff/save-state.md에 저장해줘. 
다음 계정에서 이어서 v2.7.0~2 버전 비교 테스트를 진행할 예정이야."

# 3. 로그아웃
claude logout
```

**제2계정 첫 명령:**
```bash
# 1. 로그인
claude login  # arsenwatson@gmail.com

# 2. 프로젝트 이동
cd C:\Users\tara0\readvoice-mvp
git pull origin master

# 3. Claude 시작
claude chat

# 4. 첫 메시지
"제1계정(shinnanta88@gmail.com)에서 작업하던 READ VOICE Pro MVP 프로젝트를 
이어받았어. docs/handoff/save-state.md를 읽고, 
v2.7.0, v2.7.1, v2.7.2, latest 버전 비교 테스트를 진행해줘."
```

---

## 🤖 ChatGPT 유료계정 활용 방법

### Option 1: 보조 도구로 활용 (권장)
Claude Code에서 막히거나 추가 의견이 필요할 때:
1. ChatGPT Plus/Pro에서 코드 리뷰
2. 대안 접근법 탐색
3. 문서 작성 보조

### Option 2: MCP 서버로 ChatGPT API 통합 (고급)
```json
// .claude/settings.json에 추가 (미래 기능)
{
  "mcpServers": {
    "chatgpt": {
      "command": "npx",
      "args": ["-y", "@openai/mcp-server"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

**참고:** ChatGPT Plus/Pro는 웹 UI 전용이므로, API 키가 별도 필요합니다.
(Plus/Pro ≠ API 크레딧)

### Option 3: Codex 연계 (GitHub Copilot)
GitHub Copilot과 Claude Code를 함께 사용:
- **Copilot:** 코드 자동완성, 함수 생성
- **Claude Code:** 아키텍처 설계, 복잡한 리팩토링, 전체 파일 수정

---

## 🚨 주의사항

### 1. 대화 히스토리는 공유되지 않음
- 각 계정은 독립적인 대화 히스토리를 가짐
- **해결책:** Git + Handoff 문서로 상태 동기화

### 2. MCP 서버 인증은 계정별
- MCP 서버 인증은 계정별로 관리됨
- Figma, Gmail 등 연결된 서비스는 각 계정에서 재인증 필요

### 3. 모델 설정은 공유 가능
- `settings.json`을 Git에 포함하면 모델 설정 동기화 가능

---

## 📊 작업 흐름도

```
[제1계정 작업]
    ↓
[Git Commit & Push]
    ↓
[Handoff 문서 작성]
    ↓
[claude logout]
    ↓
[claude login (제2계정)]
    ↓
[git pull]
    ↓
[Handoff 문서 읽고 이어서 진행]
    ↓
[제2계정 작업]
```

---

## 🎯 빠른 참조 (Quick Reference)

### 전환 전
```bash
git add . && git commit -m "계정 전환 전" && git push
# Claude에게: "handoff 문서 작성해줘"
claude logout
```

### 전환 후
```bash
claude login
cd C:\Users\tara0\readvoice-mvp
git pull
claude chat
# 첫 메시지: "docs/handoff/save-state.md 읽고 이어서 진행해줘"
```

---

**마지막 업데이트:** 2026-04-30
**작성자:** Claude Sonnet 4.5
