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
$featCommits  = $commits | Where-Object { $_ -match '\|feat:' }  | ForEach-Object { ($_ -split '\|')[0,1] -join ' ' }
$fixCommits   = $commits | Where-Object { $_ -match '\|fix:' }   | ForEach-Object { ($_ -split '\|')[0,1] -join ' ' }
$otherCommits = $commits | Where-Object { $_ -notmatch '\|feat:' -and $_ -notmatch '\|fix:' } | ForEach-Object { ($_ -split '\|')[0,1] -join ' ' }

$featList  = if ($featCommits)  { ($featCommits  | ForEach-Object { "- $_" }) -join "`n" } else { "- 없음" }
$fixList   = if ($fixCommits)   { ($fixCommits   | ForEach-Object { "- $_" }) -join "`n" } else { "- 없음" }
$otherList = if ($otherCommits) { ($otherCommits | ForEach-Object { "- $_" }) -join "`n" } else { "- 없음" }

# 변경 파일 전체 (오늘 커밋만)
$changedFiles = $null
if ($commits.Count -gt 0) {
  $firstCommitToday = git -C $ROOT log --format="%H" --after="$Date 00:00" --before="$Date 23:59" 2>$null | Select-Object -Last 1
  if ($firstCommitToday) {
    $changedFiles = git -C $ROOT diff --name-only "${firstCommitToday}^..HEAD" 2>$null
  }
}
$changedList = if ($changedFiles) { ($changedFiles | ForEach-Object { "- $_" }) -join "`n" } else { "- 오늘 변경된 파일 없음" }

# ── 버전 정보 ──────────────────────────────────────
$latestTag = git -C $ROOT describe --tags --abbrev=0 2>$null
if (-not $latestTag) { $latestTag = "v0.0.0 (태그 없음)" }

# ── save-state.md 읽기 ─────────────────────────────
$saveState = ""
$nextTasks = ""
$currentIssues = ""
$saveStatePath = "$ROOT\docs\handoff\save-state.md"

if (Test-Path $saveStatePath) {
  $saveState = Get-Content $saveStatePath -Raw -Encoding UTF8

  # "오늘 할 일" 섹션 추출 (정규식)
  if ($saveState -match '(?s)## 오늘 할 일.*?(?=##|$)') {
    $nextTasks = $matches[0].Trim()
  } else {
    $nextTasks = "- [ ] 다음 작업을 save-state.md에 기록해주세요"
  }

  # "현재 이슈" 섹션 추출 (선택적)
  if ($saveState -match '(?s)## 현재 이슈(.+?)(?=##|$)') {
    $currentIssues = $matches[1].Trim()
  } else {
    $currentIssues = ""
  }
} else {
  $saveState = "save-state.md 파일이 없습니다."
  $nextTasks = "- [ ] save-state.md 파일을 먼저 생성해주세요"
  $currentIssues = ""
}

# ── roadmap-data.json 읽기 ─────────────────────────
$roadmapPath = "$ROOT\docs\roadmap-data.json"
$phase2Goal = "정보 없음"
$phase2Pct  = "?"
$phase2Todo = "정보 없음"
$totalPct   = "?"
$currentVersion = "알 수 없음"

if (Test-Path $roadmapPath) {
  try {
    $roadmap   = Get-Content $roadmapPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $totalPct  = $roadmap.totalProgress
    $currentVersion = $roadmap.version
    $phase2    = $roadmap.phases | Where-Object { $_.phase -eq "Phase 2" }
    if ($phase2) {
      $phase2Goal = $phase2.detail
      $phase2Pct  = $phase2.pct
    }
  } catch {
    $phase2Goal = "roadmap-data.json 파싱 오류"
  }
}

# 현재 Phase 상태 문자열 생성
$phaseLines = ""
if (Test-Path $roadmapPath) {
  $roadmap.phases | ForEach-Object {
    $icon = switch ($_.status) {
      "done"    { "[완료]" }
      "current" { "[진행중]" }
      "todo"    { "[예정]" }
      default   { "[예정]" }
    }
    $phaseLines += "$icon $($_.phase): $($_.name) ($($_.pct)%) — $($_.detail)`n"
  }
}
$phaseStatus = if ($phaseLines) { $phaseLines.Trim() } else { "로드맵 정보 없음" }

# ── 기능 작동 여부 확인 ────────────────────────────
function Check { param($path) if (Test-Path "$ROOT\$path") { "[OK] 작동" } else { "[X] 파일 없음" } }

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
# READ VOICE Pro (IYE:V2V) — 일일 개발 보고서
- **날짜:** $Date
- **버전:** $currentVersion
- **브랜치:** $branch
- **전체 진행률:** $totalPct%

---

## 📍 현재 Phase 위치

$phaseStatus

---

## 📊 오늘의 작업 (커밋 $($commits.Count)개)

$commitDetails

### 기능 추가 (feat)
$featList

### 버그 수정 (fix)
$fixList

### 기타
$otherList

### 오늘 변경된 파일
$changedList

---

## 📅 내일 할 일

$nextTasks

---

## 🔄 현재 이슈

$currentIssues

---

## ✅ 기능 작동 상태

음성대화: $statusVoice / 이미지분석: $statusImage / PDF OCR: $statusPdf / BGM: $statusBgm / TTS: $statusTts

