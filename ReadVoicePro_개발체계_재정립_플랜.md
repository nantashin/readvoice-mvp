# READ VOICE Pro — 개발 체계 재정립 마스터 플랜
> 작성: 2026-04-23
> 기반: GeekNews 3개 글 분석 + 현재 개발 현황

---

## 1. 핵심 인사이트 요약

### Claude Code vs Codex 실전 비교 (14년 경력 시니어 엔지니어)

| 항목 | Claude Code | Codex |
|------|------------|-------|
| 속도 | ⚡ 빠름 | 🐢 3~4배 느림 |
| 품질 | 핵/패치 남발 | 체계적 리팩토링 |
| 지시 준수 | 종종 무시 | 철저히 준수 |
| 관리 필요도 | 높음 (babysitting) | 낮음 (fire-and-forget) |
| 적합 용도 | 빠른 프로토타이핑 | 엔터프라이즈급 |

### 최적 워크플로우 (업계 검증됨)
```
Claude Opus → 계획/설계
Claude Sonnet → 빠른 구현
Codex → 코드 리뷰 + 리팩토링
Claude Opus → 리뷰 검증
→ 반복
```

---

## 2. 현재 문제점 진단

### READ VOICE Pro 현재 상태
```
❌ 바이브 코딩으로 진행 → 일관성 없는 코드
❌ 코드 리뷰 없음 → 누적된 기술 부채
❌ 테스트 없음 → 수동 테스트만
❌ CLAUDE.md 미흡 → 100줄 기준 미달
❌ 단계별 커밋 없음 → 롤백 어려움
❌ 자동화 미완성 → 수동 작업 많음
```

---

## 3. 새 개발 체계

### 3-1. 도구별 역할 분담

```
Claude (채팅창, 현재 Sonnet 4.6):
→ 아키텍처 설계, 기술 결정, 문서 작성

Claude Code:
→ 계획 모드(Opus): 범위 정의, 서브에이전트 실행
→ 구현 모드(Sonnet): 실제 코드 작성
→ 현재: Haiku 4.5 → Sonnet으로 업그레이드 권장

Codex (GPT-5.4, $200 플랜 시):
→ 코드 리뷰, 리팩토링 검증
→ Claude 토큰 소진 시 배턴패스

Gemini Pro:
→ 아키텍처 크로스 체크
→ 보안 검토
```

### 3-2. 토큰 절약 설정 (Claude Code)

```bash
# .claude/settings.json에 추가
{
  "includeGitInstructions": false,
  "autoConnectIde": false
}

# 환경변수
CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
BASH_MAX_OUTPUT_LENGTH=10000
CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS=4000
```

### 3-3. 컨텍스트 관리
```
⚠️ 1M 컨텍스트는 초보자 함정
→ 1/4 이하(약 250K)로 유지
→ /compact 적극 활용
→ 세션당 하나의 기능만 집중
```

---

## 4. CLAUDE.md 재작성 (100줄 기준)

```markdown
# READ VOICE Pro — CLAUDE.md
> 버전: v3 | 2026-04-23

## 프로젝트
- 시각장애인/거동불편인을 위한 AI 음성 도우미
- 스택: Next.js 16, TypeScript, Tailwind, LangChain, Ollama

## 핵심 원칙 (절대 위반 금지)
1. API 의존 최소화 — 오픈소스 우선
2. 모델 교체 가능 구조 — Ollama 인터페이스
3. 보안 — 중국계 모델 공공기관 납품 불가
4. 음성 우선 — 100% 음성으로만 조작 가능
5. 접근성 — 모든 UI aria-label 필수

## 코딩 표준
- 파일당 최대 400줄
- 새 기능은 반드시 새 파일
- any 타입 금지
- 모든 LLM 호출은 lib/llm/index.ts 통해서만
- 함수 단일 책임 원칙 (SRP)

## Git 워크플로우
- 기능별 개별 커밋
- 커밋 형식: feat/fix/refactor/docs/test/chore
- Phase 완료 시 태그: v1.0-phase1 등
- 변경 전 반드시 git stash 또는 branch

## TDD
- 새 기능 → 테스트 먼저 작성
- 테스트 깨지면 임의 수정 금지 → 반드시 확인 요청
- 테스트 파일: __tests__/ 폴더

## 모델 전략
- 텍스트 LLM: exaone3.5:2.4b (로컬)
- Vision: moondream→gemma3→qwen2.5vl→llama3.2-vision
- PDF: qwen2.5vl:7b, llama3.2-vision (전용)

## 서비스 메뉴 (음성)
일번. 웹 검색
이번. 사진이나 문서 읽어들이기
삼번. 메뉴 선택하기
사번. 근처 복지관 및 지원 기관 안내
오번. 처음으로 돌아가기

## 금지 사항
- LM Studio (기업 유료)
- 시각장애인 언급 (서비스 내)
- API 키 코드에 하드코딩
- 마크다운/특수기호 TTS 전달
```

