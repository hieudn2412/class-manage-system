import { forwardRef, type ButtonHTMLAttributes, type PropsWithChildren } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "large" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, PropsWithChildren<ButtonProps>>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "medium",
      loading = false,
      disabled,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        "button",
        variant === "secondary" && "button-secondary",
        variant === "accent" && "button-accent",
        variant === "ghost" && "button-ghost",
        variant === "danger" && "button-danger",
        size !== "medium" && `button-${size}`,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