---

## 🔧 환경 정보

- **Node.js:** $nodeVer
- **npm:** $npmVer
- **Ollama:** $ollamaVer

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

# ══════════════════════════════════════════════════════
# ✨ 업무보고 요약 TXT 생성
# ══════════════════════════════════════════════════════
Write-Host "📋 업무보고 요약 TXT 생성 중..." -ForegroundColor Yellow

$summaryTxtPath = Join-Path $REPORT2 "${Date}_업무보고_요약.txt"

# 커밋 수 계산
$commitCount = $commits.Count

# 커밋 목록 (간단하게)
$commitListSimple = if ($commits) {
  ($commits | ForEach-Object {
    $parts = $_ -split '\|'
    if ($parts.Count -ge 2) { "  - $($parts[0].Trim()): $($parts[1].Trim())" }
  }) -join "`n"
} else {
  "  - 오늘 커밋 없음"
}

# 변경 파일 목록 (간단하게)
$changedFilesSimple = if ($changedFiles) {
  ($changedFiles | ForEach-Object { "  - $_" }) -join "`n"
} else {
  "  - 변경된 파일 없음"
}

$summaryTxt = @"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
READ VOICE Pro (IYE:V2V) - 일일 업무 보고 ($Date)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 작업 개요
- 작업 일자: $Date
- 현재 버전: $currentVersion
- 오늘 커밋 수: $commitCount개
- 전체 진행률: $totalPct%

📍 Phase 위치
$phaseStatus

✅ 주요 완료 사항
$commitListSimple

🔧 기술적 변경사항
$changedFilesSimple

⚠️ 현재 이슈
$currentIssues

📅 내일 작업 계획
$nextTasks

📈 현재 작동 상태
음성대화 ($statusVoice) / 이미지분석 ($statusImage) / PDF OCR ($statusPdf) / BGM ($statusBgm) / TTS ($statusTts)

🛠️ 개발 환경
- Node.js: $nodeVer
- npm: $npmVer
- Ollama: $ollamaVer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
작성: $DateTime | 다음 보고: 내일
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@

$summaryTxt | Set-Content $summaryTxtPath -Encoding UTF8

Write-Host "✅ 업무보고 요약 TXT 생성 완료" -ForegroundColor Green
Write-Host "   📁 $summaryTxtPath" -ForegroundColor Gray

# ══════════════════════════════════════════════════════
# ✨ 세션 요약 MD 생성
# ══════════════════════════════════════════════════════
Write-Host "📝 세션 요약 MD 생성 중..." -ForegroundColor Yellow

$sessionMdPath = Join-Path $REPORT1 "${Date}-session-summary.md"

$sessionMd = @"
# 세션 요약 — $Date

## 작업 시간
- **생성 시각:** $DateTime
- **현재 버전:** $currentVersion
- **브랜치:** $branch
- **전체 진행률:** $totalPct%

## Phase 위치
$phaseStatus

## 오늘의 커밋 ($commitCount개)
$commitListSimple

## 변경된 파일
$changedFilesSimple

## 현재 이슈
$currentIssues

## 다음 작업
$nextTasks

---

_Generated by scripts/daily-report.ps1_
"@

$sessionMd | Set-Content $sessionMdPath -Encoding UTF8

Write-Host "✅ 세션 요약 MD 생성 완료" -ForegroundColor Green
Write-Host "   📁 $sessionMdPath" -ForegroundColor Gray

# ══════════════════════════════════════════════════════
# ✨ 로드맵 PPTX 생성
# ══════════════════════════════════════════════════════
Write-Host "📊 로드맵 PPTX 생성 중..." -ForegroundColor Yellow

$nodeCheck = node --version 2>$null
if ($nodeCheck) {
  try {
    node "$ROOT\scripts\generate-roadmap.js" 2>$null
    $pptxFile = "$ROOT\docs\daily-reports\roadmap_$($Date.Replace('-','')).pptx"
    if (Test-Path $pptxFile) {
      Write-Host "✅ 로드맵 PPTX 생성 완료" -ForegroundColor Green
      Write-Host "   📁 $pptxFile" -ForegroundColor Gray
    } else {
      Write-Host "⚠️  PPTX 파일 생성 실패 (경로 확인 필요)" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "⚠️  PPTX 생성 중 오류: $_" -ForegroundColor Yellow
  }
} else {
  Write-Host "⚠️  Node.js 없음 (PPTX 생성 스킵)" -ForegroundColor Yellow
}

# ══════════════════════════════════════════════════════
# 🔄 Git Add & Commit
# ══════════════════════════════════════════════════════
Write-Host "🔄 Git에 보고서 추가 중..." -ForegroundColor Yellow

git -C $ROOT add docs/daily-reports/ 2>$null

$gitStatus = git -C $ROOT status --short docs/daily-reports/ 2>$null
if ($gitStatus) {
  git -C $ROOT commit -m "docs: 일일 보고서 자동 생성 ($Date)" 2>$null
  Write-Host "✅ Git 커밋 완료" -ForegroundColor Green
} else {
  Write-Host "ℹ️  변경사항 없음 (커밋 스킵)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✨ 모든 보고서 생성 완료" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
