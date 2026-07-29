import type { PropsWithChildren } from "react";
import { cn } from "../lib/cn";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export const Badge = ({ children, tone = "neutral" }: PropsWithChildren<{ tone?: BadgeTone }>) => (
  <span className={cn("badge", `badge-${tone}`)}>{children}</span>
);
