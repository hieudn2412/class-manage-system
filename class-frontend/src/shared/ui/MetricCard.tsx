import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Card, type CardTone } from "./Card";

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: CardTone;
  className?: string;
}

export const MetricCard = ({
  label,
  value,
  detail,
  icon,
  tone = "primary",
  className,
}: MetricCardProps) => (
  <Card as="article" tone={tone} className={cn("metric-card-shared", className)}>
    <div className="metric-card-shared-head">
      <span className="metric-card-shared-label">{label}</span>
      {icon ? <span className="metric-card-shared-icon">{icon}</span> : null}
    </div>
    <strong className="metric-card-shared-value">{value}</strong>
    {detail ? <span className="metric-card-shared-detail">{detail}</span> : null}
  </Card>
);
