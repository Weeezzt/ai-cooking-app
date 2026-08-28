import type { ComponentProps } from "react";

export type RuleWeight = "hair" | "mid" | "heavy" | "double" | "receipt";

const CLASS: Record<RuleWeight, string> = {
  hair: "rule rule--hair",
  mid: "rule rule--mid",
  heavy: "rule rule--heavy",
  double: "rule rule--double",
  receipt: "rule rule--receipt",
};

export interface RuleProps extends Omit<ComponentProps<"hr">, "className"> {
  /** The five structural weights from visual-direction §4.3. */
  weight?: RuleWeight;
  className?: string;
}

/**
 * The primary structural device. Rules run the full width of their container,
 * edge to edge — never inset, never faded, never gradient. A rule belongs to the
 * thing above it.
 */
export function Rule({ weight = "hair", className, ...rest }: RuleProps) {
  const cls = CLASS[weight];
  return <hr {...rest} className={className ? `${cls} ${className}` : cls} />;
}
