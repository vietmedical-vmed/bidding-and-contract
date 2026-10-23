"use client";

import Link from "next/link";
import { fmtInt } from "@/lib/bids";
import { fmtDate, STATUSES, usedPct, type StatusKey, type Summary } from "@/lib/contracts";

const PARTS = STATUSES.filter((s) => s.key !== "all");

/** Headline card: contracts of the fiscal year, split by status (same layout as WinRateCard). */
export function ContractTotalCard({ summary }: { summary: Summary }) {
  const total = summary.total_contracts || 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] tracking-wide text-slate-400">
        <span>Hợp đồng năm tài chính {summary.fy_label}</span>
        {summary.last_invoice_date && (
          <span>
            Dữ liệu bán hàng cập nhật đến ngày <b className="font-bold text-slate-700">{fmtDate(summary.last_invoice_date)}</b>
          </span>
        )}
      </div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-slate-800">Tổng hợp đồng theo dõi</span>
        <span className="text-[22px] font-bold tabular-nums text-blue-600">{fmtInt(total)}</span>
      </div>
      <div className="mb-1.5 flex h-3.5 gap-px overflow-hidden rounded bg-slate-100">
        {total > 0 &&
          PARTS.map((s) =>
            summary[s.count] > 0 ? (
              <div
                key={s.key}
                className={s.swatch}
                style={{ flexGrow: summary[s.count], flexBasis: 0 }}
                title={`${s.label}: ${fmtInt(summary[s.count])}`}
              />
            ) : null,
          )}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        {PARTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-sm ${s.swatch}`} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** One StatCard per status; each opens the contract list filtered by that status. */
export function StatusCards({ summary, hrefFor }: { summary: Summary; hrefFor: (key: StatusKey) => string }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {PARTS.map((s) => (
        <Link
          key={s.key}
          href={hrefFor(s.key)}
          className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-wide text-slate-400">
            <span className={`h-2 w-2 rounded-sm ${s.swatch}`} aria-hidden />
            {s.label}
          </div>
          <div className="text-[20px] font-bold tabular-nums text-slate-800">{fmtInt(summary[s.count] ?? 0)}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{s.sub}</div>
        </Link>
      ))}
    </div>
  );
}

/** Segmented status filter of the list page (same control as the Kết quả filter on Chi tiết mặt hàng). */
export function StatusTabs({
  active,
  summary,
  hrefFor,
}: {
  active: StatusKey;
  summary: Summary | null;
  hrefFor: (key: StatusKey) => string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
      {STATUSES.map((s) => {
        const on = s.key === active;
        return (
          <Link
            key={s.key}
            href={hrefFor(s.key)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] ${on ? "bg-blue-500 font-medium text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {s.label}
            {summary && (
              <span className={`tabular-nums text-[11px] ${on ? "text-blue-100" : "text-slate-400"}`}>{fmtInt(summary[s.count] ?? 0)}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

const BADGE = {
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  grey: "bg-slate-100 text-slate-500 border-slate-200",
};

export function Badge({ tone, children }: { tone: keyof typeof BADGE; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium ${BADGE[tone]}`}>{children}</span>
  );
}

/** Days until the contract ends: grey once expired, red ≤ 15, amber ≤ 30, plain text otherwise. */
export function DaysBadge({ days }: { days: number | null }) {
  if (days === null || days === undefined) return <span className="text-slate-400">—</span>;
  if (days < 0) return <Badge tone="grey">Hết hạn</Badge>;
  if (days <= 30) return <Badge tone={days <= 15 ? "red" : "amber"}>{days} ngày</Badge>;
  return <span className="tabular-nums text-slate-600">{days} ngày</span>;
}

/** Sold share of the contract quantity: red ≥ 90 %, amber ≥ 70 %, brand blue below. */
export function UsageBar({ item }: { item: { so_luong_hd: number | null; so_luong_con_lai: number | null } }) {
  const pct = usedPct(item);
  if (pct === null) return <span className="text-slate-400">—</span>;
  const bar = pct >= 90 ? "bg-lost" : pct >= 70 ? "bg-amber-500" : "bg-won";
  return (
    <div className="flex min-w-[110px] items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-slate-100">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-[12px] font-semibold tabular-nums text-slate-800">{pct}%</span>
    </div>
  );
}
