export type Mode = "plan" | "shop" | "cook";

interface ModeMeta {
  /** The one-word mode name in condensed display caps. */
  name: string;
  /** The journey step label. */
  journey: string;
}

const MODES: Record<Mode, ModeMeta> = {
  plan: { name: "PLANERA", journey: "PLAN" },
  shop: { name: "HANDLA", journey: "HANDLA" },
  cook: { name: "LAGA", journey: "LAGA" },
};

const ORDER: Mode[] = ["plan", "shop", "cook"];

export interface ModeHeaderProps {
  mode: Mode;
}

/**
 * The element that makes PLAN — HANDLA — LAGA read as one journey: a
 * `--rule-double` header, the mode name in Archivo `wdth` 125 caps, and a
 * ground-colour shift per mode (the clearest possible signal that you have
 * entered a different room of the same store).
 */
export function ModeHeader({ mode }: ModeHeaderProps) {
  return (
    <header className={`mode-header mode-header--${mode}`}>
      <p className="mode-header__journey">
        {ORDER.map((m, i) => (
          <span key={m}>
            {i > 0 ? (
              <span className="mode-header__sep" aria-hidden="true">
                {"—"}
              </span>
            ) : null}
            <span
              className={`mode-header__step${m === mode ? " mode-header__step--active" : ""}`}
              aria-current={m === mode ? "step" : undefined}
            >
              {MODES[m].journey}
            </span>
          </span>
        ))}
      </p>
      <span className="mode-header__name t-display">{MODES[mode].name}</span>
      <hr className="rule rule--double" />
    </header>
  );
}
