import { useEffect, useRef, type PropsWithChildren } from "react";
import { Button, type ButtonVariant } from "./Button";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  className?: string;
  confirmLabel?: string;
  closeLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmVariant?: ButtonVariant;
}

export const Modal = ({
  open,
  title,
  onClose,
  className,
  confirmLabel,
  closeLabel = "Hủy",
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false,
  confirmVariant = "primary",
  children,
}: PropsWithChildren<ModalProps>) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusableElements.length) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={["modal", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
        </header>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <Button ref={closeRef} variant="secondary" onClick={onClose}>
            {closeLabel}
          </Button>
          {confirmLabel && onConfirm ? (
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={confirmDisabled}
              loading={confirmLoading}
            >
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
};
