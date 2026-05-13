# 일일 개발 루틴

**목적:** 매일 반복되는 작업을 표준화하여 실수 방지 및 효율성 향상

---

## 🌅 아침 시작 루틴

### 1. 프로젝트 디렉토리 이동
```bash
cd C:\Users\tara0\readvoice-mvp
```

### 2. Claude Code 세션 재개
```bash
claude --continue
```

### 3. 상황 파악 및 계획 확인
```
HANDOFF.md 읽어. 오늘 P1 계획만 먼저 보여줘
```

**목적:**
- 이전 세션에서 남긴 핸드오프 메모 확인
- 오늘의 최우선 작업(P1) 파악
- 막힌 부분이나 이슈 확인

---

## 🌙 저녁 마무리 루틴

### 1. 작업 완료 커밋
```bash
git add .
git commit -m "feat: 오늘 작업 내용 요약

- 주요 변경사항 1
- 주요 변경사항 2
- 주요 변경사항 3

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**주의사항:**
- 모든 변경 파일이 staging area에 추가되었는지 확인
- 커밋 메시지는 명확하고 구체적으로 작성
- feat/fix/docs/chore 등 커밋 타입 명시

### 2. 버전 저장 (중요 마일스톤 시)
```powershell
.\scripts\version-save.ps1 -Version "v2.9.0" -Message "Phase 2 완성 - 음성명령/보안/이미지8종/UX개선"
```

**버전 저장 기준:**
- Phase 완료 시
- 주요 기능 추가 시 (feat)
- 중요한 버그 수정 완료 시
- 일주일에 1회 이상 (금요일 권장)

**버전 번호 규칙:**
- v1.x.x: Phase 1 (STT/LLM/TTS)
- v2.x.x: Phase 2 (OCR/Vision)
- v3.x.x: Phase 3 (웹 검색)
- 마이너(x.1.x): 기능 추가
- 패치(x.x.1): 버그 수정

### 3. 일일 보고서 생성
```powershell
.\scripts\daily-report.ps1
```

**생성 파일 (자동):**
- `docs/daily-reports/YYYY-MM-DD.md` (메인 보고서)
- `docs/daily-reports/YYYY-MM-DD-session-summary.md` (세션 요약)
- `docs/daily-reports/roadmap_YYYYMMDD.pptx` (로드맵 PPTX)
- `C:\Users\tara0\readvoice-pro-agent\업무일지\YYYY-MM-DD_업무보고_요약.txt`

**주의사항:**
- 스크립트 실행 전 모든 커밋이 완료되었는지 확인
- PowerShell 5.1 환경에서 실행
- Node.js가 설치되어 있어야 PPTX 생성 가능

### 4. 원격 저장소에 푸시
```bash
git push origin master
```

**확인 사항:**
- 푸시 성공 메시지 확인
- GitHub에서 커밋 이력 확인
- CI 빌드 성공 확인 (자동)

---

## 📋 주간 루틴 (금요일 저녁)

### 추가 작업
1. **버전 저장 (필수)**
   ```powershell
   .\scripts\version-save.ps1 -Version "v버전" -Message "이번 주 요약"
   ```

2. **HANDOFF.md 업데이트**
   - 이번 주 완료 작업 정리
   - 다음 주 P1/P2/P3 계획 작성
   - 막힌 부분 명시

3. **save-state.md 업데이트**
   - 다음 주 월요일 시작 메시지 작성
   - 현재 상태 요약
   - 알려진 이슈 업데이트

---

## ⚠️ 주의사항

### 커밋하기 전 확인
- [ ] `npm run build` 성공
- [ ] `npm run lint` 에러 없음
- [ ] TypeScript 컴파일 에러 없음
- [ ] `.env.local`은 커밋하지 않음
- [ ] `node_modules/`는 커밋하지 않음

### 버전 저장 전 확인
- [ ] 모든 변경사항 커밋 완료
- [ ] 버전 번호가 올바른지 확인 (v2.9.0 → v2.9.1)
- [ ] 메시지에 주요 변경사항 포함

### 일일 보고서 생성 전 확인
- [ ] 오늘 작업 커밋 완료
- [ ] `docs/roadmap-data.json` 최신 상태
- [ ] PowerShell 5.1 실행 환경
- [ ] Node.js 설치 확인 (PPTX 생성용)

---

## 🔧 트러블슈팅

### daily-report.ps1 실행 오류
```powershell
# UTF-8 인코딩 문제 시
python -c "
with open('scripts/daily-report.ps1', 'r', encoding='utf-8') as f:
    content = f.read()
with open('scripts/daily-report.ps1', 'w', encoding='utf-8-sig', newline='\r\n') as f:
    f.write(content)
"
```

### Git 푸시 실패
```bash
# 원격과 로컬 충돌 시
git pull --rebase origin master
git push origin master
```

### 버전 저장 실패
```bash
# 수동 버전 저장 방법 (PowerShell 스크립트 실패 시)
mkdir -p docs/versions/v2.9.0
cp CLAUDE.md docs/versions/v2.9.0/
# 주요 파일들 복사...
git add docs/versions/
git commit -m "chore: v2.9.0 버전 저장"
```

---

## 📊 루틴 준수 체크리스트

### 매일
- [ ] 아침: HANDOFF.md 읽기
- [ ] 저녁: 작업 커밋
- [ ] 저녁: daily-report.ps1 실행
- [ ] 저녁: git push

### 주 1회 (금요일)
- [ ] version-save.ps1 실행
- [ ] HANDOFF.md 업데이트
- [ ] save-state.md 업데이트

### Phase 완료 시
- [ ] 버전 저장 (메이저 버전)
- [ ] VERSION_HISTORY.md 업데이트
- [ ] roadmap-data.json 진행률 업데이트

---

**마지막 업데이트:** 2026-05-13  
**담당자:** READ VOICE Pro 개발팀
