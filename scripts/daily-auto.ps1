# READ VOICE Pro - 일일 자동 보고서 생성
# 매일 오후 8시 (20:00) 자동 실행

$ROOT = "C:\Users\tara0\readvoice-mvp"
$DATE = Get-Date -Format "yyyy-MM-dd"
$TIME = Get-Date -Format "HH:mm"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "READ VOICE Pro 일일 자동 보고서" -ForegroundColor Cyan
Write-Host "날짜: $DATE $TIME" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. roadmap-data.json 읽기
Write-Host "[1/3] 로드맵 데이터 읽는 중..." -ForegroundColor Yellow
$roadmapPath = "$ROOT\docs\roadmap-data.json"
if (Test-Path $roadmapPath) {
    $roadmapData = Get-Content $roadmapPath | ConvertFrom-Json
    Write-Host "  버전: $($roadmapData.version)" -ForegroundColor Green
    Write-Host "  진행률: $($roadmapData.totalProgress)%" -ForegroundColor Green
    Write-Host "  마지막 업데이트: $($roadmapData.lastUpdated)" -ForegroundColor Green
} else {
    Write-Host "  경고: roadmap-data.json 없음" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. generate-roadmap.js 실행 → PPTX 생성
Write-Host "[2/3] 로드맵 PPTX 생성 중..." -ForegroundColor Yellow
try {
    Push-Location $ROOT
    $output = node "$ROOT\scripts\generate-roadmap.js" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  $output" -ForegroundColor Green
    } else {
        Write-Host "  오류: PPTX 생성 실패" -ForegroundColor Red
        Write-Host "  $output" -ForegroundColor Red
    }
    Pop-Location
} catch {
    Write-Host "  오류: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 3. daily-report.ps1 실행 → MD 보고서 생성
Write-Host "[3/3] 일일 보고서 MD 생성 중..." -ForegroundColor Yellow
$dailyReportScript = "$ROOT\scripts\daily-report.ps1"
if (Test-Path $dailyReportScript) {
    try {
        & $dailyReportScript
        Write-Host "  일일 보고서 생성 완료" -ForegroundColor Green
    } catch {
        Write-Host "  오류: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  경고: daily-report.ps1 없음 (건너뜀)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "자동 보고서 생성 완료" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "생성된 파일:" -ForegroundColor Cyan
Write-Host "  - docs/daily-reports/roadmap_$((Get-Date -Format 'yyyyMMdd')).pptx" -ForegroundColor White
Write-Host "  - docs/daily-reports/$DATE.md" -ForegroundColor White
Write-Host ""
