param(
    [string]$Version = "",
    [string]$Message = "",
    [string]$Phase = "2"
)

$ROOT = "C:\Users\tara0\readvoice-mvp"
$VERSIONS_DIR = "$ROOT\docs\versions"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm"

# 버전 자동 계산 (없으면)
if (-not $Version) {
    $lastTag = git -C $ROOT describe --tags --abbrev=0 2>$null
    if ($lastTag) {
        $parts = $lastTag.TrimStart("v").Split(".")
        $Version = "v$($parts[0]).$($parts[1]).$([int]$parts[2]+1)"
    } else {
        $Version = "v1.0.0"
    }
}

Write-Host "버전 저장: $Version" -ForegroundColor Cyan

# 1. Git 태그 생성
git -C $ROOT add .
git -C $ROOT commit -m "chore: $Version - $Message" 2>$null
git -C $ROOT tag -a $Version -m "$Message"
git -C $ROOT push 2>$null
git -C $ROOT push --tags 2>$null

# 2. 버전 스냅샷 폴더 생성
$snapDir = "$VERSIONS_DIR\$Version"
New-Item -ItemType Directory -Force $snapDir | Out-Null

# 3. 핵심 파일 스냅샷 저장
$filesToSave = @(
    "app\page.tsx",
    "app\components\FileUpload.tsx",
    "app\components\MicButton.tsx",
    "app\api\ocr\route.ts",
    "modules\ocr\gemini.ts",
    "modules\ocr\pdf.ts",
    "modules\ocr\ocr-engine.ts",
    "lib\audio\bgm-manager.ts",
    "lib\speech\stt.ts",
    "server\glm-ocr.py",
    "server\pdf-to-image.py",
    "CLAUDE.md"
)

foreach ($file in $filesToSave) {
    $src = "$ROOT\$file"
    if (Test-Path $src) {
        $dst = "$snapDir\$($file.Replace('\','_'))"
        Copy-Item $src $dst
    }
}

# 4. 버전 메타데이터 저장
$meta = @{
    version = $Version
    date = $DATE
    phase = "Phase $Phase"
    message = $Message
    gitTag = $Version
    files = $filesToSave
} | ConvertTo-Json -Depth 3

$meta | Set-Content "$snapDir\version-meta.json" -Encoding UTF8

# 5. 버전 히스토리 MD 업데이트
$historyFile = "$VERSIONS_DIR\VERSION_HISTORY.md"
if (-not (Test-Path $historyFile)) {
    "# READ VOICE Pro 버전 히스토리`n" | Set-Content $historyFile -Encoding UTF8
}

$entry = @"

## $Version ($DATE)
**Phase:** Phase $Phase
**내용:** $Message
**스냅샷:** docs/versions/$Version/

"@

Add-Content $historyFile $entry -Encoding UTF8

Write-Host "✅ 버전 저장 완료: $Version" -ForegroundColor Green
Write-Host "📁 스냅샷: $snapDir" -ForegroundColor Cyan
Write-Host "📋 히스토리: $historyFile" -ForegroundColor Cyan
