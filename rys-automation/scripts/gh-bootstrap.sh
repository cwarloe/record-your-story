#!/usr/bin/env bash
set -euo pipefail

# ===== CONFIG =====
# Set these before running or pass via env (e.g. REPO="cwarloe/record-your-story")
REPO="${REPO:-cwarloe/record-your-story}"

# Milestones
M1="v1.1"
M2="v2.0"

# Labels (name:color:description)
LABELS=(
  "epic:5319e7:Large cross-cutting body of work"
  "story:1d76db:User story / feature"
  "bug:d73a4a:Something isn’t working"
  "frontend:0e8a16:UI and client-side work"
  "backend:5319e7:APIs, DB, infrastructure"
  "docs:0075ca:Documentation changes"
  "good-first-issue:7057ff:Good for new contributors"
)

# Issues to seed (title|body|milestone|labels (comma-separated))
read -r -d '' ISSUE_1 << 'EOF'
Timeline view (vertical with year markers)|
As a user, I can switch to a vertical timeline with year markers so I can quickly scan my life events visually.

**DoD**
- Toggle between list/timeline
- Year separators and accessible headings
- Keyboard accessible, persists view mode
- Screenshot attached to the issue after implementation
|v1.1|story,frontend
EOF

read -r -d '' ISSUE_2 << 'EOF'
Print/PDF view (clean, paginated)|
As a user, I can print a clean, paginated PDF of my timeline.

**DoD**
- Print CSS with sensible page breaks
- Dark-mode safe
- Header/footer suppressed in print
- Tested in Chrome/Firefox
|v1.1|story,frontend,docs
EOF

read -r -d '' ISSUE_3 << 'EOF'
Provision Supabase project (auth + storage)|
As a maintainer, I can provision Supabase with the provided schema so cloud sync/auth can be enabled behind env flags.

**DoD**
- Supabase project created
- schema.sql applied
- .env with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (not committed)
- Basic email/password sign-in tested
|v2.0|story,backend,docs
EOF

read -r -d '' ISSUE_4 << 'EOF'
Add StorageProvider abstraction (Local vs Cloud)|
As a user, I can choose Local-only or Cloud Sync in Settings. App should work fully offline when Local is selected.

**DoD**
- StorageProvider interface
- Local implementation (existing)
- Supabase implementation (behind env)
- No breaking change to import/export
|v2.0|story,frontend,backend
EOF

ISSUES=( "$ISSUE_1" "$ISSUE_2" "$ISSUE_3" "$ISSUE_4" )

# ===== PRECHECKS =====
command -v gh >/dev/null || { echo "❌ GitHub CLI (gh) not found. Install from https://cli.github.com/"; exit 1; }
gh auth status >/dev/null || { echo "❌ Not authenticated. Run 'gh auth login' first."; exit 1; }

echo "✅ Using repo: $REPO"

# ===== LABELS =====
echo "→ Creating labels (idempotent)..."
for row in "${LABELS[@]}"; do
  NAME="${row%%:*}"
  REST="${row#*:}"
  COLOR="${REST%%:*}"
  DESC="${REST#*:}"
  gh label create "$NAME" --color "$COLOR" --description "$DESC" --repo "$REPO" 2>/dev/null ||     gh label edit "$NAME" --color "$COLOR" --description "$DESC" --repo "$REPO"
done

# ===== MILESTONES =====
echo "→ Ensuring milestones exist..."
for M in "$M1" "$M2"; do
  gh api --silent repos/:owner/:repo/milestones     --method POST     -F title="$M"     -F state="open"     --repo "$REPO" 2>/dev/null || true
done

# ===== ISSUES =====
echo "→ Seeding issues..."
for item in "${ISSUES[@]}"; do
  TITLE="${item%%|*}"
  REST="${item#*|}"
  BODY="${REST%%|*}"
  REST2="${REST#*|}"
  M="${REST2%%|*}"
  LABELS_CSV="${REST2#*|}"

  gh issue create     --title "$TITLE"     --body "$BODY"     --label "$LABELS_CSV"     --milestone "$M"     --repo "$REPO" >/dev/null

  echo "   • $TITLE"
done

# ===== PROJECT (Classic Kanban) =====
echo "→ Creating (or finding) a classic Kanban project..."
PROJECT_NAME="Sprint Board"
PROJECT_ID="$(gh api repos/:owner/:repo/projects --paginate --jq '.[] | select(.name=="'"$PROJECT_NAME"'") | .id' --repo "$REPO" 2>/dev/null | head -n1)"
if [[ -z "${PROJECT_ID:-}" ]]; then
  PROJECT_ID="$(gh api repos/:owner/:repo/projects --method POST -f name="$PROJECT_NAME" --jq '.id' --repo "$REPO")"
  # Create default columns
  for COL in "Backlog" "In Progress" "Review" "Done"; do
    gh api /projects/$PROJECT_ID/columns --method POST -f name="$COL" >/dev/null
  done
fi
echo "   • Project: $PROJECT_NAME (id=$PROJECT_ID)"

echo "✅ Bootstrap complete."
