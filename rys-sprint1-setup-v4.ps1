Param(
  [string]$Repo = "cwarloe/record-your-story",
  [string]$MilestoneTitle = "Sprint 1 - v1.1",
  [string]$DueOnUtc = "2025-10-19",
  [string]$ProjectName = "Sprint Board"
)

$ErrorActionPreference = "Stop"

# ---------- Locate gh.exe ----------
$Gh = "$env:ProgramFiles\GitHub CLI\gh.exe"
if (-not (Test-Path $Gh)) { $Gh = "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe" }
if (-not (Test-Path $Gh)) { Write-Error "GitHub CLI not found. Install with: winget install GitHub.cli"; exit 1 }

function GhJson([string]$Args) {
  $out = & $Gh @($Args.Split(' ')) 2>$null
  if ([string]::IsNullOrWhiteSpace($out)) { return $null }
  try { return $out | ConvertFrom-Json } catch { return $null }
}

# ---------- Auth check ----------
try { & $Gh auth status | Out-Null } catch { & $Gh auth login }

Write-Host "Using repo: $Repo"

# ---------- Ensure Issues are enabled ----------
try {
  $rv = GhJson "repo view $Repo --json hasIssuesEnabled"
  if (-not $rv -or $rv.hasIssuesEnabled -ne $true) {
    Write-Host "Enabling Issues on $Repo..."
    & $Gh repo edit $Repo --enable-issues | Out-Null
  }
} catch { }

# ---------- Milestone (create or fetch) ----------
$MilestoneNumber = $null
try {
  Write-Host "Creating milestone '$MilestoneTitle' with due_on=$DueOnUtc..."
  & $Gh api "repos/$Repo/milestones" -X POST -f title="$MilestoneTitle" -f state="open" -f due_on="$DueOnUtc" | Out-Null
} catch {
  try { & $Gh api "repos/$Repo/milestones" -X POST -f title="$MilestoneTitle" -f state="open" | Out-Null } catch { }
}
$ms = GhJson "api repos/$Repo/milestones"
if ($ms) {
  $m = $ms | Where-Object { $_.title -eq $MilestoneTitle }
  if ($m) { $MilestoneNumber = $m.number }
}
if ($MilestoneNumber) { Write-Host "OK Milestone: $MilestoneTitle (#$MilestoneNumber)" } else { Write-Warning "Proceeding without a milestone." }

# ---------- Ensure labels exist ----------
$labels = @(
  @{name="story"; color="1d76db"; desc="User story / feature"},
  @{name="frontend"; color="0e8a16"; desc="UI and client-side work"},
  @{name="docs"; color="0075ca"; desc="Documentation changes"},
  @{name="sprint:1"; color="A2EEEF"; desc="Sprint 1 scope"}
)
foreach ($l in $labels) {
  try {
    & $Gh label create $l.name --color $l.color --description $l.desc -R $Repo | Out-Null
  } catch {
    try { & $Gh label edit $l.name --color $l.color --description $l.desc -R $Repo | Out-Null } catch { }
  }
}

# ---------- Issues: ensure two Sprint 1 stories ----------
function Ensure-Issue {
  param([string]$Title,[string]$Body,[string[]]$Labels)

  $labelsCsv = ($Labels -join ",")
  $existing = GhJson "issue list -R $Repo --state open --json number,title"
  $match = $existing | Where-Object { $_.title -eq $Title }
  if (-not $match) {
    $args = @("issue","create","-R",$Repo,"--title",$Title,"--body",$Body,"--label",$labelsCsv)
    if ($MilestoneNumber) { $args += @("--milestone",$MilestoneNumber.ToString()) }
    & $Gh @args | Out-Null
    Start-Sleep -Milliseconds 500
    $existing = GhJson "issue list -R $Repo --state open --json number,title"
    $match = $existing | Where-Object { $_.title -eq $Title }
  }
  if (-not $match) { Write-Error "Failed to create or find issue '$Title'."; exit 1 }
  $editArgs = @("issue","edit","-R",$Repo,$match.number,"--add-label","sprint:1")
  if ($MilestoneNumber) { $editArgs += @("--milestone",$MilestoneNumber.ToString()) }
  & $Gh @editArgs | Out-Null
  return $match.number
}

$TitleTimeline = "Timeline view (vertical with year markers)"
$TitlePrintPdf = "Print/PDF view (clean, paginated)"

$BodyTimeline = @"
Acceptance Criteria (DoD)
- Toggle list/timeline views (icon button)
- Year separators with accessible headings (h2 role)
- Alternating cards on wide screens; stack on mobile
- Persist selected view in localStorage
- Screenshot/GIF in PR
- Update README 'Features' with Timeline view bullet
"@

$BodyPrintPdf = @"
Acceptance Criteria (DoD)
- Dedicated print CSS: clean typography, no nav/chrome
- Page breaks before year headings; avoid orphan lines
- Dark-mode safe
- Tested in Chrome and Firefox print preview
- Include a sample 2-3 page PDF in PR artifacts or /docs
- Update README with a 'Print your timeline' note
"@

$TimelineNum = Ensure-Issue -Title $TitleTimeline -Body $BodyTimeline -Labels @("story","frontend")
$PrintPdfNum = Ensure-Issue -Title $TitlePrintPdf -Body $BodyPrintPdf -Labels @("story","frontend","docs")
Write-Host "OK Issues: #$TimelineNum (Timeline), #$PrintPdfNum (Print/PDF)"

# ---------- Classic project (create or fetch) ----------
$projects = GhJson "api repos/$Repo/projects --paginate"
$proj = $projects | Where-Object { $_.name -eq $ProjectName }
if (-not $proj) {
  $proj = GhJson "api repos/$Repo/projects -X POST -f name=""$ProjectName"""
  foreach ($c in @("Backlog","In Progress","Review","Done")) {
    & $Gh api "/projects/$($proj.id)/columns" -X POST -f name="$c" | Out-Null
  }
}
Write-Host "OK Project: $ProjectName (id=$($proj.id))"

# Column IDs
$colsJson = GhJson "api /projects/$($proj.id)/columns"
$colMap = @{}; foreach ($c in $colsJson) { $colMap[$c.name] = $c.id }
if (-not $colMap.ContainsKey("In Progress")) { Write-Error "Project missing 'In Progress' column."; exit 1 }
$InProgId = $colMap["In Progress"]

function Add-Issue-To-Column {
  param([int]$IssueNumber,[int]$ColumnId,[int]$ProjectId)
  $issue = GhJson "api repos/$Repo/issues/$IssueNumber"
  $issueId = $issue.id
  $cols = GhJson "api /projects/$ProjectId/columns"
  $exists = $false
  foreach ($col in $cols) {
    $cards = GhJson "api /projects/columns/$($col.id)/cards --paginate"
    if ($cards -and ($cards | Where-Object { $_.content_id -eq $issueId })) { $exists = $true; break }
  }
  if (-not $exists) {
    & $Gh api "/projects/columns/$ColumnId/cards" -X POST -f content_id="$issueId" -f content_type="Issue" | Out-Null
    Write-Host "   Added issue #$IssueNumber to 'In Progress'"
  } else {
    Write-Host "   Issue #$IssueNumber already on project"
  }
}

Add-Issue-To-Column -IssueNumber $TimelineNum -ColumnId $InProgId -ProjectId $proj.id
Add-Issue-To-Column -IssueNumber $PrintPdfNum -ColumnId $InProgId -ProjectId $proj.id

Write-Host "DONE Sprint 1 ready."
