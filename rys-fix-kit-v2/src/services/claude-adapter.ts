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
