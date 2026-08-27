/**
 * Tiny pure guards. Placeholder module so the boundary tooling has real core
 * code to scan and the unit suite has something to assert. Grows in later issues.
 */

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
