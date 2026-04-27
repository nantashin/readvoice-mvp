param(
    [string]$Version = "",
    [string]$Message = "",
    [string]$Phase = "2"
)

$ROOT = "C:\Users\tara0\readvoice-mvp"
$VERSIONS_DIR = "$ROOT\docs\versions"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm"

# 버전 자동 계산
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

# 버전 스냅샷 폴더 생성
$snapDir = "$VERSIONS_DIR\$Version"
New-Item -ItemType Directory -Force $snapDir | Out-Null

# 핵심 파일 스냅샷 저장
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

# 버전 메타데이터 저장
$metaContent = @"
{
  "version": "$Version",
  "date": "$DATE",
  "phase": "Phase $Phase",
  "message": "$Message",
  "gitTag": "$Version"
}
"@

$metaContent | Set-Content "$snapDir\version-meta.json" -Encoding UTF8

# 버전 히스토리 MD 업데이트
$historyFile = "$VERSIONS_DIR\VERSION_HISTORY.md"

$entry = @"

## $Version ($DATE)
**Phase:** Phase $Phase
**내용:** $Message
**스냅샷:** docs/versions/$Version/

"@

Add-Content $historyFile $entry -Encoding UTF8

Write-Host "버전 저장 완료: $Version" -ForegroundColor Green
Write-Host "스냅샷: $snapDir" -ForegroundColor Cyan
Write-Host "히스토리: $historyFile" -ForegroundColor Cyan

# 로드맵 자동 생성
Write-Host "로드맵 자동 생성 중..." -ForegroundColor Cyan
node "$ROOT\scripts\generate-roadmap.js"

# roadmap-data.json의 version 업데이트
$roadmapDataPath = "$ROOT\docs\roadmap-data.json"
$roadmapData = Get-Content $roadmapDataPath | ConvertFrom-Json
$roadmapData.version = $Version
$roadmapData.lastUpdated = (Get-Date -Format "yyyy-MM-dd")
$roadmapData | ConvertTo-Json -Depth 5 | Set-Content $roadmapDataPath -Encoding UTF8

Write-Host "로드맵 업데이트 완료" -ForegroundColor Green
