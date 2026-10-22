"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "@/components/icons";

/** Filter pill in the sale-target style ("Label: value ▾"); single or multi select. */
export function FilterSelect({
  label,
  options,
  selected,
  onChange,
  multiple = false,
  searchable = false,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const shown = searchable && q.trim() ? options.filter((o) => deaccent(o).includes(deaccent(q.trim()))) : options;
  const summary = selected.length === 0 ? "tất cả" : selected.length === 1 ? selected[0] : `${selected.length} mục`;

  function pick(v: string) {
    if (!multiple) {
      onChange(selected[0] === v ? [] : [v]);
      setOpen(false);
      return;
    }
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  return (
    <div ref={boxRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[240px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <span className="shrink-0 text-slate-400">{label}:</span>
        <span className={`truncate ${selected.length ? "font-medium text-blue-700" : "text-slate-600"}`}>{summary}</span>
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] max-w-[320px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {searchable && (
            <div className="px-2 pb-1.5 pt-0.5">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                placeholder="Tìm…"
                className="w-full rounded border border-slate-200 px-2 py-1 text-[12px] outline-none focus:border-blue-500"
              />
            </div>
          )}
          <div
            onClick={() => {
              onChange([]);
              if (!multiple) setOpen(false);
            }}
            className={`cursor-pointer border-b border-slate-100 px-3 py-1.5 text-[13px] ${selected.length === 0 ? "font-medium text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            Tất cả (bỏ lọc)
          </div>
          <div className="scroll-shadow max-h-[260px] overflow-y-auto">
            {shown.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-slate-400">Không có mục</div>
            ) : (
              shown.map((o) => {
                const on = selected.includes(o);
                return (
                  <div
                    key={o}
                    onClick={() => pick(o)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] ${on ? "bg-blue-50/60 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${multiple ? "rounded" : "rounded-full"} ${on ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300"}`}
                    >
                      {on ? <Check size={11} /> : null}
                    </span>
                    <span className="truncate">{o}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
