"use client";

import Link from "next/link";
import { fmtInt } from "@/lib/bids";
import { MIEN_TABS, STATUSES, usedPct, type StatusKey, type Summary } from "@/lib/contracts";

const COLOR: Record<(typeof STATUSES)[number]["color"], { card: string; value: string; ring: string }> = {
  blue: { card: "border-l-blue-500", value: "text-blue-500", ring: "ring-blue-500" },
  green: { card: "border-l-green-500", value: "text-green-600", ring: "ring-green-500" },
  amber: { card: "border-l-amber-500", value: "text-amber-500", ring: "ring-amber-500" },
  gray: { card: "border-l-gray-500", value: "text-gray-500", ring: "ring-gray-500" },
  violet: { card: "border-l-violet-500", value: "text-violet-500", ring: "ring-violet-500" },
};

/** The five fiscal-year counts; each card links to the contract list filtered by that status. */
export function KpiCards({
  summary,
  active,
  hrefFor,
}: {
  summary: Summary;
  active?: StatusKey;
  hrefFor: (key: StatusKey) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {STATUSES.map((s) => {
        const c = COLOR[s.color];
        const on = active === s.key;
        const dim = active !== undefined && active !== "all" && !on;
        return (
          <Link
            key={s.key}
            href={hrefFor(s.key)}
            className={`rounded-xl border border-l-4 border-slate-200 bg-white p-3.5 transition hover:shadow-md ${c.card} ${on && s.key !== "all" ? `ring-2 ${c.ring}` : ""} ${dim ? "opacity-50" : ""}`}
          >
            <div className="text-[11px] tracking-wide text-slate-500">{s.label}</div>
            <div className={`mt-0.5 text-[22px] font-bold tabular-nums ${c.value}`}>{fmtInt(summary[s.count] ?? 0)}</div>
            <div className="mt-0.5 text-[11px] text-slate-400">{s.sub(summary.fy_label)}</div>
          </Link>
        );
      })}
    </div>
  );
}

/** Miền Bắc / Miền Nam tabs with the contract count of each. */
export function MienTabs({
  active,
  counts,
  hrefFor,
}: {
  active: string;
  counts: Partial<Record<string, number>>;
  hrefFor: (mien: string) => string;
}) {
  return (
    <div className="flex">
      {MIEN_TABS.map((m) => {
        const on = m === active;
        return (
          <Link
            key={m}
            href={hrefFor(m)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium ${on ? "border-blue-500 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {m}
            {counts[m] !== undefined && (
              <span className={`ml-1.5 text-[12px] font-normal ${on ? "text-blue-600" : "text-slate-400"}`}>({fmtInt(counts[m])})</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** Days until the contract ends: grey once expired, red ≤ 15, amber ≤ 30, green otherwise. */
export function DaysBadge({ days }: { days: number | null }) {
  if (days === null || days === undefined) return <span className="text-slate-400">—</span>;
  if (days < 0) return <span className="rounded-full bg-gray-500 px-2 py-0.5 text-[11px] font-medium text-white">Hết hạn</span>;
  if (days <= 30) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${days <= 15 ? "bg-red-500" : "bg-amber-500"}`}>
        {days} ngày
      </span>
    );
  }
  return <span className="text-[12px] font-medium text-green-600">{days} ngày</span>;
}

/** Sold share of the contract quantity: red ≥ 90 %, amber ≥ 70 %, green below. */
export function UsageBar({ item }: { item: { so_luong_hd: number | null; so_luong_con_lai: number | null } }) {
  const pct = usedPct(item);
  if (pct === null) return <span className="text-slate-400">—</span>;
  const [bar, text] =
    pct >= 90 ? ["bg-red-500", "text-red-600"] : pct >= 70 ? ["bg-amber-500", "text-amber-600"] : ["bg-green-500", "text-green-600"];
  return (
    <div className="flex min-w-[90px] items-center gap-1.5">
      <div className="h-1.5 flex-1 rounded bg-slate-100">
        <div className={`h-1.5 rounded ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`whitespace-nowrap text-[11px] font-medium ${text}`}>{pct}%</span>
    </div>
  );
}
