"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterOptions } from "@/lib/bids";

const FIELDS: { key: string; label: string; option: keyof FilterOptions; all: string }[] = [
  { key: "nam", label: "Năm", option: "nam", all: "Tất cả năm" },
  { key: "bu", label: "BU", option: "bu", all: "Tất cả BU" },
  { key: "nhom", label: "Nhóm sản phẩm", option: "nhom_san_pham", all: "Tất cả nhóm" },
  { key: "mien", label: "Miền", option: "mien", all: "Tất cả miền" },
  { key: "sale", label: "Sale", option: "sale", all: "Tất cả sale" },
];

export function FilterBar({ options, children }: { options: FilterOptions; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // any filter change starts from page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  const active = FIELDS.some((f) => params.get(f.key));

  return (
    <div className="flex flex-wrap items-end gap-3">
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-xs text-ink-2">
          {f.label}
          <select
            className="input min-w-36"
            value={params.get(f.key) ?? ""}
            onChange={(e) => update(f.key, e.target.value)}
          >
            <option value="">{f.all}</option>
            {options[f.option].map((v) => (
              <option key={String(v)} value={String(v)}>
                {String(v)}
              </option>
            ))}
          </select>
        </label>
      ))}
      {children}
      {active && (
        <button
          type="button"
          className="pb-2 text-sm text-accent hover:underline"
          onClick={() => {
            const next = new URLSearchParams(params);
            FIELDS.forEach((f) => next.delete(f.key));
            next.delete("page");
            router.push(`${pathname}?${next.toString()}`);
          }}
        >
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}
