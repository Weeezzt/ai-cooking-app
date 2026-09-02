import type { ReactNode } from "react";

export interface CookStepProps {
  /** 1-based index of this step. */
  step: number;
  /** Total step count — drives the segmented progress strip. */
  total: number;
  /** This step's ingredients, one mono line separated by thin `|`. */
  ingredients?: string[];
  /**
   * The instruction. Durations / temperatures should be wrapped in
   * `<span className="q">…</span>` by the caller so they render in mono accent.
   */
  instruction: ReactNode;
}

/**
 * COOK step — one instruction fills the screen, two levels of hierarchy maximum.
 * Shell only: no timer / advance behaviour (filled by COOK, #10). The ghost step
 * numeral is line-work (`-webkit-text-stroke`), not a tinted fill, so it reads as
 * intentional at any luminance (visual-critique SHOULD-FIX-6).
 */
export function CookStep({ step, total, ingredients = [], instruction }: CookStepProps) {
  return (
    <article className="cook-step">
      <div
        className="cook-step__progress"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`cook-step__progress-seg${i < step - 1 ? " cook-step__progress-seg--done" : ""}${i === step - 1 ? " cook-step__progress-seg--active" : ""}`}
          />
        ))}
      </div>

      <span className="cook-step__ghost" aria-hidden="true">
        {step}
      </span>
      <span className="cook-step__count t-micro">
        Steg {step} av {total}
      </span>

      {ingredients.length > 0 ? (
        <p className="cook-step__ingredients t-meta">
          {ingredients.map((item, i) => (
            <span key={i}>
              {i > 0 ? (
                <span className="sep" aria-hidden="true">
                  |
                </span>
              ) : null}
              {item}
            </span>
          ))}
        </p>
      ) : null}

      <p className="cook-step__instruction">{instruction}</p>
    </article>
  );
}
