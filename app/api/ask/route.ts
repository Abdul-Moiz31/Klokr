import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { createAdminClient } from "@/lib/supabase-admin";
import { decryptSecret } from "@/lib/crypto";
import { getQuotaStatus, incrementUsage } from "@/lib/ai-quota";

const ANTHROPIC_MODEL   = "claude-opus-4-8";
const OPENAI_MODEL      = "gpt-4o-mini";
const GEMINI_MODEL      = "gemini-1.5-flash";
const OPENROUTER_MODEL  = "openai/gpt-4o-mini";

const LOOKBACK_DAYS   = 30;
const MAX_QUESTION_LEN = 500;

type Provider = "anthropic" | "openai" | "gemini" | "openrouter";
type Row = { domain: string; duration_seconds: number; date: string; visits: number | null };

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function localDateStr(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function buildDataSummary(rows: Row[]): string {
  if (rows.length === 0) return "The user has no tracked browsing data in this period.";

  const byDomain = new Map<string, { seconds: number; visits: number; days: Set<string> }>();
  const byDate   = new Map<string, number>();
  for (const r of rows) {
    const d = byDomain.get(r.domain) ?? { seconds: 0, visits: 0, days: new Set<string>() };
    d.seconds += r.duration_seconds;
    d.visits  += r.visits ?? 1;
    d.days.add(r.date);
    byDomain.set(r.domain, d);
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.duration_seconds);
  }

  const totalSeconds = rows.reduce((s, r) => s + r.duration_seconds, 0);
  const activeDays   = byDate.size;

  const topDomains = [...byDomain.entries()]
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, 40)
    .map(([domain, v]) => `${domain}: ${fmtDuration(v.seconds)} across ${v.days.size} day(s), ${v.visits} visits`)
    .join("\n");

  const dailyTotals = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, secs]) => `${date}: ${fmtDuration(secs)}`)
    .join("\n");

  return [
    `Period: last ${LOOKBACK_DAYS} days. Active days: ${activeDays}. Total tracked: ${fmtDuration(totalSeconds)}.`,
    ``,
    `Top domains by time:`,
    topDomains,
    ``,
    `Daily totals (most recent first):`,
    dailyTotals,
  ].join("\n");
}

const SYSTEM_INSTRUCTIONS =
  "You are Klokrs' time-insights assistant. You answer questions about the user's own browser time-tracking data, provided below. " +
  "Rules: Answer ONLY from the provided data. Be concise — 1–3 sentences with specific numbers where relevant. " +
  "If the data doesn't contain the answer, say so plainly. Never invent figures. " +
  "Domains are the only browsing detail recorded — no URLs, page titles, or keystrokes. Speak in second person ('you spent…').";

// ── Provider routing ────────────────────────────────────────────────────────

async function askAnthropic(apiKey: string, summary: string, question: string): Promise<string> {
  const client   = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: [
      { type: "text", text: SYSTEM_INSTRUCTIONS },
      { type: "text", text: `User's tracked data:\n\n${summary}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: question }],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function askOpenAI(apiKey: string, summary: string, question: string): Promise<string> {
  const client   = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: `${SYSTEM_INSTRUCTIONS}\n\nUser's tracked data:\n\n${summary}` },
      { role: "user",   content: question },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

async function askOpenRouter(apiKey: string, summary: string, question: string): Promise<string> {
  const client   = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  const response = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: `${SYSTEM_INSTRUCTIONS}\n\nUser's tracked data:\n\n${summary}` },
      { role: "user",   content: question },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

async function askGemini(apiKey: string, summary: string, question: string): Promise<string> {
  const genAI  = new GoogleGenerativeAI(apiKey);
  const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(
    `${SYSTEM_INSTRUCTIONS}\n\nUser's tracked data:\n\n${summary}\n\nQuestion: ${question}`
  );
  return result.response.text().trim();
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth_token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth_token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createSupabaseForUserJwt(auth_token);
    const { data: { user }, error: authError } = await supabase.auth.getUser(auth_token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { question?: string };
    try { body = (await request.json()) as { question?: string }; }
    catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

    const question = (body.question ?? "").trim();
    if (!question) return NextResponse.json({ error: "Missing question" }, { status: 400 });
    if (question.length > MAX_QUESTION_LEN) {
      return NextResponse.json({ error: "Question too long" }, { status: 400 });
    }

    // Resolve BYOK key — fallback to server Anthropic key for unregistered users.
    const { data: keyRow } = await supabase
      .from("ai_keys")
      .select("encrypted_key, provider")
      .eq("user_id", user.id)
      .maybeSingle();

    const ownKey    = keyRow?.encrypted_key ? decryptSecret(keyRow.encrypted_key as string) : null;
    const provider  = (keyRow?.provider as Provider | undefined) ?? "anthropic";
    const hasOwnKey = Boolean(ownKey);

    // Fall back to server Anthropic key only when no BYOK is set and provider would be anthropic.
    const apiKey = ownKey ?? (provider === "anthropic" ? (process.env.ANTHROPIC_API_KEY ?? null) : null);
    if (!apiKey) {
      return NextResponse.json(
        { error: "No AI key configured. Add your own API key in Settings to use this feature." },
        { status: 503 }
      );
    }

    const quota = await getQuotaStatus(supabase, user.id, hasOwnKey);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `You've used all ${quota.limit} AI questions on your ${quota.plan} plan this month. Upgrade, or add your own API key for unlimited use.`,
          quota,
        },
        { status: 429 }
      );
    }

    const from = new Date();
    from.setDate(from.getDate() - LOOKBACK_DAYS);
    const { data, error } = await supabase
      .from("tab_sessions")
      .select("domain, duration_seconds, date, visits")
      .eq("user_id", user.id)
      .gte("date", localDateStr(from))
      .order("date", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const summary = buildDataSummary((data as Row[]) ?? []);

    // Route to the correct provider.
    let answer = "";
    if (provider === "openai") {
      answer = await askOpenAI(apiKey, summary, question);
    } else if (provider === "openrouter") {
      answer = await askOpenRouter(apiKey, summary, question);
    } else if (provider === "gemini") {
      answer = await askGemini(apiKey, summary, question);
    } else {
      answer = await askAnthropic(apiKey, summary, question);
    }

    if (!hasOwnKey) {
      try { await incrementUsage(createAdminClient(), user.id); } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      answer: answer || "I couldn't find an answer in your data.",
      provider,
      quota: hasOwnKey ? null : { ...quota, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1) },
    });
  } catch (err) {
    console.error("[ask]", err);
    return NextResponse.json({ error: "AI service error. Please try again." }, { status: 502 });
  }
}
