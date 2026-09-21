import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  compact?: boolean;
}

export const PageHeader = ({
  eyebrow,
  title,
  subtitle,
  actions,
  compact = false,
}: PageHeaderProps) => (
  <header className={compact ? "page-header page-header-compact" : "page-header"}>
    <div>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="page-title">{title}</h1>
      {subtitle ? <p className="subtitle">{subtitle}</p> : null}
    </div>
    {actions ? <div className="page-actions">{actions}</div> : null}
  </header>
);
