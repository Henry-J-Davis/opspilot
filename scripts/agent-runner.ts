import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type FeatureRequestRow = {
  id: string;
  title: string;
  description: string;
  spec_markdown: string | null;
  plan_markdown: string | null;
  code_patch_markdown: string | null;
  tests_markdown: string | null;
};

function sh(cmd: string) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function shCapture(cmd: string) {
  console.log(`\n$ ${cmd}`);
  try {
    const out = execSync(cmd, { stdio: "pipe" });
    return { ok: true as const, output: out.toString("utf8") };
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown };
    const stdout =
      typeof err?.stdout === "string"
        ? err.stdout
        : Buffer.isBuffer(err?.stdout)
          ? err.stdout.toString("utf8")
          : "";
    const stderr =
      typeof err?.stderr === "string"
        ? err.stderr
        : Buffer.isBuffer(err?.stderr)
          ? err.stderr.toString("utf8")
          : "";
    return { ok: false as const, output: `${stdout}\n${stderr}`.trim() };
  }
}

function ensureCleanWorkingTreeOrFail() {
  const res = shCapture("git status --porcelain");
  if (!res.ok) throw new Error(`git status failed:\n${res.output}`);
  if (res.output.trim().length > 0) {
    throw new Error(
      "Working tree is not clean. Commit/stash changes before running the agent.\n" + res.output
    );
  }
}

function assertAllowedPath(filePath: string) {
  const allowedPrefixes = ["src/app/", "src/components/", "src/lib/", "supabase/migrations/"];
  const forbiddenPrefixes = [".git/", ".github/", ".env", "node_modules/", "scripts/"];

  if (filePath.startsWith("/") || filePath.includes("..")) {
    throw new Error(`Unsafe file path: ${filePath}`);
  }
  if (forbiddenPrefixes.some((p) => filePath.startsWith(p) || filePath === p)) {
    throw new Error(`Forbidden file path: ${filePath}`);
  }
  if (!allowedPrefixes.some((p) => filePath.startsWith(p))) {
    throw new Error(
      `Path not allowed by allowlist: ${filePath}\nAllowed: ${allowedPrefixes.join(", ")}`
    );
  }
}

async function regeneratePatchFromLint(args: {
  openai: OpenAI;
  title: string;
  description: string;
  spec: string;
  plan: string;
  previousPatch: string;
  lintOutput: string;
}) {
  const { openai, title, description, spec, plan, previousPatch, lintOutput } = args;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "You are a senior engineer. Revise a previously generated patch to fix lint errors. " +
          "Output only full-file patch sections.",
      },
      {
        role: "user",
        content: `
Repo rules:
- This repo uses src/ layout.
- All Next.js routes must be under src/app/**.
- Components under src/components/**.
- Helpers under src/lib/**.
- Output ONLY sections formatted like:
  ## <file path>
  ~~~<language>
  <FULL FILE CONTENT>
  ~~~
- No git diffs.

Feature:
TITLE: ${title}
DESCRIPTION: ${description}

SPEC:
${spec}

PLAN:
${plan}

PREVIOUS PATCH:
${previousPatch}

LINT OUTPUT:
${lintOutput}

Task:
Return a corrected patch that fixes the lint errors while implementing the feature.
`.trim(),
      },
    ],
  });

  return completion.choices?.[0]?.message?.content ?? "";
}

