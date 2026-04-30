# =====================================================
# READ VOICE Pro 업무일지 2종 통합 생성
# 개발용 상세 업무일지 + 보고용 요약 업무일지
# 사용법: .\scripts\generate-daily-logs.ps1
# =====================================================

param(
    [string]$Root = "C:\Users\tara0\readvoice-mvp",
    [string]$ExpectedDoneDate = "2026-05-31",
    [switch]$CommitAndPush
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Set-Location $Root

Write-Host "READ VOICE Pro 업무일지 2종 생성 시작" -ForegroundColor Cyan

$DetailedScript = Join-Path $Root "scripts\daily-report.ps1"
$BriefScript = Join-Path $Root "scripts\daily-report-brief.ps1"

if (-not (Test-Path $DetailedScript)) {
    throw "개발용 상세 보고서 스크립트 없음: $DetailedScript"
}
if (-not (Test-Path $BriefScript)) {
    throw "보고용 요약 보고서 스크립트 없음: $BriefScript"
}

powershell.exe -NoProfile -ExecutionPolicy Bypass -File $DetailedScript
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $BriefScript -Root $Root -ExpectedDoneDate $ExpectedDoneDate

if ($CommitAndPush) {
    git add docs/daily-reports scripts
    git commit -m "chore: 일일 업무일지 자동 생성"
    git push
} else {
    Write-Host "자동 커밋 비활성 상태입니다. 확인 후 수동 커밋을 권장합니다." -ForegroundColor Yellow
}

Write-Host "✅ 업무일지 2종 생성 완료" -ForegroundColor Green
