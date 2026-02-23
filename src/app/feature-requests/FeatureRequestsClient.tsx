"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type FeatureRequest = {
  id: string;
  title: string;
  description: string;
  spec_markdown: string | null;
  plan_markdown: string | null;
  code_patch_markdown: string | null;
  tests_markdown: string | null;
  created_at?: string | null;

};

export default function FeatureRequestsClient() {
  const supabase = createSupabaseBrowserClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requests, setRequests] = useState<FeatureRequest[]>([]);

  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setMsg(null);
    setLoading(true);

    // Guard: if session is missing, bounce to login
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setLoading(false);
      window.location.assign("/login");
      return;
    }

    const { data: fr, error } = await supabase
      .from("feature_requests")
      .select("id,title,description,spec_markdown,plan_markdown,code_patch_markdown,tests_markdown,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      setRequests([]);
      return;
    }

    setRequests((fr as FeatureRequest[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createRequest() {
    setMsg(null);

    if (!title.trim() || !description.trim()) {
      setMsg("Please enter both a title and description.");
      return;
    }

    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr) {
      setMsg(uErr.message);
      return;
    }

    const uid = u.user?.id;
    if (!uid) {
      setMsg("You are not signed in.");
      return;
    }

    const { error } = await supabase.from("feature_requests").insert([
      {
        title: title.trim(),
        description: description.trim(),
        owner_id: uid,
      },
    ]);

    if (error) {
      setMsg(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    await load();
  }

  async function generateSpec(id: string, frTitle: string, frDescription: string) {
    setMsg(null);
    setBusyId(id);

    try {
      const res = await fetch("/api/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: frTitle, description: frDescription }),
      });

      const raw = await res.text();

      if (!res.ok) {
        throw new Error(`API ${res.status}: ${raw}`);
      }

      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`API returned non-JSON: ${raw}`);
      }

      const spec = (data as Record<string, unknown>)?.spec;
      if (!spec || typeof spec !== "string") {
        throw new Error("API returned no spec text.");
      }

      const { error: upErr } = await supabase
        .from("feature_requests")
        .update({ spec_markdown: spec })
        .eq("id", id);

      if (upErr) throw new Error(`DB update failed: ${upErr.message}`);

      await load();
   } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setMsg(msg);
}
    finally {
      setBusyId(null);
    }
  }

  async function generatePlan(id: string, spec: string) {
  setMsg(null);
  setBusyId(id);

  try {
    const res = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec }),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`API ${res.status}: ${raw}`);

   let data: unknown = {};
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`API returned non-JSON: ${raw}`);
    }

    const plan = (data as Record<string, unknown>)?.plan;
    if (!plan || typeof plan !== "string") throw new Error("API returned no plan text.");

    const { error: upErr } = await supabase
      .from("feature_requests")
      .update({ plan_markdown: plan })
      .eq("id", id);

    if (upErr) throw new Error(`DB update failed: ${upErr.message}`);

    await load();
 } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setMsg(msg);
}
  finally {
    setBusyId(null);
  }
}


async function generateCodePatch(id: string, spec: string, plan: string) {
  setMsg(null);
  setBusyId(id);

  try {
    const res = await fetch("/api/generate-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec, plan }),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`API ${res.status}: ${raw}`);

    let data: unknown = {};
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`API returned non-JSON: ${raw}`);
    }

    const patch = (data as Record<string, unknown>)?.patch;
    if (!patch || typeof patch !== "string") throw new Error("API returned no patch text.");

    const { error: upErr } = await supabase
      .from("feature_requests")
      .update({ code_patch_markdown: patch })
      .eq("id", id);

    if (upErr) throw new Error(`DB update failed: ${upErr.message}`);

    await load();
  } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setMsg(msg);
}
   finally {
    setBusyId(null);
  }
}

async function generateTests(id: string, spec: string, plan: string) {
  setMsg(null);
  setBusyId(id);

  try {
    const res = await fetch("/api/generate-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec, plan }),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`API ${res.status}: ${raw}`);

    let data: unknown = {};
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`API returned non-JSON: ${raw}`);
    }

    const tests = (data as Record<string, unknown>)?.tests;
    if (!tests || typeof tests !== "string")
      throw new Error("API returned no tests text.");

    const { error: upErr } = await supabase
      .from("feature_requests")
      .update({ tests_markdown: tests })
      .eq("id", id);

    if (upErr) throw new Error(`DB update failed: ${upErr.message}`);

    await load();
  } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setMsg(msg);
}
   finally {
    setBusyId(null);
  }
}


