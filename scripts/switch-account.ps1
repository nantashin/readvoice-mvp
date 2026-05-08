param([string]$To = "")

$ROOT = "C:\Users\tara0\readvoice-mvp"
$ACCOUNTS = @{
  "1" = "shinnanta88@gmail.com"
  "2" = "arsenwatson@gmail.com"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  READ VOICE Pro 계정 전환" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1번: shinnanta88@gmail.com (제1계정)"
Write-Host "2번: arsenwatson@gmail.com (제2계정)"
Write-Host ""

if (-not $To) { $To = Read-Host "전환할 계정 번호 입력 (1 또는 2)" }

if (-not $ACCOUNTS.ContainsKey($To)) {
  Write-Host "잘못된 번호입니다." -ForegroundColor Red
  exit 1
}

$targetAccount = $ACCOUNTS[$To]
Write-Host ""
Write-Host "→ $targetAccount 으로 전환합니다." -ForegroundColor Yellow
Write-Host ""

# 1. Git 저장
Write-Host "1/4 Git 저장 중..." -ForegroundColor Yellow
Set-Location $ROOT
$status = git -C $ROOT status --short
if ($status) {
  $date = Get-Date -Format "yyyy-MM-dd HH:mm"
  git -C $ROOT add .
  git -C $ROOT commit -m "chore: 계정 전환 전 자동 저장 ($date)"
  git -C $ROOT push
  Write-Host "   ✅ Git 저장 완료" -ForegroundColor Green
} else {
  Write-Host "   ✅ 변경사항 없음 (저장 불필요)" -ForegroundColor Green
}

# 2. save-state.md 업데이트
Write-Host "2/4 인계 문서 업데이트 중..." -ForegroundColor Yellow
$date = Get-Date -Format "yyyy-MM-dd HH:mm"
$gitLog = git -C $ROOT log --oneline -3 | Out-String
New-Item -ItemType Directory -Force "$ROOT\docs\handoff" | Out-Null
$content = "# 작업 인계`n날짜: $date`n전환: 계정 $To ($targetAccount)`n`n## 최근 커밋`n$gitLog`n## 이어서 할 일`n- [ ] 다음 작업을 여기에 적어주세요`n`n## 저장소`nhttps://github.com/nantashin/readvoice-mvp"
$content | Set-Content "$ROOT\docs\handoff\save-state.md" -Encoding UTF8
git -C $ROOT add docs/handoff/save-state.md
git -C $ROOT commit -m "docs: 계정 전환 인계 문서"
git -C $ROOT push
Write-Host "   ✅ 인계 문서 저장 완료" -ForegroundColor Green

# 3. Claude Code 종료 안내
Write-Host "3/4 Claude Code 종료 필요" -ForegroundColor Yellow
Write-Host ""
Write-Host "   ★ 지금 Claude Code 창에서 /exit 입력하세요" -ForegroundColor Magenta
Write-Host "   입력 후 Enter를 누르면 계속 진행합니다..."
Read-Host

# 4. 계정 전환
Write-Host "4/4 계정 전환 중..." -ForegroundColor Yellow
claude auth logout 2>$null
Write-Host ""
Write-Host "   브라우저에서 $targetAccount 으로 로그인하세요" -ForegroundColor Cyan
claude auth login

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ 전환 완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:"
Write-Host "  cd $ROOT"
Write-Host "  claude"
Write-Host ""
Write-Host "Claude Code 시작 후 입력:"
Write-Host "  docs/handoff/save-state.md 읽고 이어서 진행해줘"
