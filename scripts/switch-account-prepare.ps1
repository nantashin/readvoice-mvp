# =====================================================
# Claude Code 계정 전환 준비 스크립트
# =====================================================

param(
    [string]$NextAccount = "arsenwatson@gmail.com",
    [string]$Message = "계정 전환 전 저장"
)

$ROOT = "C:\Users\tara0\readvoice-mvp"
$DATE = Get-Date -Format "yyyy-MM-dd HH:mm"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Claude Code 계정 전환 준비" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────
# STEP 1: Git 상태 확인
# ─────────────────────────────────────────────────────
Write-Host "📋 STEP 1: Git 상태 확인" -ForegroundColor Yellow
Write-Host ""

cd $ROOT
$gitStatus = git status --porcelain

if ($gitStatus) {
    Write-Host "  ⚠️  변경사항이 있습니다:" -ForegroundColor Yellow
    Write-Host ""
    git status --short
    Write-Host ""

    $commit = Read-Host "  커밋하시겠습니까? (Y/n)"

    if ($commit -ne "n" -and $commit -ne "N") {
        git add .

        $commitMsg = @"
$Message

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
"@

        git commit -m $commitMsg
        Write-Host "  ✅ 커밋 완료" -ForegroundColor Green

        $push = Read-Host "  Push하시겠습니까? (Y/n)"
        if ($push -ne "n" -and $push -ne "N") {
            git push origin master
            Write-Host "  ✅ Push 완료" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  ✅ Git 상태 클린 (변경사항 없음)" -ForegroundColor Green
}

Write-Host ""

# ─────────────────────────────────────────────────────
# STEP 2: Handoff 문서 업데이트
# ─────────────────────────────────────────────────────
Write-Host "📋 STEP 2: Handoff 문서 업데이트" -ForegroundColor Yellow
Write-Host ""

$handoffFile = "$ROOT\docs\handoff\save-state.md"

# 최근 커밋 5개
$recentCommits = git log --oneline -5

# 현재 시각 업데이트
$content = Get-Content $handoffFile -Raw
$content = $content -replace '(?<=## 현재 시각\r?\n)[^\r\n]+', $DATE
$content | Set-Content $handoffFile -NoNewline

Write-Host "  ✅ Handoff 문서 업데이트 완료" -ForegroundColor Green
Write-Host "     파일: $handoffFile" -ForegroundColor Gray
Write-Host ""

# ─────────────────────────────────────────────────────
# STEP 3: 계정 전환 안내
# ─────────────────────────────────────────────────────
Write-Host "📋 STEP 3: 계정 전환 준비 완료" -ForegroundColor Yellow
Write-Host ""

Write-Host "  ✅ 모든 변경사항이 저장되었습니다." -ForegroundColor Green
Write-Host ""
Write-Host "  다음 단계:" -ForegroundColor Cyan
Write-Host "  1. 현재 터미널에서 Ctrl+C로 서버 종료" -ForegroundColor White
Write-Host "  2. 파워셸 창 모두 닫기" -ForegroundColor White
Write-Host "  3. 새 터미널에서 다음 명령어 실행:" -ForegroundColor White
Write-Host ""
Write-Host "     claude logout" -ForegroundColor Yellow
Write-Host "     claude login" -ForegroundColor Yellow
Write-Host "     # → 브라우저에서 $NextAccount 로그인" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. 로그인 후:" -ForegroundColor White
Write-Host "     cd $ROOT" -ForegroundColor Yellow
Write-Host "     git pull origin master" -ForegroundColor Yellow
Write-Host "     claude chat" -ForegroundColor Yellow
Write-Host ""
Write-Host "  5. Claude에게 첫 메시지 (복사용):" -ForegroundColor White
Write-Host ""

$firstMessage = @"
제1계정에서 작업하던 READ VOICE Pro MVP 프로젝트를 이어받았어.

다음 파일들을 확인하고 상황을 파악해줘:
1. docs/handoff/save-state.md (현재 상태)
2. docs/TODO_2026-05-01.md (내일 작업 목록)

상황 파악되면 바로 작업 시작하자.
"@

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host $firstMessage -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

Write-Host "✨ 계정 전환 준비가 완료되었습니다!" -ForegroundColor Green
Write-Host ""
