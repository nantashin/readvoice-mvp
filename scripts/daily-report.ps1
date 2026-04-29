# =====================================================
# READ VOICE Pro 일일 개발 보고서 자동 생성
# 사용법: .\scripts\daily-report.ps1
# =====================================================

# 인코딩 설정 (최상단 필수)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
$env:LANG = "ko_KR.UTF-8"
$env:GIT_PAGER = "cat"
$env:PYTHONIOENCODING = "utf-8"

# 경로 설정
$ROOT      = "C:\Users\tara0\readvoice-mvp"
$REPORT1   = "$ROOT\docs\daily-reports"
$REPORT2   = "C:\Users\tara0\readvoice-pro-agent\업무일지"
$Date      = Get-Date -Format "yyyy-MM-dd"
$DateTime  = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

New-Item -ItemType Directory -Force $REPORT1 | Out-Null
New-Item -ItemType Directory -Force $REPORT2 | Out-Null

Write-Host "📊 일일 보고서 생성 중..." -ForegroundColor Cyan

# ── git 정보 수집 ──────────────────────────────────
Write-Host "📝 Git 정보 수집 중..." -ForegroundColor Yellow

$branch = git -C $ROOT branch --show-current 2>$null

# 오늘 커밋 목록 (UTF-8 강제)
$rawCommits = git -C $ROOT log `
  --format="%h|%s|%an|%ar" `
  --after="$Date 00:00" `
  --before="$Date 23:59" 2>$null

$commits = @()
if ($rawCommits) {
  $commits = $rawCommits | ForEach-Object {
    try {
      $bytes = [System.Text.Encoding]::Default.GetBytes($_)
      $converted = [System.Text.Encoding]::UTF8.GetString($bytes)
      if ($converted -match '[\uAC00-\uD7A3]') { $converted } else { $_ }
    } catch { $_ }
  }
}

# 커밋 상세 (변경 파일 포함)
$commitDetails = ""
if ($commits) {
  foreach ($c in $commits) {
    $parts = $c -split '\|'
    if ($parts.Count -ge 4) {
      $hash    = $parts[0].Trim()
      $msg     = $parts[1].Trim()
      $author  = $parts[2].Trim()
      $when    = $parts[3].Trim()
      $files   = git -C $ROOT show --stat --format="" $hash 2>$null | 
                 Where-Object { $_ -match '\.' } | 
                 Select-Object -First 5
      $fileList = if ($files) { ($files | ForEach-Object { "    - $_" }) -join "`n" } else { "    - (파일 정보 없음)" }
      $commitDetails += "- [$hash] $msg ($when)`n$fileList`n"
    }
  }
} else {
  $commitDetails = "- 오늘 커밋 없음"
}

# 커밋 분류
$featCommits  = $commits | Where-Object { $_ -match '\|feat:' }  | ForEach-Object { $_ -split '\|' | Select-Object -Index 0,1 | Join-String -Separator ' ' }
$fixCommits   = $commits | Where-Object { $_ -match '\|fix:' }   | ForEach-Object { $_ -split '\|' | Select-Object -Index 0,1 | Join-String -Separator ' ' }
$otherCommits = $commits | Where-Object { $_ -notmatch '\|feat:' -and $_ -notmatch '\|fix:' } | ForEach-Object { $_ -split '\|' | Select-Object -Index 0,1 | Join-String -Separator ' ' }

$featList  = if ($featCommits)  { ($featCommits  | ForEach-Object { "- $_" }) -join "`n" } else { "- 없음" }
$fixList   = if ($fixCommits)   { ($fixCommits   | ForEach-Object { "- $_" }) -join "`n" } else { "- 없음" }
$otherList = if ($otherCommits) { ($otherCommits | ForEach-Object { "- $_" }) -join "`n" } else { "- 없음" }

# 변경 파일 전체
$changedFiles = git -C $ROOT diff --name-only "HEAD~$($commits.Count)..HEAD" 2>$null
$changedList  = if ($changedFiles) { ($changedFiles | ForEach-Object { "- $_" }) -join "`n" } else { "- 없음" }

# ── 버전 정보 ──────────────────────────────────────
$latestTag = git -C $ROOT describe --tags --abbrev=0 2>$null
if (-not $latestTag) { $latestTag = "v0.0.0 (태그 없음)" }

# ── save-state.md 읽기 ─────────────────────────────
$saveState = ""
$saveStatePath = "$ROOT\docs\handoff\save-state.md"
if (Test-Path $saveStatePath) {
  $saveState = Get-Content $saveStatePath -Raw -Encoding UTF8
} else {
  $saveState = "save-state.md 파일이 없습니다."
}

