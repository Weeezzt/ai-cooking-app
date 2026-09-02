export interface StepperProps {
  legend: string;
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Rendered after the numeral, in `--muted` — "portioner". */
  unit?: string;
  caption?: string;
}

/**
 * `− 4 +` as three rule-bounded cells. One tap to adjust, 48px targets, the
 * numeral in tabular mono so it never shifts width as it changes. Not a
 * dropdown, not a pill group.
 */
export function Stepper({
  legend,
  name,
  value,
  min,
  max,
  onChange,
  unit,
  caption,
}: StepperProps) {
  const clamp = (next: number) => onChange(Math.max(min, Math.min(max, next)));

  return (
    <fieldset className="field">
      <legend className="field__label t-micro">{legend}</legend>
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          onClick={() => clamp(value - 1)}
          disabled={value <= min}
          aria-label={`Minska ${legend.toLowerCase()}`}
        >
          <span aria-hidden="true">−</span>
        </button>
        <output className="stepper__value" htmlFor={name}>
          <span className="num-l">{value}</span>
          {unit ? <span className="stepper__unit t-meta">{unit}</span> : null}
        </output>
        <button
          type="button"
          className="stepper__btn"
          onClick={() => clamp(value + 1)}
          disabled={value >= max}
          aria-label={`Öka ${legend.toLowerCase()}`}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <input type="hidden" id={name} name={name} value={value} readOnly />
      {caption ? <span className="field__caption t-meta">{caption}</span> : null}
    </fieldset>
  );
}
