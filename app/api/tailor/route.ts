import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { GoogleGenAI, ApiError } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
// Simple rate limiter for tailoring endpoint
const TAILOR_RATE_WINDOW_MS = 60_000;
const TAILOR_RATE_MAX = 20;
const tailorRate = new Map<string, { count: number; resetAt: number }>();

type Body = {
  jd?: string;
  apiKey?: string;
  baseTex?: string;
  model?: string;
};

export async function POST(req: Request) {
  try {
    const { jd, apiKey, baseTex, model: requestedModel }: Body = await req.json();
    // basic rate limiting per IP
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const ent = tailorRate.get(ip) || { count: 0, resetAt: now + TAILOR_RATE_WINDOW_MS };
    if (now > ent.resetAt) {
      ent.count = 0;
      ent.resetAt = now + TAILOR_RATE_WINDOW_MS;
    }
    ent.count++;
    tailorRate.set(ip, ent);
    if (ent.count > TAILOR_RATE_MAX) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    if (!jd || jd.trim().length < 16) {
      return NextResponse.json({ error: "JD is required and should be at least 16 characters" }, { status: 400 });
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY (set env or pass apiKey)" }, { status: 400 });
    }

    let base = baseTex;
    if (!base) {
      const filePath = path.join(process.cwd(), "public", "base.tex");
      base = await fs.readFile(filePath, "utf8");
    }

    const prompt = buildPrompt(base!, jd);
    const ai = new GoogleGenAI({ apiKey: key });
    // Only allow valid Gemini text models
    const validModels = [
      requestedModel,
      process.env.GEMINI_MODEL,
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-pro-latest",
      "gemini-1.5-pro",
      "gemini-1.5-flash-8b",
      "gemini-pro",
      "gemini-1.0-pro",
      "gemini-1.0-pro-latest",
      "gemini-2.0-flash-001",
      "gemini-2.0-pro-001"
    ].filter((m): m is string => typeof m === "string" && !!m && !m.includes("embedding") && !m.includes("gecko"));

    let tex = "";
    let lastErr: unknown;
    // Retry logic for rate limits
    async function generateWithRetry(model: string, maxRetries = 3) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const resp = await ai.models.generateContent({ model, contents: prompt });
          return resp.text;
        } catch (error) {
          if (error instanceof ApiError) {
            if (error.status === 429) {
              const delay = Math.pow(2, i) * 1000;
              await new Promise(res => setTimeout(res, delay));
              continue;
            }
            lastErr = error;
            break;
          } else {
            lastErr = error;
            break;
          }
        }
      }
      return "";
    }

    for (const name of validModels) {
      if (typeof name !== "string" || !name) continue;
      tex = (await generateWithRetry(name)) || "";
      if (tex && tex.trim()) break;
    }

    // Fallback: try raw HTTP against v1 endpoint if all SDK attempts fail
    if (!tex || !tex.trim()) {
      try {
        for (const name of validModels) {
          if (!name) continue;
          const raw = await rawGenerateV1(name, prompt, key);
          if (raw && raw.trim()) {
            tex = raw;
            break;
          }
        }
      } catch (e) {
        lastErr = e;
      }
      if (!tex || !tex.trim()) {
        // Log error for debugging, but don't leak sensitive info
        if (lastErr instanceof ApiError) {
          console.error("Gemini API error:", {
            name: lastErr.name,
            status: lastErr.status,
            message: lastErr.message
          });
        } else {
          console.error("Gemini call failed across models (SDK v1beta + HTTP v1)", { lastErr, validModels });
        }
        return NextResponse.json(
          { error: "Gemini API call failed. Try a different model.", tried: validModels },
          { status: 502 }
        );
      }
    }

    // Clean common code fence wrappers if present
    tex = stripCodeFences(tex).trim();

    // Basic sanity: ensure it looks like LaTeX and preserves documentclass
    if (!/\\documentclass/.test(tex)) {
      // fallback: return original base to avoid broken output
      return NextResponse.json({ tex: base }, { status: 200 });
    }

    return NextResponse.json({ tex }, { status: 200 });
  } catch (err: any) {
    // Use NextResponse.json for error responses
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, status: err.status }, { status: err.status });
    }
    console.error("/api/tailor error", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

function buildPrompt(base: string, jd: string) {
  return [
    "You are a precise LaTeX resume tailoring assistant.",
    "Task:",
    "- Given a job description and a LaTeX resume file, tailor ONLY the content (bullet phrasing, ordering, emphasis) to highlight relevant experience.",
    "- STRICTLY preserve the LaTeX structure, preamble, custom macros, sections, and formatting.",
    "- Do NOT add new packages. Do NOT remove existing commands/macros.",
    "- Keep the header with name and contacts intact.",
    "- Avoid verbose additions; keep length comparable. Prefer rewording and reordering over adding many new bullets.",
    "- Maintain professional tone. Keep hyperlinks and macros like \\resumeEntry, \\pubEntry, \\certEntry intact.",
    "- Output ONLY the raw .tex document, without any explanations or code fences.",
    "",
    "Job Description:",
    jd,
    "",
    "Current LaTeX resume:",
    base,
  ].join("\n\n");
}

function stripCodeFences(s: string) {
  // remove leading/trailing code fences if model wraps output
  return s
    .replace(/^\s*```(?:latex|tex)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
}

async function rawGenerateV1(model: string, prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`v1 generateContent failed ${resp.status}`);
  const json = await resp.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ||
    json?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "";
  return text as string;
}
