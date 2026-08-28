/**
 * The engine never calls `Date.now()` (engineering-rules "Boundaries"). Time is
 * an injected capability: `ctx.clock`.
 */

export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
  /** ISO-8601 string for the current instant (used in `Provenance`). */
  nowIso(): string;
}

/** A frozen clock for deterministic tests and the golden pipeline run. */
export class FixedClock implements Clock {
  private readonly epochMs: number;

  constructor(instant: string | number = "2026-08-27T09:00:00.000Z") {
    this.epochMs = typeof instant === "number" ? instant : Date.parse(instant);
    if (!Number.isFinite(this.epochMs)) {
      throw new RangeError(`FixedClock: unparseable instant ${JSON.stringify(instant)}`);
    }
  }

  now(): number {
    return this.epochMs;
  }

  nowIso(): string {
    return new Date(this.epochMs).toISOString();
  }
}

/** Shared per-request context threaded through the whole pipeline (AD-3). */
export interface PipelineContext {
  readonly clock: Clock;
  /** Absolute epoch-ms deadline. Retries share it; it is never reset (AD-3). */
  readonly deadlineAt: number;
}

/** `true` once the shared deadline has passed. */
export function isPastDeadline(ctx: PipelineContext): boolean {
  return ctx.clock.now() >= ctx.deadlineAt;
}
