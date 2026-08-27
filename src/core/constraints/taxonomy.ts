/**
 * Constraint feasibility taxonomy (AD-5).
 *
 * Every check is exactly one of:
 *   - `verified`   — deterministic from trusted facts (budget in öre, portions
 *                    equality, distance from resolved coords). Real pass/fail.
 *   - `estimated`  — model/heuristic estimate (cook time, nutrition on partial
 *                    coverage). Shown with `ca` + a coverage note, never hard red.
 *   - `unsupported`— cannot be established from available data (allergen safety,
 *                    detailed dietary guarantees). Never a green pass.
 */

import type { EvidenceClass } from "../types";

export type ConstraintKind =
  | "budget"
  | "portions"
  | "distance"
  | "cook_time"
  | "nutrition"
  | "dietary"
  | "allergy";

const EVIDENCE: Record<ConstraintKind, EvidenceClass> = {
  budget: "verified",
  portions: "verified",
  distance: "verified",
  cook_time: "estimated",
  nutrition: "estimated",
  dietary: "unsupported",
  allergy: "unsupported",
};

export function evidenceClassFor(kind: ConstraintKind): EvidenceClass {
  return EVIDENCE[kind];
}
