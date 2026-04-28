# =====================================================
# READ VOICE Pro - Claude Code 계정 전환 스크립트
# 저장 위치: C:\Users\tara0\readvoice-mvp\scripts\switch-account.ps1
# 사용법: .\scripts\switch-account.ps1
# =====================================================

$ACCOUNT_1 = "shinnanta88@gmail.com"
$ACCOUNT_2 = "arsenwatson@gmail.com"
$PROJECT   = "C:\Users\tara0\readvoice-mvp"

Clear-Host
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Claude Code 계정 전환 도우미" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# STEP 1: 계정 선택
Write-Host " 어떤 계정으로 전환할까요?" -ForegroundColor White
Write-Host ""
Write-Host "   1.  $ACCOUNT_1" -ForegroundColor Green
Write-Host "   2.  $ACCOUNT_2" -ForegroundColor Green
Write-Host ""

do {
    $choice = Read-Host "  번호 입력 (1 또는 2)"
} while ($choice -ne "1" -and $choice -ne "2")

if ($choice -eq "1") { $TargetAccount = $ACCOUNT_1 }
else                  { $TargetAccount = $ACCOUNT_2 }

Write-Host ""
Write-Host "  -> [$TargetAccount] 으로 전환합니다." -ForegroundColor Yellow

# STEP 2: Claude Code 종료 확인
Write-Host ""
Write-Host "============================================" -ForegroundColor Red
Write-Host "  !! Claude Code가 열려있다면 지금 종료하세요" -ForegroundColor Red
Write-Host "     Claude Code 창에서  /exit  입력 후 Enter" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Red
Write-Host ""

do {
    $exitDone = Read-Host "  Claude Code 종료했나요? (y/n)"
} while ($exitDone -ne "y")

# STEP 3: Git 자동 커밋
Write-Host ""
Write-Host "  Git 상태 확인 중..." -ForegroundColor Yellow

$gitStatus = git -C $PROJECT status --porcelain 2>$null

if ($gitStatus) {
    Write-Host ""
    Write-Host "  저장되지 않은 변경사항이 있어요." -ForegroundColor Yellow
    $autoCommit = Read-Host "  지금 자동 커밋할까요? (y/n)"
    if ($autoCommit -eq "y") {
        git -C $PROJECT add .
        $commitMsg = "wip: 계정 전환 전 자동 저장 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        git -C $PROJECT commit -m $commitMsg
        git -C $PROJECT push
        Write-Host "  [OK] 커밋 & 푸시 완료!" -ForegroundColor Green
    } else {
        Write-Host "  변경사항 저장 안 함. 계속 진행합니다." -ForegroundColor Yellow
    }
} else {
    Write-Host "  [OK] 저장할 변경사항 없음." -ForegroundColor Green
}

# STEP 4: 로그아웃
Write-Host ""
Write-Host "  로그아웃 중..." -ForegroundColor Yellow
claude logout 2>$null
Start-Sleep -Seconds 2
Write-Host "  [OK] 로그아웃 완료." -ForegroundColor Green

# STEP 5: 새 계정으로 로그인
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  브라우저에서 아래 계정으로 로그인하세요" -ForegroundColor Green
Write-Host "  >> $TargetAccount" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

claude login

# STEP 6: 프로젝트로 자동 이동
Write-Host ""
Write-Host "  [OK] 로그인 완료!" -ForegroundColor Green
Start-Sleep -Seconds 1

Set-Location $PROJECT

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  계정 전환 완료!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  현재 계정 : $TargetAccount" -ForegroundColor Green
Write-Host "  현재 폴더 : $PROJECT" -ForegroundColor Green
Write-Host ""
Write-Host "  이제 아래 명령어를 입력하세요:" -ForegroundColor White
Write-Host ""
Write-Host "      claude" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Claude Code가 CLAUDE.md를 자동으로 읽고" -ForegroundColor Gray
Write-Host "  이전 작업을 이어서 진행합니다." -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
