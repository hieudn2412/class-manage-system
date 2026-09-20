import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./Button";

interface FilterDisclosureProps {
  primary: ReactNode;
  children?: ReactNode;
  activeCount?: number;
  label?: string;
  className?: string;
  defaultOpen?: boolean;
}

export const FilterDisclosure = ({
  primary,
  children,
  activeCount = 0,
  label = "Bộ lọc",
  className,
  defaultOpen = false,
}: FilterDisclosureProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  if (!children) {
    return <div className={cn("filter-disclosure", className)}>{primary}</div>;
  }

  return (
    <section className={cn("filter-disclosure", className)} aria-label={label}>
      <div className="filter-search-row">
        <div className="filter-primary">{primary}</div>
        <Button
          type="button"
          variant="secondary"
          className="filter-toggle-button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((current) => !current)}
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span>{label}</span>
          {activeCount > 0 ? (
            <span className="filter-active-count" aria-label={`${activeCount} bộ lọc đang áp dụng`}>
              {activeCount}
            </span>
          ) : null}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={open ? "filter-toggle-chevron is-open" : "filter-toggle-chevron"}
          />
        </Button>
      </div>
      {open ? (
        <div className="filter-collapse" id={id}>
          {children}
        </div>
      ) : null}
    </section>
  );
};
