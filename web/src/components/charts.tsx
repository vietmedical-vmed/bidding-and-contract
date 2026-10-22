import Link from "next/link";
import { fmtInt, fmtPct, fmtVnd, valueWinRate, winRate, type KpiRow } from "@/lib/bids";

/* Outcome series in fixed order. "Chưa có KQ" also covers cancelled packages. */
const SERIES = [
  { key: "trung", label: "Trúng", color: "bg-won" },
  { key: "truot", label: "Trượt", color: "bg-lost" },
  { key: "pending", label: "Chưa có KQ", color: "bg-pending" },
] as const;

function parts(r: KpiRow) {
  return { trung: r.trung, truot: r.truot, pending: r.cho_kq + r.huy };
}

export function Legend() {
  return (
    <div className="flex gap-3 text-[11px] text-slate-500">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** KPI card (sale-target StatBars style). */
export function StatCard({ label, value, sub, swatch }: { label: string; value: string; sub?: string; swatch?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-wide text-slate-400">
        {swatch && <span className={`h-2 w-2 rounded-sm ${swatch}`} aria-hidden />}
        {label}
      </div>
      <div className="text-[20px] font-bold tabular-nums text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

/** Headline win rate with a progress bar (sale-target "% Thực hiện" card). */
export function WinRateCard({ r, updatedAt }: { r: KpiRow; updatedAt: string | null }) {
  const rate = winRate(r);
  const pct = rate === null ? 0 : Math.round(rate * 1000) / 10;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] tracking-wide text-slate-400">
        <span>Tỷ lệ trúng thầu</span>
        {updatedAt && (
          <span>
            Dữ liệu cập nhật đến ngày <b className="font-bold text-slate-700">{updatedAt}</b>
          </span>
        )}
      </div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-slate-800">
          {fmtInt(r.trung)} / {fmtInt(r.trung + r.truot)} gói thầu có kết quả
        </span>
        <span className="text-[22px] font-bold tabular-nums text-blue-600">{fmtPct(rate)}</span>
      </div>
      <div className="mb-1.5 h-3.5 overflow-hidden rounded bg-slate-100">
        <div className="h-full rounded bg-won" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[11px] text-slate-400">
        Gói trúng = trúng ít nhất 1 mặt hàng. Theo giá trị dự thầu:{" "}
        <b className="font-medium text-slate-500">{fmtPct(valueWinRate(r))}</b>
      </div>
    </div>
  );
}

/** Card with a title strip, like the tables in sale-target. */
export function Panel({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * Ranking: tỷ lệ trúng ↓, then giá trị dự thầu ↓, then giá trị trúng ↓.
 * Rows without a rate (no package decided yet) and the "(Chưa phân loại)"-style bucket go last.
 */
function rankRows(rows: KpiRow[]): KpiRow[] {
  const rate = (r: KpiRow) => winRate(r) ?? -1;
  return [...rows].sort(
    (a, b) =>
      Number(a.grp === null) - Number(b.grp === null) ||
      rate(b) - rate(a) ||
      b.gia_tri_du_thau - a.gia_tri_du_thau ||
      b.gia_tri_du_thau_trung - a.gia_tri_du_thau_trung,
  );
}

/** Breakdown table: one row per segment, with the outcome split drawn as a small stacked bar. */
export function BreakdownTable({
  rows,
  dimension,
  hrefFor,
  emptyLabel = "(Chưa phân loại)",
}: {
  rows: KpiRow[];
  dimension: string;
  hrefFor?: (grp: string) => string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.goi));
  const ranked = rankRows(rows);
  return (
    <div className="scroll-shadow overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 text-left font-semibold">{dimension}</th>
            <th className="px-2 py-2 text-left font-semibold">Gói thầu</th>
            <th className="px-2 py-2 text-right font-semibold">Trúng</th>
            <th className="px-2 py-2 text-right font-semibold">Trượt</th>
            <th className="px-2 py-2 text-right font-semibold">Chưa KQ</th>
            <th className="px-2 py-2 text-right font-semibold">Tỷ lệ trúng</th>
            <th className="px-2 py-2 text-right font-semibold">Giá trị dự thầu</th>
            <th className="px-4 py-2 text-right font-semibold">Giá trị trúng</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => {
            const p = parts(r);
            const label = r.grp ?? emptyLabel;
            return (
              <tr key={label} className={`${i % 2 ? "bg-slate-50/50" : "bg-white"} hover:bg-blue-50/40`}>
                <td className="max-w-[220px] truncate px-4 py-1.5" title={label}>
                  {hrefFor && r.grp ? (
                    <Link href={hrefFor(r.grp)} className="text-slate-800 hover:text-blue-600 hover:underline">
                      {label}
                    </Link>
                  ) : (
                    <span className={r.grp ? "text-slate-800" : "italic text-slate-400"}>{label}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-2.5 gap-px overflow-hidden rounded-sm"
                      style={{ width: `${Math.max(4, (r.goi / max) * 120)}px` }}
                      title={`Trúng ${p.trung} · Trượt ${p.truot} · Chưa KQ ${p.pending}`}
                    >
                      {SERIES.map((s) =>
                        p[s.key] > 0 ? (
                          <div key={s.key} className={s.color} style={{ flexGrow: p[s.key], flexBasis: 0 }} />
                        ) : null,
                      )}
                    </div>
                    <span className="tabular-nums text-slate-600">{fmtInt(r.goi)}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmtInt(r.trung)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmtInt(r.truot)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{fmtInt(p.pending)}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-800">{fmtPct(winRate(r))}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{fmtVnd(r.gia_tri_du_thau)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums text-slate-600">{fmtVnd(r.gia_tri_du_thau_trung)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                Không có dữ liệu
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Each sheet is a fiscal year: T4 of year N through T3 of year N+1.
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const RATE_LINE = "#3a3b3c"; // neutral ink: the rate is not one of the outcome series

/**
 * Win-rate line by month, in its own 0–100% band above the columns (one scale per chart,
 * never a second y-axis). Months are slots of a 12-column grid, aligned with MonthColumns.
 */
function MonthRateLine({ rows }: { rows: KpiRow[] }) {
  const byMonth = new Map(rows.map((r) => [Number(r.grp), r]));
  const points = FISCAL_MONTHS.map((m, i) => {
    const r = byMonth.get(m);
    const rate = r ? winRate(r) : null;
    return rate === null ? null : { x: ((i + 0.5) / 12) * 100, y: (1 - rate) * 100, rate, m };
  });
  // Months with no decided package break the line instead of being drawn as 0%.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const pt of points) {
    if (pt) current.push(pt);
    else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);

  return (
    <div className="flex gap-2">
      <div className="relative h-20 w-8 text-right text-[11px] tabular-nums text-slate-400">
        {[0, 50, 100].map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${t}%` }}>
            {t}%
          </span>
        ))}
      </div>
      <div className="relative h-20 flex-1">
        {[0, 50, 100].map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${t}%` }} />
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {segments.map((seg, i) => (
            <polyline
              key={i}
              points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={RATE_LINE}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {points.map((p) =>
          p ? (
            <div key={p.m} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <span
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                style={{ background: RATE_LINE }}
                title={`Tháng ${p.m}: ${fmtPct(p.rate)}`}
              />
              <span className="absolute -translate-x-1/2 -translate-y-[150%] whitespace-nowrap text-[10px] font-semibold tabular-nums text-slate-700">
                {fmtPct(p.rate)}
              </span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Stacked columns by month (T4 → T3), Trúng at the baseline, total packages on top. */
export function MonthColumns({ rows }: { rows: KpiRow[] }) {
  const byMonth = new Map(rows.map((r) => [Number(r.grp), r]));
  const ticks = niceTicks(Math.max(1, ...rows.map((r) => r.goi)));
  const top = ticks[ticks.length - 1];
  const stackOrder = [...SERIES].reverse();

  return (
    <div className="space-y-1 px-4 pb-3 pt-6">
      <div className="flex items-center gap-1.5 pl-10 text-[11px] text-slate-500">
        <span className="inline-block h-0.5 w-4 rounded" style={{ background: RATE_LINE }} aria-hidden />
        Tỷ lệ trúng (gói trúng / gói đã có kết quả)
      </div>
      <div className="pt-5">
        <MonthRateLine rows={rows} />
      </div>
      <div className="flex gap-2 pt-8">
        <div className="relative h-44 w-8 text-right text-[11px] tabular-nums text-slate-400">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {fmtInt(t)}
            </span>
          ))}
        </div>
        <div className="flex-1">
          <div className="relative h-44 border-b border-slate-300">
            {ticks.slice(1).map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-0 grid grid-cols-12 items-end">
              {FISCAL_MONTHS.map((m) => {
                const r = byMonth.get(m);
                if (!r) return <div key={m} />;
                const p = parts(r);
                return (
                  <div key={m} className="group relative flex h-full items-end justify-center">
                    <div className="relative flex w-6 flex-col gap-px" style={{ height: `${(r.goi / top) * 100}%` }}>
                      <span className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-slate-700">
                        {fmtInt(r.goi)}
                      </span>
                      {stackOrder.map((s) =>
                        p[s.key] > 0 ? (
                          <div
                            key={s.key}
                            className={`${s.color} w-full first:rounded-t-sm`}
                            style={{ flexGrow: p[s.key], flexBasis: 0, minHeight: 2 }}
                          />
                        ) : null,
                      )}
                    </div>
                    <div className="pointer-events-none absolute bottom-1/2 left-1/2 z-20 hidden w-48 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2.5 text-[12px] shadow-lg group-hover:block">
                      <div className="mb-1 font-semibold text-slate-800">Tháng {m}</div>
                      {SERIES.map((s) => (
                        <div key={s.key} className="flex justify-between text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-sm ${s.color}`} />
                            {s.label}
                          </span>
                          <span className="tabular-nums text-slate-800">{fmtInt(p[s.key])}</span>
                        </div>
                      ))}
                      <div className="mt-1 flex justify-between border-t border-slate-100 pt-1 text-slate-500">
                        <span>Tỷ lệ trúng</span>
                        <span className="font-semibold tabular-nums text-slate-800">{fmtPct(winRate(r))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-12 pt-1 text-[11px] text-slate-400">
            {FISCAL_MONTHS.map((m) => (
              <span key={m} className="text-center">
                T{m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function niceTicks(max: number): number[] {
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? rough;
  const ticks = [];
  for (let t = 0; t <= max + step - 1; t += step) ticks.push(t);
  return ticks;
}

/** Single-series bars (reasons for losing). */
export function ReasonBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-2.5 px-4 py-3 text-[13px]">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between">
            <span className="text-slate-700">{r.label}</span>
            <span className="tabular-nums text-slate-500">
              <b className="font-semibold text-slate-800">{fmtInt(r.value)}</b> · {fmtPct(total ? r.value / total : null)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded bg-slate-100">
            <div className="h-full rounded bg-lost" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="py-3 text-center text-slate-400">Không có gói thầu trượt</li>}
    </ul>
  );
}
