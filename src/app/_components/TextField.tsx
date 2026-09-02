import type { ReactNode } from "react";

export interface TextFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Multiline prose (vibe, dislikes). Rows default to 3. */
  multiline?: boolean;
  rows?: number;
  inputMode?: "text" | "decimal" | "numeric";
  /** Trailing unit inside the field frame, in `--muted` — "kr". */
  suffix?: string;
  caption?: ReactNode;
  maxLength?: number;
}

/**
 * The one place a radius is allowed: 2px optical softening on a text field
 * (visual-direction §4.4). 16px font floor so iOS never zooms the form. Label is
 * the uppercase mono micro line, not a floating placeholder.
 */
export function TextField({
  label,
  name,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  inputMode,
  suffix,
  caption,
  maxLength,
}: TextFieldProps) {
  return (
    <div className="field">
      <label className="field__label t-micro" htmlFor={name}>
        {label}
      </label>
      <div className={`field__frame${suffix ? " field__frame--suffixed" : ""}`}>
        {multiline ? (
          <textarea
            id={name}
            name={name}
            className="field__input"
            rows={rows}
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            id={name}
            name={name}
            className="field__input"
            type="text"
            inputMode={inputMode}
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        {suffix ? (
          <span className="field__suffix t-meta" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
      </div>
      {caption ? <span className="field__caption t-meta">{caption}</span> : null}
    </div>
  );
}
