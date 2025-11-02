import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function listModels(apiKey: string, apiVersion: "v1beta" | "v1") {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models`;
  const resp = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`);
  if (!resp.ok) {
    throw new Error(`ListModels ${apiVersion} failed: ${resp.status}`);
  }
  const json = await resp.json();
  return json?.models ?? [];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientKey = url.searchParams.get("apiKey") || url.searchParams.get("key");
  const key = clientKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return new NextResponse("Missing GEMINI_API_KEY or apiKey", { status: 400 });
  }
  try {
    // Try v1beta first (most common for AI Studio keys)
    let models = await listModels(key, "v1beta");
    if (!models?.length) {
      // Fallback to v1
      models = await listModels(key, "v1");
    }
    return NextResponse.json({ models }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to list models" }, { status: 502 });
  }
}
