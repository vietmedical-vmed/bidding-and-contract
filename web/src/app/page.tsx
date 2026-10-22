"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CountBars, Legend, MonthColumns, OutcomeBars } from "@/components/charts";
import { FilterBar } from "@/components/FilterBar";
import { Header } from "@/components/Header";
import {
  fmtInt,
  fmtPct,
  fmtVnd,
  parseFilters,
  toKpiRow,
  toQuery,
  valueWinRate,
  winRate,
  type FilterOptions,
  type KpiRow,
} from "@/lib/bids";
import { useApi } from "@/lib/useApi";

type Raw = Record<string, unknown>;
type DashboardResp = {
  total: Raw | null;
  bu: Raw[];
  nhom: Raw[];
  mien: Raw[];
  sale: Raw[];
  lyDo: Raw[];
  monthYear: number | null;
  thang: Raw[];
};

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const params = useSearchParams();
  const f = parseFilters(params);
  const options = useApi<{ options: FilterOptions }>("filter-options", {});
  const dash = useApi<DashboardResp>("dashboard", { ...f });

  const detail = (extra: Record<string, string>) => `/chi-tiet/?${toQuery(f, extra)}`;
  const d = dash.data;
  const rows = (list: Raw[] | undefined) => (list ?? []).map(toKpiRow);
  const reasons = rows(d?.lyDo)
    .filter((r) => r.truot > 0)
    .map((r) => ({ label: r.grp ?? "(Không ghi)", value: r.truot }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <Header current="/" query={toQuery(f)} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {options.data && <FilterBar options={options.data.options} />}

        {dash.error && <p className="text-sm text-critical">Không tải được dữ liệu: {dash.error}</p>}
        {!d && !dash.error && <p className="text-sm text-ink-3">Đang tải dữ liệu…</p>}

        {d && (
          <div className={`space-y-6 transition-opacity ${dash.loading ? "opacity-60" : ""}`}>
            {d.total ? <Tiles r={toKpiRow(d.total)} /> : <p className="text-ink-2">Không có dữ liệu cho bộ lọc này.</p>}

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink-2">Kết quả theo mặt hàng</h2>
              <Legend />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Theo BU">
                <OutcomeBars rows={rows(d.bu)} hrefFor={(g) => detail({ bu: g })} />
              </Panel>
              <Panel title="Theo miền">
                <OutcomeBars rows={rows(d.mien)} hrefFor={(g) => detail({ mien: g })} emptyLabel="(Chưa ghi miền)" />
              </Panel>
              <Panel title="Theo nhóm sản phẩm">
                <OutcomeBars rows={rows(d.nhom)} hrefFor={(g) => detail({ nhom: g })} />
              </Panel>
              <Panel title="Lý do trượt" subtitle="Số mặt hàng trượt theo lý do">
                {reasons.length ? <CountBars rows={reasons} /> : <p className="text-sm text-ink-3">Không có mặt hàng trượt.</p>}
              </Panel>
            </div>

            {d.monthYear && (
              <Panel
                title={`Theo tháng dự thầu – năm ${d.monthYear}`}
                subtitle={f.nam ? undefined : "Chọn năm ở bộ lọc để xem năm khác"}
              >
                <MonthColumns rows={rows(d.thang)} />
              </Panel>
            )}

            <Panel title="Theo sale" subtitle="Bấm tên để xem chi tiết các mặt hàng">
              <OutcomeBars rows={rows(d.sale)} hrefFor={(g) => detail({ sale: g })} emptyLabel="(Chưa ghi sale)" />
            </Panel>
          </div>
        )}
      </main>
    </>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h3 className="font-medium">{title}</h3>
      {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tiles({ r }: { r: KpiRow }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,3fr)]">
      <div className="card flex flex-col justify-between">
        <span className="text-sm text-ink-2">Tỷ lệ trúng thầu</span>
        <span className="text-5xl font-semibold">{fmtPct(winRate(r))}</span>
        <span className="text-xs text-ink-3">
          Trúng / (trúng + trượt), theo số mặt hàng. Theo giá trị: {fmtPct(valueWinRate(r))}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Tile label="Mặt hàng dự thầu" value={fmtInt(r.items)} />
        <Tile label="Trúng" value={fmtInt(r.trung)} swatch="bg-series-1" />
        <Tile label="Trượt" value={fmtInt(r.truot)} swatch="bg-series-2" />
        <Tile label="Chưa có kết quả" value={fmtInt(r.cho_kq + r.huy)} swatch="bg-series-3" />
        <Tile label="Giá trị dự thầu" value={fmtVnd(r.gia_tri_du_thau)} />
        <Tile label="Giá trị trúng" value={fmtVnd(r.gia_tri_du_thau_trung)} note="Theo thành tiền dự thầu" />
      </div>
    </div>
  );
}

function Tile({ label, value, swatch, note }: { label: string; value: string; swatch?: string; note?: string }) {
  return (
    <div className="card">
      <span className="flex items-center gap-1.5 text-sm text-ink-2">
        {swatch && <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} aria-hidden />}
        {label}
      </span>
      <span className="mt-1 block text-2xl font-semibold">{value}</span>
      {note && <span className="text-xs text-ink-3">{note}</span>}
    </div>
  );
}
