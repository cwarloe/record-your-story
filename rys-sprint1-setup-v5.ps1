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
  $out = & $Gh @($Args.Split(' ')) 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "gh $Args failed:`n$out"
    return $null
  }
  if ([string]::IsNullOrWhiteSpace($out)) { return $null }
  try { return $out | ConvertFrom-Json } catch { return $null }
}

# ---------- Auth check ----------
try { & $Gh auth status | Out-Null } catch {
  Write-Host "Logging into GitHub CLI..."
  & $Gh auth login
}

Write-Host "Using repo: $Repo"

# ---------- Ensure Issues are enabled ----------
$rv = GhJson "repo view $Repo --json hasIssuesEnabled"
if (-not $rv -or $rv.hasIssuesEnabled -ne $true) {
  Write-Host "Enabling Issues on $Repo..."
  $tmp = & $Gh repo edit $Repo --enable-issues 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Warning "Enable issues failed: $tmp" }
}

# ---------- Milestone (attempt; continue if fails) ----------
$MilestoneNumber = $null
Write-Host "Attempting milestone '$MilestoneTitle'..."
$tmp = & $Gh api "repos/$Repo/milestones" -X POST -f title="$MilestoneTitle" -f state="open" -f due_on="$DueOnUtc" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Warning "Create with due_on failed: $tmp"
  $tmp2 = & $Gh api "repos/$Repo/milestones" -X POST -f title="$MilestoneTitle" -f state="open" 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Warning "Create without due_on failed: $tmp2" }
}
$ms = GhJson "api repos/$Repo/milestones"
if ($ms) {
  $m = $ms | Where-Object { $_.title -eq $MilestoneTitle }
  if ($m) { $MilestoneNumber = $m.number }
}
if ($MilestoneNumber) { Write-Host "OK Milestone: $MilestoneTitle (#$MilestoneNumber)" } else { Write-Warning "Proceeding without a milestone." }

# ---------- Ensure labels ----------
$labels = @(
  @{name="story"; color="1d76db"; desc="User story / feature"},
  @{name="frontend"; color="0e8a16"; desc="UI and client-side work"},
  @{name="docs"; color="0075ca"; desc="Documentation changes"},
  @{name="sprint:1"; color="A2EEEF"; desc="Sprint 1 scope"}
)
foreach ($l in $labels) {
  $tmp = & $Gh label create $l.name --color $l.color --description $l.desc -R $Repo 2>&1
  if ($LASTEXITCODE -ne 0) {
    $tmp2 = & $Gh label edit $l.name --color $l.color --description $l.desc -R $Repo 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Warning "Label $($l.name) create/edit failed: $tmp; $tmp2" }
  }
}

# ---------- Issue creation helper with fallbacks ----------
function Ensure-Issue {
  param([string]$Title,[string]$Body,[string[]]$Labels)

  $labelsCsv = ($Labels -join ",")
  # 1) Check if already exists
  $existing = GhJson "issue list -R $Repo --state open --json number,title"
  $match = $existing | Where-Object { $_.title -eq $Title }
  if ($match) { return $match.number }

  # 2) Try full create (body+labels+milestone)
  $args = @("issue","create","-R",$Repo,"--title",$Title,"--body",$Body,"--label",$labelsCsv)
  if ($MilestoneNumber) { $args += @("--milestone",$MilestoneNumber.ToString()) }
  $out = & $Gh @args 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Warning "Full issue create failed: $out" }

  Start-Sleep -Milliseconds 500
  $existing = GhJson "issue list -R $Repo --state open --json number,title"
  $match = $existing | Where-Object { $_.title -eq $Title }
  if ($match) { 
    $editArgs = @("issue","edit","-R",$Repo,$match.number,"--add-label","sprint:1")
    if ($MilestoneNumber) { $editArgs += @("--milestone",$MilestoneNumber.ToString()) }
    & $Gh @editArgs | Out-Null
    return $match.number
  }

  # 3) Try minimal create (title only)
  $out2 = & $Gh issue create -R $Repo --title $Title 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Warning "Minimal issue create failed: $out2" }

  Start-Sleep -Milliseconds 500
  $existing = GhJson "issue list -R $Repo --state open --json number,title"
  $match = $existing | Where-Object { $_.title -eq $Title }
  if ($match) {
    $editArgs2 = @("issue","edit","-R",$Repo,$match.number)
    if ($MilestoneNumber) { $editArgs2 += @("--milestone",$MilestoneNumber.ToString()) }
    # Add labels individually so failure of one doesn't block
    foreach ($lab in $Labels + @("sprint:1")) {
      & $Gh issue edit -R $Repo $match.number --add-label $lab 2>$null
    }
    # Add body as a comment (works even if --body had quoting issues)
    & $Gh issue comment -R $Repo $match.number -b $Body 2>$null
    return $match.number
  }

  Write-Error "Failed to create or find issue '$Title'. Last errors:`n$out`n$out2"
  exit 1
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

# ---------- Classic project ----------
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
  $issueId = if ($issue) { $issue.id } else { $null }
  if (-not $issueId) { Write-Warning "Cannot add #$IssueNumber to project; missing REST id."; return }
  $cols = GhJson "api /projects/$ProjectId/columns"
  $exists = $false
  foreach ($col in $cols) {
    $cards = GhJson "api /projects/columns/$($col.id)/cards --paginate"
    if ($cards -and ($cards | Where-Object { $_.content_id -eq $issueId })) { $exists = $true; break }
  }
  if (-not $exists) {
    $tmp = & $Gh api "/projects/columns/$ColumnId/cards" -X POST -f content_id="$issueId" -f content_type="Issue" 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Warning "Add card failed: $tmp" } else { Write-Host "   Added issue #$IssueNumber to 'In Progress'" }
  } else {
    Write-Host "   Issue #$IssueNumber already on project"
  }
}

Add-Issue-To-Column -IssueNumber $TimelineNum -ColumnId $InProgId -ProjectId $proj.id
Add-Issue-To-Column -IssueNumber $PrintPdfNum -ColumnId $InProgId -ProjectId $proj.id

Write-Host "DONE Sprint 1 ready."
