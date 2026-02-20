import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const spec = String(body?.spec ?? "");

    if (!spec.trim()) {
      return NextResponse.json({ error: "Missing spec content" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a senior software architect. Produce a file-by-file implementation plan for a Next.js App Router + Supabase app. Be concrete: list exact file paths, exact DB SQL, and step-by-step tasks.",
        },
        {
          role: "user",
          content: `
Generate an implementation plan based on this spec.

Output format (Markdown):
# Implementation Plan
## Database changes (SQL)
## Frontend changes (file-by-file)
## API changes (if any)
## Testing plan
## Rollout notes

Spec:
${spec}
`.trim(),
        },
      ],
    });

    const plan = completion.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ plan });
  } catch (e: any) {
    console.error("generate-plan error:", e);
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
