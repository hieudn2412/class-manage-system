import type { ReactNode } from "react";
import { CircleAlert, Inbox, LockKeyhole } from "lucide-react";
import { Button } from "./Button";

type StateKind = "empty" | "error" | "forbidden";

interface StatePanelProps {
  kind: StateKind;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}

const icons = {
  empty: Inbox,
  error: CircleAlert,
  forbidden: LockKeyhole,
};

export const StatePanel = ({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  action,
}: StatePanelProps) => {
  const Icon = icons[kind];
  return (
    <section className="state-panel" aria-live="polite">
      <div className="state-panel-inner">
        <Icon size={34} strokeWidth={1.5} aria-hidden="true" />
        <h2>{title}</h2>
        <p>{description}</p>
        {action}
        {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
      </div>
    </section>
  );
};
