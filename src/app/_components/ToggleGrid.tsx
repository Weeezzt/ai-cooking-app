export interface ToggleOption {
  id: string;
  label: string;
}

export interface ToggleGridProps {
  legend: string;
  options: readonly ToggleOption[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  caption?: string;
}

/**
 * A multi-select as a grid of rule-bounded cells — dietary toggles, the pantry
 * staples list. Square, zero radius, separated by hairlines rather than gaps, so
 * it reads as a printed checklist and not a chip cloud. The selected cell
 * inverts to paper-white, which is the same signal the SHOP section bars use.
 */
export function ToggleGrid({
  legend,
  options,
  selected,
  onToggle,
  caption,
}: ToggleGridProps) {
  return (
    <fieldset className="field">
      <legend className="field__label t-micro">{legend}</legend>
      <div className="toggle-grid">
        {options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="switch"
              aria-checked={on}
              className={`toggle-grid__cell${on ? " toggle-grid__cell--on" : ""}`}
              onClick={() => onToggle(option.id)}
            >
              <span className="toggle-grid__mark" aria-hidden="true">
                {on ? "✓" : "+"}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
      {caption ? <span className="field__caption t-meta">{caption}</span> : null}
    </fieldset>
  );
}
