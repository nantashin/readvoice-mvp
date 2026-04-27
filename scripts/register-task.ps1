# Windows 작업 스케줄러 등록
# 매일 오후 8시 (20:00)에 daily-auto.ps1 자동 실행

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "READ VOICE Pro 자동 보고서 작업 등록" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = "C:\Users\tara0\readvoice-mvp\scripts\daily-auto.ps1"

# 스크립트 파일 존재 확인
if (-not (Test-Path $scriptPath)) {
    Write-Host "오류: daily-auto.ps1 파일을 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "경로: $scriptPath" -ForegroundColor Red
    exit 1
}

try {
    # 작업 동작 정의
    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""

    # 트리거 정의 (매일 오후 8시)
    $trigger = New-ScheduledTaskTrigger -Daily -At "20:00"

    # 작업 등록
    Register-ScheduledTask `
        -TaskName "ReadVoice_DailyReport" `
        -Action $action `
        -Trigger $trigger `
        -Description "READ VOICE Pro 일일 자동 보고서 생성 (로드맵 PPTX + MD 보고서)" `
        -Force

    Write-Host "작업 등록 완료" -ForegroundColor Green
    Write-Host ""
    Write-Host "설정 내용:" -ForegroundColor Cyan
    Write-Host "  - 작업 이름: ReadVoice_DailyReport" -ForegroundColor White
    Write-Host "  - 실행 시간: 매일 오후 8시 (20:00)" -ForegroundColor White
    Write-Host "  - 실행 스크립트: $scriptPath" -ForegroundColor White
    Write-Host ""
    Write-Host "작업 확인:" -ForegroundColor Cyan
    Write-Host "  작업 스케줄러 열기: taskschd.msc" -ForegroundColor Yellow
    Write-Host "  또는 PowerShell: Get-ScheduledTask -TaskName 'ReadVoice_DailyReport'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "수동 테스트:" -ForegroundColor Cyan
    Write-Host "  Start-ScheduledTask -TaskName 'ReadVoice_DailyReport'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "작업 삭제:" -ForegroundColor Cyan
    Write-Host "  Unregister-ScheduledTask -TaskName 'ReadVoice_DailyReport' -Confirm:`$false" -ForegroundColor Yellow
    Write-Host ""

} catch {
    Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "관리자 권한으로 실행해야 할 수도 있습니다." -ForegroundColor Yellow
    Write-Host "PowerShell을 관리자 권한으로 열고 다시 실행하세요." -ForegroundColor Yellow
    exit 1
}
