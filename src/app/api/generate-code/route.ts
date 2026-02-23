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
    const plan = String(body?.plan ?? "");

    if (!spec.trim() || !plan.trim()) {
      return NextResponse.json({ error: "Missing spec/plan" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a senior engineer. Generate patch-style instructions to implement the feature in a Next.js App Router + Supabase app. Output exact file paths and full code blocks for changed files. Keep changes minimal.",
        },
        {
          role: "user",
          content: `
Generate a code patch (Markdown) that implements the plan.

Rules:
- Use headings per file, like: "## src/app/dashboard/DashboardClient.tsx"
- Under each file heading, provide a full code block of the updated file OR a very clear diff-style patch.
- Include any required Supabase SQL.
- If you reference new files, provide their full contents.

SPEC:
${spec}

PLAN:
${plan}
`.trim(),
        },
      ],
    });

    const patch = completion.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ patch });
  } catch (e: unknown) {
    console.error("generate-code error:", e);
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
