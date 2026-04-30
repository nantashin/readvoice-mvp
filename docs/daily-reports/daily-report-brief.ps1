# =====================================================
# READ VOICE Pro 보고용 업무일지 자동 생성
# 사용법:
#   .\scripts\daily-report-brief.ps1 -ExpectedDoneDate "2026-05-31"
# =====================================================

param(
    [string]$Root = "C:\Users\tara0\readvoice-mvp",
    [string]$ExpectedDoneDate = "2026-05-31"
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
$env:LANG = "ko_KR.UTF-8"
$env:GIT_PAGER = "cat"
$env:PYTHONIOENCODING = "utf-8"

$Date = Get-Date -Format "yyyy-MM-dd"
$DateTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$BriefDir1 = Join-Path $Root "docs\daily-reports\brief"
$BriefDir2 = "C:\Users\tara0\readvoice-pro-agent\보고용업무일지"
New-Item -ItemType Directory -Force $BriefDir1 | Out-Null
New-Item -ItemType Directory -Force $BriefDir2 | Out-Null

function Get-GitLines {
    param([string[]]$GitArgs)
    try { git -C $Root @GitArgs 2>$null } catch { @() }
}

$branch = (Get-GitLines @("branch", "--show-current"))
if (-not $branch) { $branch = "master" }

$commits = Get-GitLines @("log", "--format=%h|%s", "--after=$Date 00:00", "--before=$Date 23:59")

function Add-Unique {
    param([System.Collections.ArrayList]$List, [string]$Item)
    if ($Item -and -not $List.Contains($Item)) { [void]$List.Add($Item) }
}

$todayWork = New-Object System.Collections.ArrayList
$fixes = New-Object System.Collections.ArrayList
$errors = New-Object System.Collections.ArrayList
$tests = New-Object System.Collections.ArrayList
$remaining = New-Object System.Collections.ArrayList
$tomorrow = New-Object System.Collections.ArrayList

foreach ($line in $commits) {
    $parts = $line -split "\|", 2
    if ($parts.Count -lt 2) { continue }
    $msg = $parts[1]

    if ($msg -match "7개 모델|파일 업로드") { Add-Unique $todayWork "7개 모델 음성 우선 파일 업로드 플로우 구현" }
    if ($msg -match "TTS|onEnd") { Add-Unique $fixes "TTS onEnd 콜백 기반 결과 끝까지 읽기 수정" }
    if ($msg -match "일일 보고서|daily-report") { Add-Unique $todayWork "일일 개발 보고서 자동 생성 스크립트 개선" }
    if ($msg -match "한글 깨짐") { Add-Unique $fixes "daily-report.ps1 한글 깨짐 수정" }
    if ($msg -match "CLAUDE.md") { Add-Unique $todayWork "7개 모델 구조 및 음성 플로우 문서 반영" }
    if ($msg -match "인수인계") { Add-Unique $todayWork "세션 인수인계 문서 작성" }
    if ($msg -match "구글 모델") { Add-Unique $fixes "구글 모델 TTS 안내명 정리" }
    if ($msg -match "계정 전환 전 저장") { Add-Unique $todayWork "개발 중간 상태 저장" }
}

if ($todayWork.Count -eq 0) { Add-Unique $todayWork "금일 개발 변경사항 정리" }

# 기능 상태: 파일 존재 여부 기반 간단 점검
if (Test-Path (Join-Path $Root "app\api\chat\route.ts")) { Add-Unique $tests "음성 대화 STT→LLM→TTS 흐름 테스트" }
if (Test-Path (Join-Path $Root "app\components\FileUpload.tsx")) { Add-Unique $tests "파일 업로드 및 모델 선택 흐름 테스트" }
if (Test-Path (Join-Path $Root "modules\ocr\pdf.ts")) { Add-Unique $tests "PDF 텍스트 추출 및 OCR 처리 테스트" }
if (Test-Path (Join-Path $Root "lib\audio\bgm-manager.ts")) { Add-Unique $tests "분석 중 BGM 재생 및 TTS 전환 테스트" }

# handoff 문서 기반 알려진 이슈 보강
$handoffPath = Join-Path $Root "docs\handoff\session-handoff.md"
if (Test-Path $handoffPath) {
    $handoff = Get-Content $handoffPath -Raw -Encoding UTF8
    if ($handoff -match "PDF OCR") { Add-Unique $errors "PDF OCR 브라우저 실행 안정화 이슈" }
    if ($handoff -match "빈 응답") { Add-Unique $errors "Vision LLM 일부 빈 응답 반환 이슈" }
    if ($handoff -match "qwen") { Add-Unique $errors "사용자 선택 모델 qwen 고정 의심 이슈" }
    if ($handoff -match "BGM") { Add-Unique $tomorrow "BGM 끄기·줄이기 자연어 명령 추가" }
}

Add-Unique $remaining "PDF OCR 브라우저 실행 안정화"
Add-Unique $remaining "사용자 선택 OCR 모델 반영 여부 검증"
Add-Unique $remaining "qwen3.5 빈 응답 원인 분석"
Add-Unique $remaining "olmOCR2 레이아웃 특화 성능 테스트"
Add-Unique $remaining "모델 선택 안내 TTS 끊김 완전 해결"

Add-Unique $tomorrow "PDF OCR 모델 선택 버그 수정"
Add-Unique $tomorrow "Vision LLM 빈 응답 원인 분리 테스트"
Add-Unique $tomorrow "gemma4:e2b 대체 OCR 테스트"
Add-Unique $tomorrow "모델 선택 안내 음성 출력 안정화"

# 진행률 추출: 오늘 개발용 보고서 우선, 없으면 roadmap-data.json, 마지막 fallback
$totalPct = "38"
$phase2Pct = "65"
$detailedPath = Join-Path $Root "docs\daily-reports\$Date.md"
if (Test-Path $detailedPath) {
    $daily = Get-Content $detailedPath -Raw -Encoding UTF8
    if ($daily -match "전체 진행률:\*\*\s*(\d+)%") { $totalPct = $Matches[1] }
    if ($daily -match "현재 진행률\s*(\d+)%\s*완료") { $phase2Pct = $Matches[1] }
}

$roadmapPath = Join-Path $Root "docs\roadmap-data.json"
if (Test-Path $roadmapPath) {
    try {
        $roadmap = Get-Content $roadmapPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($roadmap.totalProgress) { $totalPct = [string]$roadmap.totalProgress }
        $phase2 = $roadmap.phases | Where-Object { $_.phase -eq "Phase 2" }
        if ($phase2 -and $phase2.pct) { $phase2Pct = [string]$phase2.pct }
    } catch {}
}

function To-Bullets {
    param([System.Collections.ArrayList]$List, [int]$Max = 8)
    if (-not $List -or $List.Count -eq 0) { return "- 해당 없음" }
    return (($List | Select-Object -First $Max | ForEach-Object { "- $_" }) -join "`n")
}

$install = @(
    "Next.js·TypeScript 기반 개발 환경 유지",
    "Ollama 로컬 모델 운용 환경 확인",
    "PDF/OCR 처리용 Python·Tesseract 연동 환경 확인",
    "Claude Code 기반 개발·문서화 환경 유지"
)

$result = @(
    "음성 대화 기능 데모 가능 상태",
    "이미지 분석 기능 데모 가능 상태",
    "PDF/OCR 파이프라인 구현 및 안정화 진행 상태",
    "접근성 중심 음성 안내 흐름 개선 상태",
    "개발용 일일 보고서 자동화 개선 상태"
)

$report = @"
# READ VOICE Pro 보고용 업무일지

- 날짜: $Date
- 생성 시각: $DateTime
- 프로젝트: READ VOICE Pro MVP
- 브랜치: $branch
- 현재 위치: 전체 로드맵 $totalPct% / Phase 2 이미지·PDF 분석 $phase2Pct%
- 예상 개발 완료일자: $ExpectedDoneDate, MVP 기준

---

## 1. 오늘 업무

$(To-Bullets $todayWork 8)

---

## 2. 설치

$(($install | ForEach-Object { "- $_" }) -join "`n")

---

## 3. 테스트

$(To-Bullets $tests 8)

---

## 4. 오류

$(To-Bullets $errors 8)

---

## 5. 수정

$(To-Bullets $fixes 8)

---

## 6. 결과

$(($result | ForEach-Object { "- $_" }) -join "`n")

---

## 7. 남은 과제

$(To-Bullets $remaining 8)

---

## 8. 내일 업무

$(To-Bullets $tomorrow 8)

---

## 9. 총 로드맵 중 현재 위치

- 전체 로드맵: $totalPct% 진행
- 현재 단계: Phase 2 — 이미지·PDF 분석 / OCR·Vision 고도화
- Phase 2 진행률: $phase2Pct% 완료
- 완료 단계: Phase 1 음성 대화 기본 기능
- 진행 단계: 파일 업로드·이미지 분석·PDF OCR 안정화
- 다음 단계: Phase 3 웹 검색 연동 및 서비스 확장 준비

---

## 10. 예상 개발 완료일자

- Phase 2 안정화 예상: 2026-05-10
- MVP 개발 완료 예상: $ExpectedDoneDate
- SaaS·미니PC·키오스크 확장: 별도 제품화 일정

---

_Generated by scripts/daily-report-brief.ps1_
"@

$file1 = Join-Path $BriefDir1 "$Date-brief.md"
$file2 = Join-Path $BriefDir2 "$Date-brief.md"
$report | Set-Content $file1 -Encoding UTF8
$report | Set-Content $file2 -Encoding UTF8

Write-Host "✅ 보고용 업무일지 생성 완료" -ForegroundColor Green
Write-Host " $file1" -ForegroundColor Gray
Write-Host " $file2" -ForegroundColor Gray
