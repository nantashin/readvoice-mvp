param([string]$Version = "")

$ROOT = "C:\Users\tara0\readvoice-mvp"
$VERSIONS_DIR = "$ROOT\docs\versions"

if (-not $Version) {
    Write-Host "사용법: .\scripts\version-restore.ps1 -Version v1.2.3"
    Write-Host ""
    Write-Host "사용 가능한 버전:"
    git -C $ROOT tag --sort=-version:refname | Select-Object -First 10
    exit
}

Write-Host "⚠️ $Version 으로 복구합니다..." -ForegroundColor Yellow
$confirm = Read-Host "계속하시겠습니까? (y/n)"
if ($confirm -ne "y") { exit }

# Git으로 복구
git -C $ROOT stash
git -C $ROOT checkout $Version -- .
Write-Host "✅ $Version 복구 완료" -ForegroundColor Green
Write-Host "서버를 재시작해 주세요: npm run dev"
