import "dotenv/config";
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

<<<<<<< Updated upstream
=======
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
      "Working tree is not clean. Commit/stash changes before running the agent.\n" +
        res.output
    );
  }
}

function assertAllowedPath(filePath: string) {
  const allowedPrefixes = [
    "src/app/",
    "src/components/",
    "src/lib/",
    "supabase/migrations/",
  ];

  const forbiddenPrefixes = [
    ".git/",
    ".github/",
    ".env",
    "node_modules/",
    "scripts/", // prevent agent overwriting itself
  ];

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
          "You are a senior engineer. You will revise a previously generated patch to fix lint errors. " +
          "You MUST obey repo layout rules and output only full-file patch sections.",
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
  \`\`\`<language>
  <FULL FILE CONTENT>
  \`\`\`
- No git diffs. No snippets.

Feature:
TITLE: ${title}
DESCRIPTION: ${description}

SPEC:
${spec}

PLAN:
${plan}

PREVIOUS PATCH:
${previousPatch}

LINT OUTPUT (fix these errors):
${lintOutput}

Task:
Return a corrected patch that fixes the lint errors while implementing the feature.
`.trim(),
      },
    ],
  });

  return completion.choices?.[0]?.message?.content ?? "";
}

>>>>>>> Stashed changes
// Naive but effective parser:
// Expects patch markdown sections like:
// ## path/to/file
// ```tsx
// ...file content...
// ```
function extractFilesFromPatch(patch: string): Array<{ filePath: string; content: string }> {
  const files: Array<{ filePath: string; content: string }> = [];
  const sectionRegex = /^##\s+(.+?)\s*$/gm;

  // Find headings and slice between them
  const headings: Array<{ filePath: string; index: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = sectionRegex.exec(patch)) !== null) {
    headings.push({ filePath: m[1].trim(), index: m.index });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : patch.length;
    const chunk = patch.slice(start, end);

    // Grab first fenced code block in that chunk
    const codeBlockMatch = chunk.match(/```[a-zA-Z]*\s*\n([\s\S]*?)\n```/);
    if (!codeBlockMatch) continue;

    const content = codeBlockMatch[1];
    const filePath = headings[i].filePath;

    // Only write files inside repo (basic safety)
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }

  const featureId = process.argv[2];
  if (!featureId) {
    console.error("Usage: npx tsx scripts/agent-runner.ts <feature_request_id>");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const branchInfo = shCapture("git rev-parse --abbrev-ref HEAD");
if (branchInfo.ok) {
  console.log(`Current branch: ${branchInfo.output.trim()}`);
}
  
  // 1) Load feature request
  const { data: fr, error } = await supabase
    .from("feature_requests")
    .select("id,title,description,spec_markdown,plan_markdown,code_patch_markdown,tests_markdown")
    .eq("id", featureId)
    .single();

  if (error || !fr) throw new Error(`Failed to load feature request: ${error?.message}`);

  const row = fr as FeatureRequestRow;

  console.log("\nLoaded Feature Request:");
  console.log(`- id: ${row.id}`);
  console.log(`- title: ${row.title}`);

  // 2) Ensure patch exists (you already generate it in app; runner assumes it's present)
  if (!row.code_patch_markdown) {
    throw new Error("No code_patch_markdown found. Generate Code Patch in the app first.");
  }

  // 3) Create a new git branch
  const branchName = `agent/${row.id.slice(0, 8)}-${Date.now()}`;
<<<<<<< Updated upstream
=======

if (!DRY_RUN) {
  ensureCleanWorkingTreeOrFail();
  console.log(`git status summary:\n${shCapture("git status --porcelain").output}`);
>>>>>>> Stashed changes
  sh(`git checkout -b ${branchName}`);

  // 4) Apply file writes
  const files = extractFilesFromPatch(row.code_patch_markdown);
  if (files.length === 0) {
    throw new Error("Patch parser found no files. Ensure patch output uses ## file headings + fenced code blocks.");
  }

  for (const f of files) {
    const abs = path.join(process.cwd(), f.filePath);
    const dir = path.dirname(abs);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(abs, f.content, "utf8");
    console.log(`Wrote: ${f.filePath}`);
  }

  // 5) Run checks (adjust as your repo supports)
  // If you don't have tests yet, you can comment these out.
  try {
    sh("npm run lint");
  } catch {
    console.warn("Lint failed. Fix issues or adjust runner.");
    process.exit(1);
  }

  try {
    sh("npm test");
  } catch {
    console.warn("Tests failed. Fix issues or adjust runner.");
    process.exit(1);
  }

  // 6) Commit + push
  sh("git add -A");
  sh(`git commit -m "Agent: ${row.title}"`);
  sh(`git push -u origin ${branchName}`);

  console.log("\n✅ Branch pushed.");
  console.log("Next: create PR (we'll add GitHub CLI step next if you want).");
}

main().catch((e) => {
  console.error("\nRunner error:", e);
  process.exit(1);
});