async function createPR(r: FeatureRequest) {
  setMsg(null);
  setBusyId(r.id);

  try {
    const content = `
# ${r.title}

## Spec
${r.spec_markdown ?? ""}

## Plan
${r.plan_markdown ?? ""}

## Code Patch
${r.code_patch_markdown ?? ""}

## Tests
${r.tests_markdown ?? ""}
`;

    const res = await fetch("/api/create-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `AI: ${r.title}`,
        content,
      }),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`API ${res.status}: ${raw}`);

    const data = JSON.parse(raw);
    setMsg(`PR created: ${data.pr_url}`);
 } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setMsg(msg);
}
  finally {
    setBusyId(null);
  }
}



  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold">AI Feature Builder</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Create a feature request, then generate a spec via <code>/api/generate-spec</code>.
            </p>
          </div>

          <a
            href="/dashboard"
            className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700"
          >
            Back to Dashboard
          </a>
        </div>

        {msg && (
          <div className="mt-4 whitespace-pre-wrap rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
            {msg}
          </div>
        )}

        <div className="mt-6 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm outline-none focus:border-zinc-600"
            placeholder="Feature title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-600"
            rows={5}
            placeholder="Describe the feature..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={createRequest}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-100"
            >
              Create Feature Request
            </button>

            <button
              onClick={load}
              className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700"
            >
              Refresh
            </button>

            {loading && <span className="self-center text-sm text-zinc-400">Loading…</span>}
          </div>
        </div>

        <div className="mt-10 space-y-6">
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 text-zinc-400">
              No feature requests yet.
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{r.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{r.description}</p>
                    {r.created_at && (
                      <p className="mt-2 text-xs text-zinc-500">
                        Created: {new Date(r.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => generateSpec(r.id, r.title, r.description)}
                    disabled={busyId === r.id}
                    className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-zinc-100 disabled:opacity-60"
                  >
                    {busyId === r.id ? "Generating…" : "Generate Spec"}
                  </button>
                </div>

                {r.spec_markdown && (
                  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Spec (Markdown)
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-zinc-200">
                      {r.spec_markdown}
                    </pre>
                  </div>
                )}

                {r.spec_markdown && (
  <button
    onClick={() => generatePlan(r.id, r.spec_markdown!)}
    disabled={busyId === r.id}
    className="mt-3 rounded bg-zinc-700 px-3 py-1 text-white disabled:opacity-60"
  >
    {busyId === r.id ? "Generating…" : "Generate Plan"}
  </button>
)}

{r.plan_markdown && (
  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
      Implementation Plan
    </div>
    <pre className="whitespace-pre-wrap text-sm text-zinc-200">
      {r.plan_markdown}
    </pre>
  </div>
)}

{r.spec_markdown && r.plan_markdown && (
  <button
    onClick={() => generateCodePatch(r.id, r.spec_markdown!, r.plan_markdown!)}
    disabled={busyId === r.id}
    className="mt-3 rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-60"
  >
    {busyId === r.id ? "Generating…" : "Generate Code Patch"}
  </button>
)}

{r.code_patch_markdown && (
  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
      Code Patch
    </div>
    <pre className="whitespace-pre-wrap text-sm text-zinc-200">
      {r.code_patch_markdown}
    </pre>
  </div>
)}

{r.spec_markdown && r.plan_markdown && (
  <button
    onClick={() => generateTests(r.id, r.spec_markdown!, r.plan_markdown!)}
    disabled={busyId === r.id}
    className="mt-3 rounded bg-indigo-600 px-3 py-1 text-white disabled:opacity-60"
  >
    {busyId === r.id ? "Generating…" : "Generate Tests"}
  </button>
)}

{r.tests_markdown && (
  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
      Tests
    </div>
    <pre className="whitespace-pre-wrap text-sm text-zinc-200">
      {r.tests_markdown}
    </pre>
  </div>
)}

{r.spec_markdown && (
  <button
    onClick={() => createPR(r)}
    disabled={busyId === r.id}
    className="mt-3 rounded bg-purple-600 px-3 py-1 text-white disabled:opacity-60"
  >
    {busyId === r.id ? "Creating PR…" : "Create GitHub PR"}
  </button>
)}


              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
