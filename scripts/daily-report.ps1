# READ VOICE Pro - 일일 보고서 생성
# Git 커밋 히스토리 기반 자동 요약

$ROOT = "C:\Users\tara0\readvoice-mvp"
$DATE = Get-Date -Format "yyyy-MM-dd"
$REPORT_DIR = "$ROOT\docs\daily-reports"
$REPORT_FILE = "$REPORT_DIR\$DATE.md"

# 보고서 디렉토리 확인
if (-not (Test-Path $REPORT_DIR)) {
    New-Item -ItemType Directory -Path $REPORT_DIR | Out-Null
}

# roadmap-data.json 읽기 (UTF-8 인코딩)
$roadmapPath = "$ROOT\docs\roadmap-data.json"
$roadmapData = Get-Content $roadmapPath -Encoding UTF8 -Raw | ConvertFrom-Json

# Git 커밋 히스토리 (오늘 것만)
Push-Location $ROOT
$todayCommits = git log --since="midnight" --pretty=format:"%h|%s|%an|%ar" 2>$null
Pop-Location

# 커밋 파싱
$commits = @()
if ($todayCommits) {
    foreach ($line in $todayCommits -split "`n") {
        if ($line) {
            $parts = $line -split "\|"
            $commits += @{
                hash = $parts[0]
                message = $parts[1]
                author = $parts[2]
                time = $parts[3]
            }
        }
    }
}

# 현재 Phase 정보
$currentPhase = $roadmapData.phases | Where-Object { $_.status -eq "current" } | Select-Object -First 1
$currentSprint = $roadmapData.sprints | Where-Object { $_.status -eq "current" } | Select-Object -First 1

# 마크다운 보고서 생성
$report = "# READ VOICE Pro 일일 보고서`n`n"
$report += "**날짜:** $DATE`n"
$report += "**버전:** $($roadmapData.version)`n"
$report += "**진행률:** $($roadmapData.totalProgress)%`n`n"
$report += "---`n`n"

$report += "## 현재 상태`n`n"
$report += "### Phase 진행 현황`n"
$report += "- **현재 Phase:** $($currentPhase.phase) - $($currentPhase.name)`n"
$report += "- **진행률:** $($currentPhase.pct)%`n"
$report += "- **기간:** $($currentPhase.dates)`n"
$report += "- **설명:** $($currentPhase.detail)`n`n"

$report += "### 스프린트 현황`n"
$report += "- **현재 스프린트:** $($currentSprint.sprint)`n"
$report += "- **기간:** $($currentSprint.dates)`n"
$report += "- **진행 중인 작업:**`n"
foreach ($item in $currentSprint.items) {
    $report += "  - $item`n"
}

$report += "`n---`n`n"
$report += "## 오늘의 작업`n`n"

if ($commits.Count -gt 0) {
    $report += "**총 $($commits.Count)개 커밋**`n`n"
    foreach ($commit in $commits) {
        $report += "- [$($commit.hash)] $($commit.message) ($($commit.time))`n"
    }
} else {
    $report += "_커밋 없음_`n"
}

$report += "`n---`n`n"
$report += "## 다음 단계`n`n"

$nextSprint = $roadmapData.sprints | Where-Object { $_.status -eq "todo" } | Select-Object -First 1
if ($nextSprint) {
    $report += "### $($nextSprint.sprint) ($($nextSprint.dates))`n`n"
    foreach ($item in $nextSprint.items) {
        $report += "- [ ] $item`n"
    }
} else {
    $report += "_모든 스프린트 완료_`n"
}

$report += "`n---`n`n"
$report += "## 전체 Phase 진행 상황`n`n"

foreach ($phase in $roadmapData.phases) {
    $statusIcon = switch ($phase.status) {
        "done" { "[완료]" }
        "current" { "[진행중]" }
        "todo" { "[예정]" }
    }
    $report += "- $statusIcon **$($phase.phase):** $($phase.name) ($($phase.pct)%)`n"
}

$report += "`n---`n`n"
$report += "**생성 시각:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
$report += "**예상 완료일:** $($roadmapData.estimatedCompletion)`n"

# 파일 저장
$report | Set-Content $REPORT_FILE -Encoding UTF8

Write-Host "일일 보고서 생성 완료: $REPORT_FILE" -ForegroundColor Green
