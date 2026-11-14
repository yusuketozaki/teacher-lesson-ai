"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";

interface DiscardDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-page confirmation shown before discarding goals or plans.
 * Focus moves into it on open; Escape or the cancel button cancels.
 * The caller makes the rest of the workflow inert while it is open.
 */
export function DiscardDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
}: DiscardDialogProps) {
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="dialog-backdrop">
      <div
        className="discard-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        onKeyDown={handleKeyDown}
      >
        <p className="dialog-title" id={`${id}-title`}>
          {title}
        </p>
        <p id={`${id}-message`}>{message}</p>
        <div className="button-row">
          <button type="button" className="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
