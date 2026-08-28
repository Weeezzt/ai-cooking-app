import type { ComponentProps } from "react";

export type ButtonVariant = "solid" | "outline" | "text";

export interface ButtonProps extends Omit<ComponentProps<"button">, "className"> {
  variant?: ButtonVariant;
  /** Full-width block button (bottom bars, COOK). */
  block?: boolean;
  /** 56px min height instead of 48 — the dirty-hands target in COOK. */
  cook?: boolean;
  className?: string;
}

/**
 * Three variants, zero radius (§5.5):
 *  - solid   — `--accent` fill, one per view
 *  - outline — 1px `--rule-strong`, border → `--ink` on hover
 *  - text    — `--ink` with a 2px `--accent` underline
 *
 * Labels are Swedish imperative verbs. No icon-only buttons.
 */
export function Button({
  variant = "outline",
  block = false,
  cook = false,
  type,
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    `btn--${variant}`,
    block ? "btn--block" : "",
    cook ? "btn--cook" : "",
    variant === "solid" ? "on-accent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button {...rest} type={type ?? "button"} className={cls} />;
}
