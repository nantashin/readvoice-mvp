# READ VOICE Pro - 근무 시간 기록
# 서버 시작/종료, 업무 시작/마감 시간 입력

$ROOT = "C:\Users\tara0\readvoice-mvp"
$DATE = Get-Date -Format "yyyy-MM-dd"
$WORK_HOURS_DIR = "$ROOT\docs\work-hours"
$WORK_HOURS_FILE = "$WORK_HOURS_DIR\$DATE.json"

# 디렉토리 생성
if (-not (Test-Path $WORK_HOURS_DIR)) {
    New-Item -ItemType Directory -Path $WORK_HOURS_DIR | Out-Null
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "READ VOICE Pro 근무 시간 기록" -ForegroundColor Cyan
Write-Host "날짜: $DATE" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 기존 데이터 확인
$existingData = $null
if (Test-Path $WORK_HOURS_FILE) {
    $existingData = Get-Content $WORK_HOURS_FILE -Encoding UTF8 | ConvertFrom-Json
    Write-Host "기존 기록이 있습니다:" -ForegroundColor Yellow
    Write-Host "  서버 켠 시간: $($existingData.serverStart)" -ForegroundColor White
    Write-Host "  서버 끈 시간: $($existingData.serverEnd)" -ForegroundColor White
    Write-Host "  업무 시작: $($existingData.workStart)" -ForegroundColor White
    Write-Host "  업무 마감: $($existingData.workEnd)" -ForegroundColor White
    Write-Host ""
    $overwrite = Read-Host "덮어쓰시겠습니까? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "취소되었습니다." -ForegroundColor Yellow
        exit
    }
    Write-Host ""
}

# 입력 받기
Write-Host "시간을 입력하세요 (형식: HH:mm, 예: 09:30)" -ForegroundColor Cyan
Write-Host "비워두려면 Enter를 누르세요" -ForegroundColor Yellow
Write-Host ""

$serverStart = Read-Host "서버 켠 시간"
$serverEnd = Read-Host "서버 끈 시간"
$workStart = Read-Host "업무 시작 시간"
$workEnd = Read-Host "업무 마감 시간"

# 현재 시간 기본값
if (-not $serverStart) { $serverStart = "미입력" }
if (-not $serverEnd) { $serverEnd = "미입력" }
if (-not $workStart) { $workStart = "미입력" }
if (-not $workEnd) { $workEnd = "미입력" }

# JSON 저장
$data = @{
    date = $DATE
    serverStart = $serverStart
    serverEnd = $serverEnd
    workStart = $workStart
    workEnd = $workEnd
    recordedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

$data | ConvertTo-Json | Set-Content $WORK_HOURS_FILE -Encoding UTF8

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "근무 시간 기록 완료" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "저장된 내용:" -ForegroundColor Cyan
Write-Host "  서버 켠 시간: $serverStart" -ForegroundColor White
Write-Host "  서버 끈 시간: $serverEnd" -ForegroundColor White
Write-Host "  업무 시작: $workStart" -ForegroundColor White
Write-Host "  업무 마감: $workEnd" -ForegroundColor White
Write-Host ""
Write-Host "저장 위치: $WORK_HOURS_FILE" -ForegroundColor Yellow
Write-Host ""
