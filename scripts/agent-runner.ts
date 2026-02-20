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
