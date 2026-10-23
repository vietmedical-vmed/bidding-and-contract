"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterSelect } from "@/components/FilterSelect";
import { MissingInfoButton } from "@/components/MissingInfo";
import { parseFilters, type FilterOptions } from "@/lib/bids";
import { useApi } from "@/lib/useApi";

/** Filter row of the bidding pages: năm, BU, nhóm SP, miền, sale, kept in the URL. */
export function BidFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = parseFilters(params);
  const options = useApi<{ options: FilterOptions }>("filter-options", {});
  const opts = options.data?.options;

  function setFilter(key: string, values: string[]) {
    const next = new URLSearchParams(params);
    next.delete(key);
    values.forEach((v) => next.append(key, v));
    next.delete("page"); // any filter change starts from page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  // "Bỏ lọc" returns to the defaults, including the latest year.
  const hasFilter = Boolean(f.nam || f.bu || f.sale || f.nhom.length || f.mien.length);

  if (!opts) return <span className="text-[12px] text-slate-400">{options.error ?? "Đang tải bộ lọc…"}</span>;
  return (
    <>
      <FilterSelect
        label="Năm"
        options={opts.nam.map(String)}
        // No year in the URL means the latest year (the API applies the same default).
        selected={f.nam === "all" ? [] : [String(f.nam ?? opts.nam[0] ?? "")].filter(Boolean)}
        onChange={(v) => setFilter("nam", v.length ? v : ["all"])}
      />
      <FilterSelect label="BU" options={opts.bu} selected={f.bu ? [f.bu] : []} onChange={(v) => setFilter("bu", v)} />
      <FilterSelect
        label="Nhóm SP"
        multiple
        options={opts.nhom_san_pham}
        selected={f.nhom}
        onChange={(v) => setFilter("nhom", v)}
      />
      {opts.mien.length > 1 && (
        <FilterSelect label="Miền" multiple options={opts.mien} selected={f.mien} onChange={(v) => setFilter("mien", v)} />
      )}
      <FilterSelect
        label="Sale"
        searchable
        options={opts.sale}
        selected={f.sale ? [f.sale] : []}
        onChange={(v) => setFilter("sale", v)}
      />
      {hasFilter && (
        <button type="button" onClick={() => router.push(pathname)} className="px-1 text-[13px] text-blue-600 hover:underline">
          Bỏ lọc
        </button>
      )}
      <div className="flex-1" />
      <MissingInfoButton filters={f} />
    </>
  );
}
