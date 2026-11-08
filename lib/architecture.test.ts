import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// =============================================================================
// Module Overview
// =============================================================================
// The layer rules, enforced. `RULES` says which files may import what; the test
// reads every import in `app/`, `components/`, `lib/` and `middleware.ts` with the
// TypeScript parser and fails with the file, the import and the rule it breaks.
// Type-only imports count too: naming another layer's types is depending on it.

/** One rule: the files it covers, and either the only imports they may have or the imports they must never have. */
interface LayerRule {
  /** Path prefixes from the repo root, such as `lib/domain`, or `"use client"` for every client file. */
  readonly files: readonly string[];
  /** When set, these files may import only these layers and packages, besides their own layer. */
  readonly only?: readonly string[];
  /** These files must never import these layers or packages. */
  readonly never?: readonly string[];
  /** Why the rule exists, printed with every violation. */
  readonly why: string;
}

// An entry like `lib/domain` matches that file or folder and everything under it; `next` matches
// `next` and `next/server`. Files may always import their own layer, so `only` lists the others.
const RULES: readonly LayerRule[] = [
  {
    files: ["lib/domain"],
    only: ["zod"],
    why: "Business rules are pure, so they run in the browser, on the server and in tests with no setup.",
  },
  {
    files: ["lib/api"],
    only: ["lib/domain", "zod"],
    why: "The HTTP contract is shared by client and server code, so it holds only types and Zod schemas.",
  },
  {
    files: ["lib/llm"],
    never: ["lib/server", "lib/store", "lib/api", "lib/auth", "next", "react"],
    why: "Provider adapters turn a prompt into text or an object; requests, storage and orchestration live above them.",
  },
  {
    files: ["lib/connectors"],
    never: ["lib/server", "lib/store", "lib/api", "lib/auth", "lib/llm", "next", "react"],
    why: "Provider adapters turn one send or one webhook into plain values; storage, sessions and the send rules live above them.",
  },
  {
    files: ["lib/store"],
    never: ["lib/server", "lib/llm", "lib/auth", "next", "react"],
    why: "Persistence reads and writes one session's rows; it never reads a request or calls a model.",
  },
  {
    files: ["lib/auth"],
    never: ["lib/server", "lib/store", "lib/llm"],
    why: "Middleware and the browser use the auth helpers, so they stay clear of server orchestration.",
  },
  {
    files: ["lib/session-cookie.ts", "lib/auth/config.ts", "lib/auth/paths.ts", "lib/auth/session-id.ts", "lib/auth/viewer.ts", "lib/server/origin.ts", "lib/server/rate-limit.ts"],
    only: [],
    why: "`middleware.ts` runs on the edge runtime and shares these with the server and the browser, so they import nothing.",
  },
  {
    files: ["lib"],
    never: ["app", "components", "middleware"],
    why: "Pages and components sit on top of `lib`; `lib` never reaches up into them.",
  },
  {
    files: ["components", "app"],
    never: ["middleware"],
    why: "`middleware.ts` is an entry point. Code that routes share with it lives in `lib/server` or `lib/auth`.",
  },
  {
    files: ["components"],
    never: ["app"],
    why: "Pages compose components, never the other way round.",
  },
  {
    files: ['"use client"'],
    never: ["lib/server", "lib/store", "lib/llm", "lib/connectors", "lib/auth/server", "server-only"],
    why: "Client files ship to the browser, which must never receive server code, secrets or the service-role store.",
  },
];

// =============================================================================
// Reading imports
// =============================================================================

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCANNED = ["app", "components", "lib", "middleware.ts"];
const SOURCE = /\.(ts|tsx)$/;
// Tests and the `server-only` stub reach across layers on purpose to set up what they check.
const SKIPPED = /\.test\.tsx?$|\.d\.ts$|^lib\/test-stubs\//;

/** One parsed source file: its repo-relative path, whether it is a client file, and every import it names. */
interface SourceFile {
  readonly path: string;
  readonly isClient: boolean;
  readonly imports: readonly { readonly specifier: string; readonly target: string }[];
}

