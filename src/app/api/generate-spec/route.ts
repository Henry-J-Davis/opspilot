import { NextResponse } from "next/server";
import OpenAI from "openai";
export const runtime = "nodejs";


export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? "");
    const description = String(body?.description ?? "");

    if (!title.trim() || !description.trim()) {
      return NextResponse.json({ error: "Missing title/description" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Write implementation-ready feature specs in Markdown." },
        {
          role: "user",
          content: `Feature Title: ${title}\n\nFeature Description:\n${description}\n\nWrite a spec with sections: Problem, Stories, Acceptance Criteria, Edge Cases, DB/API/UI changes, Test Plan.`,
        },
      ],
      temperature: 0.2,
    });

    const spec = completion.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ spec });
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return new Response(JSON.stringify({ error: msg }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
}