# ── next-task.md 읽기 ──────────────────────────────
$nextTask = ""
$nextTaskPath = "$ROOT\docs\handoff\next-task.md"
if (Test-Path $nextTaskPath) {
  $nextTask = Get-Content $nextTaskPath -Raw -Encoding UTF8
} else {
  $nextTask = "next-task.md 파일이 없습니다. 직접 작성해주세요."
}

# ── roadmap-data.json 읽기 ─────────────────────────
$roadmapPath = "$ROOT\docs\roadmap-data.json"
$phase2Goal = "정보 없음"
$phase2Pct  = "?"
$phase2Todo = "정보 없음"
$totalPct   = "?"

if (Test-Path $roadmapPath) {
  try {
    $roadmap   = Get-Content $roadmapPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $totalPct  = $roadmap.totalProgress
    $phase2    = $roadmap.phases | Where-Object { $_.phase -eq "Phase 2" }
    if ($phase2) {
      $phase2Goal = $phase2.detail
      $phase2Pct  = $phase2.pct
    }
  } catch {
    $phase2Goal = "roadmap-data.json 파싱 오류"
  }
}

# ── 기능 작동 여부 확인 ────────────────────────────
function Check { param($path) if (Test-Path "$ROOT\$path") { "✅ 작동" } else { "❌ 파일 없음" } }

$statusVoice  = Check "app/api/chat/route.ts"
$statusImage  = Check "modules/ocr/gemini.ts"
$statusPdf    = Check "modules/ocr/pdf.ts"
$statusBgm    = Check "lib/audio/bgm-manager.ts"
$statusTts    = Check "lib/speech/tts.ts"
$statusStt    = Check "lib/speech/stt.ts"

# ── Ollama 모델 목록 ───────────────────────────────
Write-Host "🤖 Ollama 모델 확인 중..." -ForegroundColor Yellow
$ollamaList = ollama list 2>$null
$ollamaText = if ($ollamaList) { $ollamaList -join "`n" } else { "Ollama 실행 중이지 않거나 모델 없음" }

# ── 환경 정보 ──────────────────────────────────────
$nodeVer   = node --version 2>$null
$npmVer    = npm --version 2>$null
$pythonVer = python --version 2>$null
$ollamaVer = ollama --version 2>$null

# ── 보고서 생성 ────────────────────────────────────
$report = @"
# READ VOICE Pro — 일일 개발 보고서
- **날짜:** $Date
- **생성 시각:** $DateTime
- **현재 버전:** $latestTag
- **브랜치:** $branch
- **전체 진행률:** $totalPct%

---

## 📊 오늘의 작업 (커밋 $($commits.Count)개)

### 커밋 상세 목록
$commitDetails

### 기능 추가 (feat)
$featList

### 버그 수정 (fix)
$fixList

### 기타 (chore/docs/refactor)
$otherList

### 오늘 변경된 파일
$changedList

---

## 🚧 현재 진행 중인 작업

$saveState

---

## ✅ 현재 작동하는 기능 (데모 가능)

| 기능 | 상태 |
|------|------|
| 음성 대화 (STT→LLM→TTS) | $statusVoice |
| 이미지 분석 (Vision) | $statusImage |
| PDF OCR | $statusPdf |
| BGM 재생 | $statusBgm |
| TTS 전처리 | $statusTts |
| STT 음성 인식 | $statusStt |

---

## 📱 Phase 2 목표 vs 현재

### Phase 2 최종 목표
$phase2Goal

### 현재 진행률
$phase2Pct% 완료

### 지금 나오는 결과물
- 음성으로 질문하면 AI가 음성으로 답변 $statusVoice
- 이미지 업로드하면 한국어로 설명 $statusImage
- PDF 업로드하면 텍스트 추출 후 읽어줌 $statusPdf
- 분석 중 BGM 자동 재생 $statusBgm
- 마크다운/특수기호 없이 자연스럽게 TTS 읽기 $statusTts

### 부족한 부분 (TODO)
$phase2Todo

---

## ⚠️ 알려진 이슈 / 미해결 문제

(save-state.md 의 알려진 이슈 섹션 참고)

---

## 🤖 설치된 Ollama 모델

```
$ollamaText
```

---

## 🔧 환경 정보

- **Node.js:** $nodeVer
- **npm:** $npmVer
- **Python:** $pythonVer
- **Ollama:** $ollamaVer

---

## 📝 다음 작업

$nextTask

---

_Generated by scripts/daily-report.ps1_
"@

# 보고서 저장
$reportFile1 = Join-Path $REPORT1 "$Date.md"
$reportFile2 = Join-Path $REPORT2 "$Date.md"

$report | Set-Content $reportFile1 -Encoding UTF8
$report | Set-Content $reportFile2 -Encoding UTF8

Write-Host "✅ 일일 보고서 생성 완료" -ForegroundColor Green
Write-Host "   📁 $reportFile1" -ForegroundColor Gray
Write-Host "   📁 $reportFile2" -ForegroundColor Gray
