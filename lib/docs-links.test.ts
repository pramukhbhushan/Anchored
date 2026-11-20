import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// =============================================================================
// Module Overview
// =============================================================================
// Docs that point at files must point at files that exist. For every tracked
// Markdown file, the test checks each relative link, such as `[runbook](testing/agent-demo.md)`,
// and each backticked repo path, such as `lib/domain/executor.ts`, and fails with
// the doc, the line and the missing target. Code fences are skipped, since they
// hold commands and examples rather than references.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// A backticked token counts as a repo path only when it starts at one of these folders.
// Bare names such as `memory.ts` are too ambiguous to check.
const TOP_LEVEL = ["app", "components", "docs", "lib", "public", "scripts", "supabase", "test", ".github", ".claude"];

// Placeholders and patterns, such as `supabase/migrations/<timestamp>_<what>.sql` or
// `docs/screenshots/*.png`, describe a family of files rather than name one.
const PATTERN = /[<>*{}…]|\.\.\./;

/** One reference in a doc that names a missing file. */
interface Broken {
  readonly doc: string;
  readonly line: number;
  readonly target: string;
}

/** Return every Markdown file git tracks, as repo paths. */
function trackedDocs(): string[] {
  const out = execFileSync("git", ["ls-files", "-z", "--", "*.md"], { cwd: ROOT, encoding: "utf8" });
  return out.split("\0").filter((path) => path !== "" && existsSync(join(ROOT, path)));
}

/** Blank out fenced code blocks so their contents are never read as references, keeping line numbers. */
function withoutFences(text: string): string[] {
  let fenced = false;
  return text.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return "";
    }
    return fenced ? "" : line;
  });
}

/** Return the file a link target names, relative to the repo root, or `null` for links that leave the repo. */
function linkedPath(doc: string, target: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#") || target.startsWith("//")) return null;
  const path = decodeURIComponent(target.replace(/[#?].*$/, ""));
  if (path === "") return null;
  return normalize(path.startsWith("/") ? path.slice(1) : join(dirname(doc), path));
}

/** Return the repo path a backticked token names, or `null` when it is not a repo path. */
function backtickedPath(token: string): string | null {
  const path = token.replace(/:\d+(-\d+)?$/, "").replace(/#.*$/, "");
  if (PATTERN.test(path) || /\s/.test(path)) return null;
  const first = path.split("/")[0] ?? "";
  if (!path.includes("/") || !TOP_LEVEL.includes(first)) return null;
  return normalize(path);
}

/** Report whether `path` names a file or folder, or a module named without its extension, such as `lib/auth/server`. */
function exists(path: string): boolean {
  return ["", ".ts", ".tsx"].some((extension) => existsSync(join(ROOT, `${path}${extension}`)));
}

/** Return each reference in `doc` that names a file missing from the repo. */
function brokenIn(doc: string): Broken[] {
  const lines = withoutFences(readFileSync(join(ROOT, doc), "utf8"));
  return lines.flatMap((text, index) => {
    const targets = new Set<string>();
    // Inline links and images: [text](target) or [text](target "title").
    for (const match of text.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const path = linkedPath(doc, match[1] ?? "");
      if (path !== null) targets.add(path);
    }
    // Reference definitions: [name]: target
    const reference = /^\s*\[[^\]]+\]:\s*(\S+)/.exec(text);
    if (reference !== null) {
      const path = linkedPath(doc, reference[1] ?? "");
      if (path !== null) targets.add(path);
    }
    for (const match of text.matchAll(/`([^`\n]+)`/g)) {
      const path = backtickedPath(match[1] ?? "");
      if (path !== null) targets.add(path);
    }
    return [...targets].filter((path) => !exists(path)).map((target) => ({ doc, line: index + 1, target }));
  });
}

describe("doc links", () => {
  it("resolve to files in the repo", () => {
    const broken = trackedDocs().flatMap(brokenIn).map(({ doc, line, target }) => `${doc}:${line} names ${target}, which does not exist`);
    expect(broken).toEqual([]);
  });

  it("reads links relative to the doc and backticked paths from the root", () => {
    expect(linkedPath("docs/agents.md", "testing/agent-demo.md#live-checks")).toBe("docs/testing/agent-demo.md");
    expect(linkedPath("README.md", "Agent%20System%20Implementation/README.md")).toBe("Agent System Implementation/README.md");
    expect(linkedPath("README.md", "https://example.com/a.md")).toBeNull();
    expect(linkedPath("README.md", "#set-up-telegram")).toBeNull();
    expect(backtickedPath("lib/domain/executor.ts:42")).toBe("lib/domain/executor.ts");
    expect(backtickedPath("supabase/migrations/<timestamp>_<what>.sql")).toBeNull();
    expect(backtickedPath("npm run check")).toBeNull();
    expect(backtickedPath("owner/name")).toBeNull();
  });
});
