Param(
  [string]$RepoDir = ".",
  [string]$ReleaseTitle = "Sprint 1 - v1.1",
  [string]$Version = "1.1.0",
  [string]$BaseBranch = ""
)

$ErrorActionPreference = "Stop"

# Tools
$Gh = "$env:ProgramFiles\GitHub CLI\gh.exe"
if (-not (Test-Path $Gh)) { $Gh = "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe" }
if (-not (Test-Path $Gh)) { Write-Error "GitHub CLI not found."; exit 1 }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Error "git not found in PATH."; exit 1 }

Set-Location $RepoDir

# Determine base branch
if ([string]::IsNullOrWhiteSpace($BaseBranch)) {
  try {
    $head = git symbolic-ref --short refs/remotes/origin/HEAD 2>$null
    if ($head) { $BaseBranch = $head.Trim().Split('/')[-1] }
  } catch { }
  if ([string]::IsNullOrWhiteSpace($BaseBranch)) {
    if ((git show-ref --verify --quiet refs/heads/main) -or (git ls-remote --heads origin main)) { $BaseBranch = "main" }
    elseif ((git show-ref --verify --quiet refs/heads/master) -or (git ls-remote --heads origin master)) { $BaseBranch = "master" }
    else { $BaseBranch = "main" }
  }
}
Write-Host "Base branch: $BaseBranch"

# Create release branch
$RelBranch = "release/v$Version"
git fetch origin | Out-Null
git checkout -B $RelBranch origin/$BaseBranch 2>$null | Out-Null

# Prepare CHANGELOG.md
$today = (Get-Date).ToString("yyyy-MM-dd")
$clPath = "CHANGELOG.md"
if (-not (Test-Path $clPath)) {
  @"
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

"@ | Out-File $clPath -Encoding UTF8
}

# Insert a release section if not present
$cl = Get-Content $clPath -Raw
$needle = "## [$Version]"
if ($cl -notmatch [regex]::Escape($needle)) {
  $releaseNotes = @"
## [$Version] - $today

### Added
- Timeline view (vertical with year markers)
- Print/PDF view (clean, paginated)

"@
  $newContent = $cl -replace "## \[Unreleased\]\s*","## [Unreleased]`r`n`r`n$releaseNotes"
  if ($newContent -eq $cl) { $newContent = $releaseNotes + $cl }
  $newContent | Out-File $clPath -Encoding UTF8
}

# Commit and push
git add CHANGELOG.md
git commit -m "chore(release): prepare $ReleaseTitle ($Version)" | Out-Null
git push -u origin $RelBranch

# Create PR (avoid backticks in body)
$prTitle = "Release $ReleaseTitle ($Version)"
$prBody = @"
This PR prepares the release for **$ReleaseTitle ($Version)**.

- Updates CHANGELOG.md with date and highlights
- Targets base branch $BaseBranch
"@

& $Gh pr create -t $prTitle -b $prBody -B $BaseBranch -H $RelBranch
