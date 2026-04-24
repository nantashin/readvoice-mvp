# 일일 보고서 자동 생성 스크립트
# 사용법: .\scripts\daily-report.ps1

$ROOT = "C:\Users\tara0\readvoice-mvp"
$REPORTS_DIR = "$ROOT\docs\daily-reports"
$TODAY = Get-Date -Format "yyyy-MM-dd"
$REPORT_FILE = "$REPORTS_DIR\$TODAY.md"

Write-Host "📊 일일 보고서 생성 중..." -ForegroundColor Cyan

# 1. 보고서 디렉토리 생성 (없으면)
if (-not (Test-Path $REPORTS_DIR)) {
    New-Item -ItemType Directory -Path $REPORTS_DIR | Out-Null
    Write-Host "✅ 보고서 디렉토리 생성됨: $REPORTS_DIR" -ForegroundColor Green
}

# 2. Git 정보 수집
Write-Host "📝 Git 정보 수집 중..." -ForegroundColor Yellow

# UTF-8 인코딩 설정
$env:PYTHONIOENCODING = "utf-8"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$gitBranch = git -C $ROOT branch --show-current
$todayCommits = git -C $ROOT log --oneline `
  --after="$TODAY 00:00" --before="$TODAY 23:59" --no-merges 2>$null |
  ForEach-Object { [System.Text.Encoding]::UTF8.GetString(
    [System.Text.Encoding]::Default.GetBytes($_)) }
$gitStatus = git -C $ROOT status --short | Out-String

# 커밋이 없으면 메시지 표시
if ([string]::IsNullOrWhiteSpace($todayCommits)) {
    $todayCommits = "- 오늘 커밋이 없습니다."
}

# 3. Ollama 모델 목록
Write-Host "🤖 Ollama 모델 확인 중..." -ForegroundColor Yellow
try {
    $ollamaModels = ollama list | Out-String
} catch {
    $ollamaModels = "Ollama 실행 중이 아니거나 명령어를 찾을 수 없습니다."
}

# 4. 빌드 상태 확인
Write-Host "🔨 빌드 상태 확인 중..." -ForegroundColor Yellow
$buildStatus = "❓ 확인 안 됨"
$buildDir = "$ROOT\.next"
if (Test-Path $buildDir) {
    $buildTime = (Get-Item $buildDir).LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    $buildStatus = "✅ 성공 (마지막 빌드: $buildTime)"
} else {
    $buildStatus = "❌ 빌드되지 않음"
}

# 5. Node.js/npm 버전
$nodeVersion = node --version 2>$null
$npmVersion = npm --version 2>$null

# 6. 보고서 생성
$datetime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$reportContent = @"
# 일일 보고서 - $TODAY

**생성 시각:** $datetime
**브랜치:** $gitBranch

---

## 📝 오늘의 커밋

``````
$todayCommits
``````

---

## 📂 변경된 파일

``````
$gitStatus
``````

---

## 🤖 Ollama 모델 목록

``````
$ollamaModels
``````

---

## 🔨 빌드 상태

$buildStatus

---

## 🛠️ 환경

- **Node.js:** $nodeVersion
- **npm:** $npmVersion
- **OS:** Windows 11
- **프로젝트:** READ VOICE Pro MVP

---

## 📌 다음 작업

- [ ] TODO 1
- [ ] TODO 2
- [ ] TODO 3

---

**저장소:** https://github.com/nantashin/readvoice-mvp
"@

# 7. 파일 저장
$reportContent | Set-Content $REPORT_FILE -Encoding UTF8

Write-Host ""
Write-Host "✅ 일일 보고서 생성 완료!" -ForegroundColor Green
Write-Host "📄 위치: $REPORT_FILE" -ForegroundColor Cyan
Write-Host ""

# 8. 보고서 내용 출력
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Get-Content $REPORT_FILE
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "💡 보고서를 확인한 후 다음 작업 항목을 수정하세요." -ForegroundColor Yellow
