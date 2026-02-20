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
            "You are a senior test engineer. Generate concrete tests for a Next.js App Router + Supabase app using Vitest and React Testing Library. Include file paths and full test code.",
        },
        {
          role: "user",
          content: `
Generate a test implementation plan.

Requirements:
- List required dev dependencies
- Provide test file paths (e.g. __tests__/DashboardClient.test.tsx)
- Provide full test code blocks
- Explain what to mock (Supabase client)
- Include commands to run tests

SPEC:
${spec}

PLAN:
${plan}
`.trim(),
        },
      ],
    });

    const tests = completion.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ tests });
  } catch (e: any) {
    console.error("generate-tests error:", e);
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
