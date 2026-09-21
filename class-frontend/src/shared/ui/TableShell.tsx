import type { PropsWithChildren } from "react";
import { cn } from "../lib/cn";

interface TableShellProps {
  className?: string;
  scrollable?: boolean;
}

export const TableShell = ({
  className,
  scrollable = true,
  children,
}: PropsWithChildren<TableShellProps>) => (
  <div className={cn("table-shell", scrollable && "table-shell-scrollable", className)}>
    {children}
  </div>
);
