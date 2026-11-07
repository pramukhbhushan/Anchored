import Link from "next/link";
import type { ComponentProps } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// Anchored's buttons. `buttonClass` builds the class string, so components
// that render their own `<button>` (such as `ChooseButton`) match exactly;
// `Button` is a plain `<button>` and `ButtonLink` a Next `Link` styled the same.

/** Primary is solid ink, secondary is outlined, quiet is a link-styled text button. */
export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "md" | "sm";

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
  primary: "btn",
  secondary: "btn btn-secondary",
  quiet: "btn btn-quiet",
};

/** Return the class string for a button of `variant` and `size`, plus any `extra` classes. */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string): string {
  return [VARIANT_CLASS[variant], size === "sm" ? "btn-sm" : "", extra ?? ""].filter(Boolean).join(" ");
}

interface StyleProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

/** Render a `<button>`, `type="button"` unless told otherwise. React 19 passes `ref` through as a prop. */
export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: StyleProps & ComponentProps<"button">) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

/** Render a Next `Link` that looks like a button. */
export function ButtonLink({ variant, size, className, ...rest }: StyleProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
