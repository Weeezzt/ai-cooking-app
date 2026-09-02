import type { ReactNode } from "react";

import { SectionHead } from "./SectionHead";

export interface DecisionScreenProps {
  eyebrow: string;
  title: string;
  /** What failed, and what the app did about it. */
  body: ReactNode;
  /** Exactly the choices the user has. Never an automatic relaxation. */
  actions: ReactNode;
}

/**
 * `infeasible` and `unknown` are business results (AD-5), so they get a screen
 * that names what failed and offers a choice — not an error toast and never a
 * quietly widened constraint. Rendered instead of the result, in the same
 * editorial language, so it does not read as a crash.
 */
export function DecisionScreen({ eyebrow, title, body, actions }: DecisionScreenProps) {
  return (
    <section className="decision" aria-live="polite">
      <SectionHead eyebrow={eyebrow} title={title} titleClass="t-h2" />
      <div className="decision__body t-body">{body}</div>
      <div className="decision__actions">{actions}</div>
    </section>
  );
}
