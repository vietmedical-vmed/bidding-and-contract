"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/icons";

/** Same dialog as sale-target's Modal: dimmed backdrop, title bar, Esc / click outside closes. */
export function Modal({
  open,
  onClose,
  title,
  icon,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: "100%" }}
        className="rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          {icon}
          <span className="text-[14px] font-semibold text-slate-800">{title}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            title="Đóng"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <XIcon size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