function extractFilesFromPatch(patch: string): Array<{ filePath: string; content: string }> {
  const files: Array<{ filePath: string; content: string }> = [];
  const sectionRegex = /^##\s+(.+?)\s*$/gm;

  const headings: Array<{ filePath: string; index: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = sectionRegex.exec(patch)) !== null) {
    headings.push({ filePath: m[1].trim(), index: m.index });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : patch.length;
    const chunk = patch.slice(start, end);

    const codeBlockMatch =
      chunk.match(/```[a-zA-Z]*\s*\n([\s\S]*?)\n```/) ??
      chunk.match(/~~~[a-zA-Z]*\s*\n([\s\S]*?)\n~~~/);

    if (!codeBlockMatch) continue;

    const content = codeBlockMatch[1];
    const filePath = headings[i].filePath;

    if (filePath.startsWith("/") || filePath.includes("..")) {
      throw new Error(`Unsafe file path in patch: ${filePath}`);
    }

    files.push({ filePath, content });
  }

  return files;
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in env (.env.local). Needed for self-healing lint.");
  }

  const featureId = process.argv[2];
  const flags = new Set(process.argv.slice(3));
  const DRY_RUN = flags.has("--dry-run");

  if (!featureId) {
    console.error("Usage: npx tsx scripts/agent-runner.ts <feature_request_id> [--dry-run]");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const branchInfo = shCapture("git rev-parse --abbrev-ref HEAD");
  if (branchInfo.ok) console.log(`Current branch: ${branchInfo.output.trim()}`);

  const { data: rows, error } = await supabase
    .from("feature_requests")
    .select("id,title,description,spec_markdown,plan_markdown,code_patch_markdown,tests_markdown")
    .eq("id", featureId);

  if (error) throw new Error(`Failed to query feature_requests: ${error.message}`);
  if (!rows || rows.length === 0) throw new Error(`No feature request found for id: ${featureId}`);
  if (rows.length > 1) throw new Error(`Multiple feature requests found for id: ${featureId}`);

  const row = rows[0] as FeatureRequestRow;

  console.log("\nLoaded Feature Request:");
  console.log(`- title: ${row.title}`);
  console.log(`- id: ${row.id}`);
  console.log(`- title: ${row.title}`);
  
  if (!row.code_patch_markdown) {
    throw new Error("No code_patch_markdown found. Generate Code Patch in the app first.");
  }

  const branchName = `agent/${row.id.slice(0, 8)}-${Date.now()}`;


 

  if (!DRY_RUN) {
    ensureCleanWorkingTreeOrFail();
    sh(`git checkout -b ${branchName}`);
  } else {
    console.log("\n[DRY RUN] Skipping clean-tree check and branch creation.");
  }

   // ---- Write PR Summary File ----
const docsDir = path.join(process.cwd(), "docs", "agent");
fs.mkdirSync(docsDir, { recursive: true });

const summaryPath = path.join(docsDir, `${row.id}.md`);

const summaryContent = `
# Agent PR Summary

## Title
${row.title}

## Description
${row.description}

## Spec
${row.spec_markdown ?? "_No spec provided_"}

## Plan
${row.plan_markdown ?? "_No plan provided_"}

## Generated
- Feature ID: ${row.id}
- Timestamp: ${new Date().toISOString()}
- Branch: ${branchName}
`.trim();

fs.writeFileSync(summaryPath, summaryContent, "utf8");
console.log(`Wrote summary: docs/agent/${row.id}.md`);

  const files = extractFilesFromPatch(row.code_patch_markdown);
  if (files.length === 0) {
    throw new Error(
      "Patch parser found no files. Ensure patch output uses ## headings + fenced code blocks."
    );
  }

  for (const f of files) {
    assertAllowedPath(f.filePath);

    const abs = path.join(process.cwd(), f.filePath);
    const dir = path.dirname(abs);
    fs.mkdirSync(dir, { recursive: true });

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would write: ${f.filePath}`);
    } else {
      fs.writeFileSync(abs, f.content, "utf8");
      console.log(`Wrote: ${f.filePath}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Skipping lint/tests/commit/push/PR.");
    return;
  }

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const lintRes = shCapture("npm run lint");

    if (lintRes.ok) {
      console.log(`✅ Lint passed on attempt ${attempt}/${MAX_ATTEMPTS}`);
      break;
    }

    console.warn(`❌ Lint failed on attempt ${attempt}/${MAX_ATTEMPTS}`);
    console.warn(lintRes.output);

    if (attempt === MAX_ATTEMPTS) {
      throw new Error(`Lint failed after ${MAX_ATTEMPTS} attempts.\n${lintRes.output}`);
    }

    const newPatch = await regeneratePatchFromLint({
      openai,
      title: row.title,
      description: row.description,
      spec: row.spec_markdown ?? "",
      plan: row.plan_markdown ?? "",
      previousPatch: row.code_patch_markdown ?? "",
      lintOutput: lintRes.output,
    });

    const revisedFiles = extractFilesFromPatch(newPatch);
    if (revisedFiles.length === 0) throw new Error("Revised patch parser found no files.");

    for (const f of revisedFiles) {
      assertAllowedPath(f.filePath);
      const abs = path.join(process.cwd(), f.filePath);
      const dir = path.dirname(abs);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(abs, f.content, "utf8");
      console.log(`Wrote: ${f.filePath}`);
    }

    await supabase.from("feature_requests").update({ code_patch_markdown: newPatch }).eq("id", row.id);
    row.code_patch_markdown = newPatch;
  }

  const scriptsRes = shCapture("npm run -s");
const hasTestScript =
  scriptsRes.ok && /\btest\b/.test(scriptsRes.output);

if (!hasTestScript) {
  console.log("ℹ️ No npm test script found. Skipping tests.");
} else {
  try {
    sh("npm test");
  } catch {
    console.warn("Tests failed. Fix issues or adjust runner.");
    process.exit(1);
  }
}

  sh("git add -A");
  sh(`git commit -m "Agent: ${row.title}"`);
sh(`git push -u origin ${branchName}`);

const prUrl = `https://github.com/Henry-J-Davis/opspilot/pull/new/${branchName}`;



console.log("\n✅ Branch pushed.");
console.log("✅ GitHub Actions will open a PR automatically for agent/** branches.");
console.log(`✅ Branch: ${branchName}`);
}

main().catch((e) => {
  console.error("\nRunner error:", e);
  setTimeout(() => process.exit(1), 50);
});