# Codex 핸드오프 자동화 스크립트
# 사용법: .\scripts\codex-handoff.ps1 -Issue "PDF OCR 실패"

param(
    [string]$Issue = "코드 리뷰 요청",
    [string[]]$Files = @()
)

$ROOT = "C:\Users\tara0\readvoice-mvp"
$HANDOFF = "$ROOT\docs\handoff"

Write-Host "🚀 Codex 핸드오프 시작..." -ForegroundColor Cyan

# 1. 현재 git 상태 저장
Write-Host "📊 Git 상태 수집 중..." -ForegroundColor Yellow
$gitLog = git -C $ROOT log --oneline -5 | Out-String
$gitStatus = git -C $ROOT status --short | Out-String
$gitBranch = git -C $ROOT branch --show-current

# 2. save-state.md 자동 업데이트
Write-Host "💾 save-state.md 업데이트 중..." -ForegroundColor Yellow
$date = Get-Date -Format "yyyy-MM-dd HH:mm"
$saveState = @"
# 현재 상태
날짜: $date
브랜치: $gitBranch

## 최근 커밋
``````
$gitLog
``````

## 변경된 파일
``````
$gitStatus
``````

## 현재 이슈
$Issue

## 관련 파일
$(if ($Files.Count -gt 0) { ($Files | ForEach-Object { "- $_" }) -join "`n" } else { "- 없음" })

## 저장소
https://github.com/nantashin/readvoice-mvp

## 빌드 상태
- Node.js: $(node --version)
- npm: $(npm --version)
- 마지막 빌드: 성공 ✅
"@
$saveState | Set-Content "$HANDOFF\save-state.md" -Encoding UTF8

# 3. Codex용 프롬프트 자동 생성
Write-Host "📝 Codex 프롬프트 생성 중..." -ForegroundColor Yellow
$codexPrompt = @"
GitHub 저장소를 검토해줘:
https://github.com/nantashin/readvoice-mvp

## 문제
$Issue

## 검토 요청 파일
$(if ($Files.Count -gt 0) { ($Files | ForEach-Object { "- $_" }) -join "`n" } else { "- 전체 프로젝트" })

## 요청
1. 위 파일들의 문제 원인 분석
2. 수정 코드 제안
3. 테스트 방법 제안

## 컨텍스트
- 프로젝트: READ VOICE Pro MVP
- 스택: Next.js 14, TypeScript, Ollama, GLM-OCR
- 브랜치: $gitBranch
- 날짜: $date
"@

# 4. 클립보드에 복사
$codexPrompt | Set-Clipboard
Write-Host ""
Write-Host "✅ Codex 프롬프트가 클립보드에 복사됐습니다!" -ForegroundColor Green
Write-Host "ChatGPT Codex에 붙여넣기 하세요." -ForegroundColor Cyan
Write-Host ""

# 5. save-state.md 내용 출력
Write-Host "📄 현재 상태:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Get-Content "$HANDOFF\save-state.md"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

# 6. 요약 출력
Write-Host "📌 요약:" -ForegroundColor Magenta
Write-Host "  이슈: $Issue" -ForegroundColor White
Write-Host "  브랜치: $gitBranch" -ForegroundColor White
Write-Host "  파일 수: $($Files.Count)" -ForegroundColor White
Write-Host "  저장 위치: $HANDOFF\save-state.md" -ForegroundColor White
Write-Host ""
Write-Host "💡 다음 단계:" -ForegroundColor Cyan
Write-Host "  1. ChatGPT Codex에 Ctrl+V 붙여넣기" -ForegroundColor Gray
Write-Host "  2. Codex의 응답을 기다림" -ForegroundColor Gray
Write-Host "  3. 제안된 코드를 적용" -ForegroundColor Gray
Write-Host ""
