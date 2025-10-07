
param(
  [string]$RepoDir = "."
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path $RepoDir
Write-Host "Repo:" $repo

function Replace-InFile {
  param([string]$Path, [string]$Pattern, [string]$Replacement)
  if (-not (Test-Path $Path)) { return $false }
  $text = Get-Content -Raw -Path $Path
  $new = [System.Text.RegularExpressions.Regex]::Replace($text, $Pattern, $Replacement, 'IgnoreCase, Multiline')
  if ($new -ne $text) {
    $new | Set-Content -Path $Path -Encoding UTF8
    return $true
  }
  return $false
}

# Write helper files
$svc = Join-Path $repo "src\services"
New-Item -ItemType Directory -Force -Path $svc | Out-Null
@"
// src/services/events.ts
import { supabase } from "./supabase";

export interface EventInput {
  title: string;
  dateISO: string;
  description?: string;
  tags?: string[];
}

export async function createEvent(input: EventInput): Promise<void> {
  const { error } = await supabase.from("events").insert(input as any);
  if (error) throw error;
}

export async function loadEvents(userId: string): Promise<any[]> {
  let query: any = supabase.from("events").select("*");
  // query = query.eq("user_id", userId); // uncomment if applicable
  query = query.order("dateISO", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

"@ | Set-Content -Path (Join-Path $svc "events.ts") -Encoding UTF8
@"
// src/services/claude-adapter.ts
import * as Claude from "./claude";

function resolveClient(): any {
  if (typeof (Claude as any).getClaudeClient === "function") {
    try { return (Claude as any).getClaudeClient(); } catch {}
  }
  if ((Claude as any).client) return (Claude as any).client;
  if ((Claude as any).default) return (Claude as any).default;
  // @ts-ignore
  return (globalThis as any).claudeClient ?? null;
}

export async function chat(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return "";

  const client: any = resolveClient();
  if (!client || !client.messages?.create) return "";

  const res = await client.messages.create({
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const first = (res as any)?.content?.[0];
  const text = (first && typeof first.text === "string" && first.text)
            || (res as any)?.output_text
            || "";
  return text || "";
}

"@ | Set-Content -Path (Join-Path $svc "claude-adapter.ts") -Encoding UTF8

# main.ts: warning -> info
$main = Join-Path $repo "src\main.ts"
Replace-InFile -Path $main -Pattern 'notify\(\s*""?warning""?\s*,' -Replacement 'notify("info",'

# main.ts: ensure import
if (Test-Path $main) {
  $text = Get-Content -Raw -Path $main
  if ($text -notmatch 'from\s+""\.\/services\/events""') {
    $new = $text -replace '(^import[^\n]+\n)', "`$1import { createEvent, loadEvents } from ""./services/events"";`n"
    $new | Set-Content -Path $main -Encoding UTF8
  }
}

# deduplication.ts changes
$dedup = Join-Path $repo "src\services\deduplication.ts"
if (Test-Path $dedup) {
  Replace-InFile -Path $dedup -Pattern 'claude\.chat\s*\(' -Replacement 'chat('
  $txt = Get-Content -Raw -Path $dedup
  if ($txt -notmatch 'from\s+""\.\/claude-adapter""') {
    $new = $txt -replace '(^import[^\n]+\n)', "`$1import { chat } from ""./claude-adapter"";`n"
    $new | Set-Content -Path $dedup -Encoding UTF8
  }
}

# document-import.ts remove unused chat destructure
$docimp = Join-Path $repo "src\services\document-import.ts"
if (Test-Path $docimp) {
  $txt = Get-Content -Raw -Path $docimp
  $new = [System.Text.RegularExpressions.Regex]::Replace($txt, '^\s*const\s*\{\s*chat\s*\}\s*=\s*[^;]+;\s*$', '', 'IgnoreCase, Multiline')
  if ($new -ne $txt) {
    $new | Set-Content -Path $docimp -Encoding UTF8
  }
}

Write-Host "Fixes applied. Next:"
Write-Host "  cd $repo"
Write-Host "  npx tsc --noEmit"
Write-Host "  npm run build"
