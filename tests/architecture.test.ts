import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { assertNoForbiddenKeys } from "./helpers/assertNoForbiddenKeys";

const REPO_ROOT = resolve(__dirname, "..");
const CORE_DIR = join(REPO_ROOT, "src", "core");

/** Bare-specifier prefixes that src/core must never import (AD-2). */
const FORBIDDEN_PACKAGES = [
  "openai",
  "next",
  "react",
  "react-dom",
  "zod",
  "@openai",
];

/** Alias prefixes into outward layers (AD-2). */
const FORBIDDEN_ALIASES = ["@/server", "@/app", "@/adapters"];

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

function isForbidden(spec: string, fileDir: string): boolean {
  if (FORBIDDEN_ALIASES.some((a) => spec === a || spec.startsWith(`${a}/`))) {
    return true;
  }
  if (spec.startsWith(".")) {
    const resolved = relative(REPO_ROOT, resolve(fileDir, spec));
    const outward = ["src/server", "src/app", "src/adapters"];
    return outward.some((o) => resolved === o || resolved.startsWith(`${o}/`));
  }
  // bare specifier
  if (spec.startsWith("@/")) return false; // only @/core etc. reach here
  if (spec.startsWith("node:")) return false;
  return FORBIDDEN_PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`));
}

describe("src/core import boundary (AD-2)", () => {
  const files = listFiles(CORE_DIR).filter((f) => !f.endsWith(".md"));

  it("has core source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(REPO_ROOT, f), f] as const))(
    "%s imports nothing from server/app/adapters or an external SDK",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      const offenders = importSpecifiers(source).filter((spec) =>
        isForbidden(spec, join(file, "..")),
      );
      expect(offenders).toEqual([]);
    },
  );
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
