export interface SelectorOption {
  /** Submitted value. */
  value: string;
  /** Visible label — already `sv-SE` formatted where it is a number. */
  label: string;
}

export interface SelectorStripProps {
  /** Uppercase mono label above the strip. */
  legend: string;
  name: string;
  options: readonly SelectorOption[];
  value: string;
  onChange: (value: string) => void;
  /** Live derived caption under the strip ("≈ 62 kr/portion"). */
  caption?: string;
}

/**
 * A rule-bounded selector strip — the zero-radius replacement for a row of
 * `9999px` pills (design-system.md, mandatory change 3). One full-width band
 * bounded above and below by `--rule-hair`, cells separated by 1px vertical
 * rules, the selected cell carrying a 2px `--accent` underline and `--ink`.
 * No fill, no radius, no shadow.
 */
export function SelectorStrip({
  legend,
  name,
  options,
  value,
  onChange,
  caption,
}: SelectorStripProps) {
  return (
    <fieldset className="field">
      <legend className="field__label t-micro">{legend}</legend>
      <div className="selector-strip scroll-x" role="radiogroup" aria-label={legend}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className={`selector-strip__cell${option.value === value ? " selector-strip__cell--on" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={value} readOnly />
      {caption ? <span className="field__caption t-meta">{caption}</span> : null}
    </fieldset>
  );
}
