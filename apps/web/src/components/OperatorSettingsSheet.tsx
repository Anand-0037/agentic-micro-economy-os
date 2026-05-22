import { useEffect } from "react";

import { OperatorSettingsPanel } from "./OperatorSettingsPanel";

type OperatorSettingsSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function OperatorSettingsSheet({ open, onClose }: OperatorSettingsSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full flex-col border-l border-border bg-surface shadow-xl sm:max-w-md"
        role="dialog"
        aria-labelledby="settings-sheet-title"
        aria-describedby="settings-sheet-desc"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="settings-sheet-title" className="font-display text-lg font-semibold text-ink">
              Settings
            </h2>
            <p id="settings-sheet-desc" className="mt-1 text-sm text-muted">
              Operator overrides. Changes apply to this browser only.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary flex h-9 w-9 shrink-0 items-center justify-center p-0 text-lg"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <OperatorSettingsPanel active={open} />
        </div>
      </aside>
    </div>
  );
}
