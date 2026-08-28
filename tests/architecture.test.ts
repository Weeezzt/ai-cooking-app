import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { assertNoForbiddenKeys } from "./helpers/assertNoForbiddenKeys";

const REPO_ROOT = resolve(__dirname, "..");
const CORE_DIR = join(REPO_ROOT, "src", "core");
const PORTS_DIR = join(REPO_ROOT, "src", "ports");

/**
 * Allowlist model (AD-2, engineering-rules "Boundaries"): `src/core` is pure
 * domain — no I/O, no framework, no SDK, nothing from outward layers. Rather than
 * enumerate what is forbidden (which misses `axios`, `node:fs`, the next new
 * package…), we allow ONLY:
 *   - relative imports that resolve to a path inside `src/core`
 *   - the `@/core` / `@/core/*` alias
 *   - anything explicitly listed here (currently nothing)
 * Everything else is a boundary violation.
 *
 * Known limitation: a computed specifier (`import("../" + "server/x")`) cannot be
 * analysed statically by this scan or by ESLint. Code review covers that case.
 */
const ALLOWED_CORE_IMPORTS: readonly string[] = [];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Every import/export-from/require/dynamic-import specifier in a source file. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bimport\s+(?:[^"';]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

/** True when a specifier is permitted inside `src/core`. */
function isAllowed(spec: string, fileDir: string): boolean {
  if (ALLOWED_CORE_IMPORTS.includes(spec)) return true;

  if (spec === "@/core" || spec.startsWith("@/core/")) return true;

  if (spec.startsWith(".")) {
    const resolved = relative(REPO_ROOT, resolve(fileDir, spec));
    return resolved === "src/core" || resolved.startsWith(`src/core/`);
  }

  // Bare specifier (npm package), a `node:` builtin, or another `@/` alias — all
  // disallowed. Core does no I/O and depends on nothing outward.
  return false;
}

function typeOnlyPortImports(source: string): string[] {
  return [...source.matchAll(/\bimport\s+(?!type\b)[^;]*?from\s+["']@\/ports(?:\/[^"']*)?["']/g)].map((m) => m[0]);
}

describe("src/core import boundary (AD-2)", () => {
  const files = listFiles(CORE_DIR).filter((f) => !f.endsWith(".md"));

  it("has core source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(REPO_ROOT, f), f] as const))(
    "%s only imports relative core paths (no SDK, no I/O, nothing outward)",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      const offenders = importSpecifiers(source).filter(
        (spec) => !(spec === "@/ports" || spec.startsWith("@/ports/")) && !isAllowed(spec, join(file, "..")),
      );
      expect(offenders).toEqual([]);
      expect(typeOnlyPortImports(source)).toEqual([]);
    },
  );

  it("the allowlist itself rejects SDKs, node builtins, and outward paths", () => {
    // Simulate a file at src/core/basket/probe.ts
    const dir = join(CORE_DIR, "basket");
    for (const bad of [
      "axios",
      "openai",
      "next/server",
      "node:fs",
      "@/server",
      "@/server/container",
      "../../server/x",
      "../../app/page",
    ]) {
      expect(isAllowed(bad, dir), `${bad} should be rejected`).toBe(false);
    }
    for (const ok of ["./select", "../money", "@/core/types"]) {
      expect(isAllowed(ok, dir), `${ok} should be allowed`).toBe(true);
    }
  });
});

describe("src/ports is type-only", () => {
  it.each(listFiles(PORTS_DIR).map((f) => [relative(REPO_ROOT, f), f] as const))("%s contains no runtime declarations", (_label, file) => {
    const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/\b(?:const|let|var|class|function|enum|new|return)\b/);
    expect(source).not.toMatch(/\bimport\s+(?!type\b)/);
  });
});

describe("assertNoForbiddenKeys helper (AD-6, placeholder for issue #6)", () => {
  it("passes for a schema with no forbidden keys", () => {
    expect(() =>
      assertNoForbiddenKeys({
        recipeConcept: "string",
        requirements: [{ optionId: "string", requiredGrams: "number", role: "core" }],
        steps: [{ text: "string", durationSeconds: "number" }],
      }),
    ).not.toThrow();
  });

  it("throws when a forbidden key is present", () => {
    expect(() => assertNoForbiddenKeys({ requirements: [{ price: 1 }] })).toThrow(
      /forbidden key/i,
    );
  });
});