---

## 5. 참조 문서 생성 계획 (서브에이전트용)

```
docs/architecture/
├── software_architecture.md   ← SOLID/DRY/KISS/YAGNI
├── voice_pipeline.md          ← STT→LLM→TTS 설계
├── vision_pipeline.md         ← OCR/Vision 설계
├── security_guide.md          ← 보안 체크리스트
└── accessibility_guide.md     ← WCAG 2.1 접근성

docs/research/
├── ollama_performance.md      ← 모델별 성능 비교
├── pdf_processing.md          ← PDF 처리 전략
└── tts_optimization.md        ← TTS 최적화
```

---

## 6. Phase별 코드 리뷰 자동화

### 매 Phase 완료 시 자동 실행:

```powershell
# auto-review.ps1
# 1. 현재 상태 저장
git add .
git commit -m "chore: Phase X 완료 스냅샷"
git tag v1.0-phase-X

# 2. Claude Code로 코드 리뷰
claude --print "CLAUDE.md를 읽고 현재 코드베이스를 리뷰해줘.
SOLID, DRY, KISS 원칙 위반 체크.
파일당 400줄 초과 체크.
any 타입 사용 체크.
결과를 docs/review/phase-X-review.md로 저장."

# 3. 수정 후 재커밋
git add .
git commit -m "refactor: Phase X 코드 리뷰 반영"
git push
```

---

## 7. 배턴패스 (Baton-Pass) 전략

### save-state.md 형식:
```markdown
# 현재 상태 (2026-04-23)

## 완료된 것
- Phase 1: STT→LLM→TTS ✅
- Phase 2: OCR/Vision (진행 중)

## 현재 작업
- PDF 처리 pypdfium2 적용 중
- Vision 번역 한국어 불안정

## 다음 할 일
1. PDF Vision 테스트
2. 번역 품질 안정화
3. 대화 기록 저장

## 핵심 파일
- modules/ocr/gemini.ts (Vision)
- modules/ocr/pdf.ts (PDF)
- app/page.tsx (메인 UI)

## 알려진 이슈
- EXAONE 번역 시 규칙 텍스트 출력 버그
- qwen2.5vl 첫 로딩 3분 소요
```

---

## 8. Git 버전 관리 전략

```
main 브랜치: 안정 버전만
develop 브랜치: 개발 진행
feature/* 브랜치: 각 기능별

태그 전략:
v1.0.0-phase1  ← Phase 1 완료
v1.0.0-phase2  ← Phase 2 완료 (예정)
v1.0.0-pre-codex  ← Codex 도입 전 스냅샷 ← 지금 필요!
```

### 지금 당장 실행:
```powershell
cd C:\Users\tara0\readvoice-mvp
git add .
git commit -m "chore: pre-codex snapshot - Phase 1 완료, Phase 2 진행 중"
git tag v1.0.0-pre-codex
git push
git push --tags
```

---

## 9. claude-slim 적용 (토큰 절약)

```bash
# Claude Code 시작 시
claude --disable-slash-commands \
       --exclude-dynamic-system-prompt-sections \
       --no-session-persistence
```

---

## 10. 즉시 실행 순서

```
Step 1: Git 태그로 현재 상태 백업
Step 2: CLAUDE.md 100줄로 재작성
Step 3: docs/architecture/ 참조 문서 생성
Step 4: Phase 1~2 코드 리뷰 실행
Step 5: 발견된 이슈 수정
Step 6: Phase 2 나머지 완료
Step 7: Codex 도입 준비 ($200 플랜 후)
```

---

*파일 위치: C:\Users\tara0\readvoice-pro-agent\개발체계_재정립_플랜.md*
