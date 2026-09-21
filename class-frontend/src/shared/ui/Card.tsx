import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../lib/cn";

export type CardTone = "default" | "primary" | "accent" | "success" | "warning" | "danger";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "article" | "section" | "div";
  tone?: CardTone;
  interactive?: boolean;
  padding?: "none" | "compact" | "default";
}

export const Card = ({
  as: Component = "section",
  tone = "default",
  interactive = false,
  padding = "default",
  className,
  children,
  ...props
}: PropsWithChildren<CardProps>) => (
  <Component
    className={cn(
      "card",
      tone !== "default" && `card-${tone}`,
      interactive && "card-interactive",
      padding !== "default" && `card-padding-${padding}`,
      className,
    )}
    {...props}
  >
    {children}
  </Component>
);
