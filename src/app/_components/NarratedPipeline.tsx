export interface PipelineStage {
  /** Swedish stage label — "Tolkar din önskan". */
  label: string;
  /** Revealed detail once the stage has something to say (the store name). */
  detail?: string;
}

export interface NarratedPipelineProps {
  stages: readonly PipelineStage[];
  /** Index of the stage currently working. Stages before it are done. */
  activeIndex: number;
  /** All stages complete — the moment before the result replaces this. */
  done?: boolean;
}

const MARK = { done: "✓", active: "●", pending: "○" } as const;

/**
 * The narrated generating state (AD-3, product-ux §1.3). Deliberately **not** a
 * progress bar: a stepped sequence of rules and labels that reports *activity*,
 * never a percentage of an unknown total. Each completed stage ticks; the store
 * name arrives as a revealed detail, which is a moment rather than a loading
 * artefact.
 *
 * Props-driven: the page owns the timer, this owns nothing.
 */
export function NarratedPipeline({ stages, activeIndex, done = false }: NarratedPipelineProps) {
  return (
    <div className="pipeline" aria-live="polite" aria-busy={!done}>
      <div className="pipeline__segments" aria-hidden="true">
        {stages.map((stage, index) => (
          <span
            key={stage.label}
            className={`pipeline__segment${done || index < activeIndex ? " pipeline__segment--done" : ""}`}
          />
        ))}
      </div>
      <ol className="pipeline__list">
        {stages.map((stage, index) => {
          const state = done || index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
          return (
            <li key={stage.label} className={`pipeline__row pipeline__row--${state}`}>
              <span className="pipeline__mark t-meta" aria-hidden="true">
                {MARK[state]}
              </span>
              <span className="pipeline__label t-body">{stage.label}</span>
              {stage.detail ? (
                <span className="pipeline__detail t-meta">{stage.detail}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
