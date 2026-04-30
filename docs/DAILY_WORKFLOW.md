# READ VOICE Pro - 매일 시작/종료 가이드

## 🌙 하루 종료 시 (노트북 끄기 전)

### 1. Git 저장 확인
```bash
cd C:\Users\tara0\readvoice-mvp
git status
```

**변경사항이 있다면:**
```bash
git add .
git commit -m "작업 종료: [오늘 한 일 간단 요약]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin master
```

### 2. 서버 종료
```bash
# Ctrl+C로 종료
# - npm run dev (터미널 1)
# - ollama serve (터미널 2)
```

### 3. 내일 할 일 확인
```bash
# 오늘 날짜: 2026-04-30 → 내일: 2026-05-01
cat docs/TODO_2026-05-01.md
# 또는
cat docs/daily-reports/2026-05-01-action-plan.md
```

### 4. 종료 체크리스트
- [ ] Git 커밋 & Push 완료
- [ ] npm/ollama 서버 종료
- [ ] 내일 TODO 확인
- [ ] 파워셸 창 모두 종료

---

## ☀️ 하루 시작 시 (노트북 켜고 난 후)

### STEP 1: 작업 디렉토리 이동
```powershell
cd C:\Users\tara0\readvoice-mvp
```

### STEP 2: Git 최신 상태 확인
```bash
git status
git log --oneline -5
```

### STEP 3: 서버 실행 (2개 터미널 필요)

**터미널 1: Ollama 서버**
```bash
ollama serve
```

**터미널 2: Next.js 개발 서버**
```bash
cd C:\Users\tara0\readvoice-mvp
npm run dev
```

**브라우저:** http://localhost:3000 열기

### STEP 4: 오늘 할 일 확인

**오늘 날짜로 파일명 변경해서 확인:**
```bash
# 예: 2026-05-01이면
cat docs/TODO_2026-05-01.md

# 또는
cat docs/daily-reports/2026-05-01-action-plan.md
```

### STEP 5: Claude Code 실행 (필요 시)
```bash
# VS Code나 별도 터미널에서
code .
```

---

## 📅 매일 변경해야 할 부분

### 1. 종료 시 (오늘 저녁)
```bash
# 오늘: ___________  (예: 2026-04-30)
# 내일: ___________  (예: 2026-05-01)

# 내일 TODO 확인
cat docs/TODO_[내일날짜].md
```

### 2. 시작 시 (내일 아침)
```bash
# 오늘: ___________  (예: 2026-05-01)

# 오늘 TODO 확인
cat docs/TODO_[오늘날짜].md
cat docs/daily-reports/[오늘날짜]-action-plan.md
```

---

## 🔧 자주 사용하는 명령어

### Git 상태 확인
```bash
git status
git log --oneline -10
git diff
```

### 버전 저장 (중요한 작업 완료 시)
```powershell
.\scripts\version-save.ps1 -Version "v2.X.X" -Message "[변경내용]"
```

### 일일 보고서 생성
```powershell
.\scripts\daily-report.ps1
```

### Ollama 모델 확인
```bash
ollama list
```

### 개발 서버 재시작
```bash
# Ctrl+C로 중지 후
npm run dev
```

---

## ⚠️ 문제 발생 시

### 1. npm run dev 실패
```bash
# 포트 충돌 확인
netstat -ano | findstr :3000

# 프로세스 강제 종료
taskkill /F /PID [프로세스ID]

# 다시 실행
npm run dev
```

### 2. Ollama 연결 실패
```bash
# Ollama 재시작
# Ctrl+C로 종료 후
ollama serve
```

### 3. Git 커밋 충돌
```bash
git pull origin master
# 충돌 해결 후
git add .
git commit -m "충돌 해결"
git push origin master
```

---

## 📋 체크리스트 템플릿

### 종료 시 (복사해서 사용)
```
날짜: _______
- [ ] Git 커밋 완료
- [ ] Git Push 완료
- [ ] npm 서버 종료
- [ ] ollama 서버 종료
- [ ] 내일 TODO 확인: docs/TODO________.md
```

### 시작 시 (복사해서 사용)
```
날짜: _______
- [ ] cd C:\Users\tara0\readvoice-mvp
- [ ] git status 확인
- [ ] ollama serve 실행 (터미널 1)
- [ ] npm run dev 실행 (터미널 2)
- [ ] http://localhost:3000 열기
- [ ] 오늘 TODO 읽기: docs/TODO________.md
```

---

## 💡 팁

1. **매일 아침 첫 작업**: 오늘 TODO 파일 읽기
2. **매일 저녁 마지막 작업**: Git 커밋 & Push
3. **중요한 작업 후**: 버전 저장 (`.\scripts\version-save.ps1`)
4. **점심/저녁 휴식 전**: Git 커밋 (작업 중간 저장)

---

**마지막 업데이트:** 2026-04-30