/** Return every repo-relative `.ts` and `.tsx` path under `entry`, or `entry` itself when it is a file. */
function sourcePaths(entry: string): string[] {
  const absolute = join(ROOT, entry);
  if (SOURCE.test(entry)) return [entry];
  return readdirSync(absolute, { recursive: true, encoding: "utf8" })
    .map((name) => join(entry, name))
    .filter((path) => SOURCE.test(path) && !SKIPPED.test(path));
}

/** Return the module specifiers `source` imports, re-exports or loads with `import()`. */
function importSpecifiers(source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) found.push(argument.text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      found.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Report whether the file's directive prologue says `"use client"`. */
function isClientFile(source: ts.SourceFile): boolean {
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === "use client") return true;
  }
  return false;
}

/** Return what `specifier` names: a repo path without its extension for project files, else the package specifier. */
function targetOf(fromPath: string, specifier: string): string {
  if (specifier.startsWith("@/")) return specifier.slice(2).replace(SOURCE, "");
  if (specifier.startsWith(".")) return relative(ROOT, resolve(ROOT, dirname(fromPath), specifier)).replace(SOURCE, "");
  return specifier;
}

/** Parse `path` into its imports and client marker. */
function readSource(path: string): SourceFile {
  const source = ts.createSourceFile(path, readFileSync(join(ROOT, path), "utf8"), ts.ScriptTarget.Latest, true);
  const imports = importSpecifiers(source).map((specifier) => ({ specifier, target: targetOf(path, specifier) }));
  return { path, isClient: isClientFile(source), imports };
}

// =============================================================================
// Checking the rules
// =============================================================================

/** Report whether `pattern` names `target` itself or something under it. */
function covers(pattern: string, target: string): boolean {
  return target === pattern || target.startsWith(`${pattern}/`);
}

/** Report whether `rule` applies to `file`. */
function appliesTo(rule: LayerRule, file: SourceFile): boolean {
  return rule.files.some((pattern) => (pattern === '"use client"' ? file.isClient : covers(pattern.replace(SOURCE, ""), file.path.replace(SOURCE, ""))));
}

/** Return one message per import in `file` that breaks `rule`. */
function violations(rule: LayerRule, file: SourceFile): string[] {
  const own = rule.files.filter((pattern) => pattern !== '"use client"');
  return file.imports.flatMap(({ specifier, target }) => {
    if (rule.never?.some((pattern) => covers(pattern, target))) {
      return [`${file.path} imports "${specifier}", but ${rule.files.join(", ")} must never import ${rule.never.join(", ")}. ${rule.why}`];
    }
    if (rule.only === undefined || own.some((pattern) => covers(pattern, target)) || rule.only.some((pattern) => covers(pattern, target))) return [];
    const allowed = rule.only.length === 0 ? "nothing" : `only ${rule.only.join(", ")}`;
    return [`${file.path} imports "${specifier}", but ${rule.files.join(", ")} may import ${allowed}. ${rule.why}`];
  });
}

const FILES: readonly SourceFile[] = SCANNED.flatMap(sourcePaths).sort().map(readSource);

describe("layer rules", () => {
  it.each(RULES.map((rule) => [rule.files.join(", "), rule] as const))("%s", (_name, rule) => {
    const covered = FILES.filter((file) => appliesTo(rule, file));
    // A rule that matches no file has gone stale, for example after a folder was renamed.
    expect(covered.length, `No file matches ${rule.files.join(", ")}. Update \`RULES\` in lib/architecture.test.ts.`).toBeGreaterThan(0);
    expect(covered.flatMap((file) => violations(rule, file))).toEqual([]);
  });

  it("reads imports and re-exports", () => {
    const decide = FILES.find((file) => file.path === "lib/server/decide.ts");
    expect(decide?.imports.map((entry) => entry.target)).toContain("lib/domain/executor");
    expect(FILES.find((file) => file.path === "lib/llm/index.ts")?.imports.map((entry) => entry.target)).toContain("lib/llm/types");
  });
});
