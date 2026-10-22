import Link from "next/link";
import { fmtInt, fmtPct, fmtVnd, valueWinRate, winRate, type KpiRow } from "@/lib/bids";

/* Outcome series, in fixed categorical order. "Chưa có KQ" also covers cancelled packages. */
const SERIES = [
  { key: "trung", label: "Trúng", color: "bg-series-1" },
  { key: "truot", label: "Trượt", color: "bg-series-2" },
  { key: "pending", label: "Chưa có KQ", color: "bg-series-3" },
] as const;

function parts(r: KpiRow) {
  return { trung: r.trung, truot: r.truot, pending: r.cho_kq + r.huy };
}

export function Legend() {
  return (
    <div className="flex gap-4 text-xs text-ink-2">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ title, r, position = "left-0 top-full mt-1" }: { title: string; r: KpiRow; position?: string }) {
  const p = parts(r);
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-20 hidden w-60 rounded-lg border border-line bg-surface p-3 text-xs shadow-lg group-hover:block ${position}`}
    >
      <div className="mb-1.5 font-medium text-ink">{title}</div>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-2 text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${s.color}`} aria-hidden />
            {s.label}
          </span>
          <span className="tabular-nums text-ink">{fmtInt(p[s.key])}</span>
        </div>
      ))}
      <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 text-ink-2">
        <span>Tỷ lệ trúng (số lượng)</span>
        <span className="tabular-nums text-ink">{fmtPct(winRate(r))}</span>
      </div>
      <div className="flex justify-between text-ink-2">
        <span>Tỷ lệ trúng (giá trị)</span>
        <span className="tabular-nums text-ink">{fmtPct(valueWinRate(r))}</span>
      </div>
      <div className="flex justify-between text-ink-2">
        <span>Giá trị trúng</span>
        <span className="tabular-nums text-ink">{fmtVnd(r.gia_tri_du_thau_trung)}</span>
      </div>
    </div>
  );
}

/** One stacked bar per segment, plus the numbers as columns (the table view of the chart). */
export function OutcomeBars({
  rows,
  hrefFor,
  emptyLabel = "(Chưa phân loại)",
}: {
  rows: KpiRow[];
  hrefFor?: (grp: string) => string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.items));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-ink-3">
          <th className="w-[30%] pb-2 font-normal" />
          <th className="pb-2 font-normal">Số mặt hàng</th>
          <th className="w-20 pb-2 text-right font-normal">Tỷ lệ trúng</th>
          <th className="w-24 pb-2 text-right font-normal">Giá trị trúng</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const p = parts(r);
          const label = r.grp ?? emptyLabel;
          return (
            <tr key={label} className="group relative align-middle hover:bg-page">
              <td className="max-w-0 truncate py-1.5 pr-2" title={label}>
                {hrefFor && r.grp ? (
                  <Link href={hrefFor(r.grp)} className="hover:underline">
                    {label}
                  </Link>
                ) : (
                  <span className={r.grp ? "" : "text-ink-3"}>{label}</span>
                )}
              </td>
              <td className="relative py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-4 gap-[2px]" style={{ width: `${(r.items / max) * 80}%` }}>
                    {SERIES.map((s, i) =>
                      p[s.key] > 0 ? (
                        <div
                          key={s.key}
                          className={`${s.color} h-full ${i === lastNonZero(p) ? "rounded-r" : ""}`}
                          style={{ flexGrow: p[s.key], flexBasis: 0, minWidth: 2 }}
                        />
                      ) : null,
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-ink-2">{fmtInt(r.items)}</span>
                </div>
                <Tooltip title={label} r={r} />
              </td>
              <td className="py-1.5 text-right tabular-nums">{fmtPct(winRate(r))}</td>
              <td className="py-1.5 text-right tabular-nums text-ink-2">{fmtVnd(r.gia_tri_du_thau_trung)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function lastNonZero(p: ReturnType<typeof parts>): number {
  let last = 0;
  SERIES.forEach((s, i) => {
    if (p[s.key] > 0) last = i;
  });
  return last;
}

/** Stacked columns by month (1–12). */
export function MonthColumns({ rows }: { rows: KpiRow[] }) {
  const byMonth = new Map(rows.map((r) => [Number(r.grp), r]));
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const max = Math.max(1, ...rows.map((r) => r.items));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];

  return (
    <div className="flex gap-2 pt-2">
      <div className="relative h-48 w-8 text-right text-[11px] tabular-nums text-ink-3">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
            {fmtInt(t)}
          </span>
        ))}
      </div>
      <div className="flex-1">
        <div className="relative h-48 border-b border-axis">
          {ticks.slice(1).map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-grid" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-around">
            {months.map((m) => {
              const r = byMonth.get(m);
              if (!r) return <div key={m} className="w-6" />;
              const p = parts(r);
              const order = [...SERIES].reverse(); // stack from the baseline: Trúng at the bottom
              return (
                <div key={m} className="group relative flex h-full w-10 items-end justify-center">
                  <div className="flex w-6 flex-col gap-[2px]" style={{ height: `${(r.items / top) * 100}%` }}>
                    {order.map((s) =>
                      p[s.key] > 0 ? (
                        <div
                          key={s.key}
                          className={`${s.color} w-full first:rounded-t`}
                          style={{ flexGrow: p[s.key], flexBasis: 0, minHeight: 2 }}
                        />
                      ) : null,
                    )}
                  </div>
                  <Tooltip title={`Tháng ${m}`} r={r} position="bottom-1/2 left-1/2 -translate-x-1/2" />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-around pt-1 text-[11px] text-ink-3">
          {months.map((m) => (
            <span key={m} className="w-10 text-center">
              T{m}
            </span>
          ))}
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

/** Single-series bars (e.g. reasons for losing). */
export function CountBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,40%)_1fr] items-center gap-2">
          <span className="truncate" title={r.label}>
            {r.label}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-4 rounded-r bg-series-2" style={{ width: `${(r.value / max) * 65}%`, minWidth: 2 }} />
            <span className="whitespace-nowrap text-xs tabular-nums text-ink-2">
              {fmtInt(r.value)} · {fmtPct(total ? r.value / total : null)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
