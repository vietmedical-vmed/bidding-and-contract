"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppShell, LoadingBlock, RefreshingBar } from "@/components/AppShell";
import { BreakdownTable, Legend, MonthColumns, Panel, ReasonBars, StatCard, WinRateCard } from "@/components/charts";
import { fmtInt, fmtVnd, parseFilters, toKpiRow, toQuery } from "@/lib/bids";
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
      <AppShell>
        <Dashboard />
      </AppShell>
    </Suspense>
  );
}

function Dashboard() {
  const f = parseFilters(useSearchParams());
  const dash = useApi<DashboardResp>("dashboard", { ...f });
  const d = dash.data;

  if (!d) return <LoadingBlock error={dash.error} />;

  const rows = (list: Raw[]) => list.map(toKpiRow);
  const detail = (extra: Record<string, string | string[]>) => `/chi-tiet/?${toQuery(f, extra)}`;
  const total = d.total ? toKpiRow(d.total) : null;
  const reasons = rows(d.lyDo)
    .filter((r) => r.truot > 0)
    .map((r) => ({ label: r.grp ?? "(Không ghi)", value: r.truot }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      {dash.loading && <RefreshingBar />}
      {dash.error && <LoadingBlock error={dash.error} />}

      {total ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)]">
          <WinRateCard r={total} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Gói thầu dự thầu" value={fmtInt(total.goi)} sub={`${fmtInt(total.mat_hang)} mặt hàng`} />
            <StatCard label="Trúng" value={fmtInt(total.trung)} swatch="bg-won" />
            <StatCard label="Trượt" value={fmtInt(total.truot)} swatch="bg-lost" />
            <StatCard label="Chưa có kết quả" value={fmtInt(total.cho_kq + total.huy)} swatch="bg-pending" />
            <StatCard label="Giá trị dự thầu" value={fmtVnd(total.gia_tri_du_thau)} />
            <StatCard label="Giá trị trúng" value={fmtVnd(total.gia_tri_du_thau_trung)} sub="Theo thành tiền dự thầu" />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
          Không có dữ liệu cho bộ lọc này
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Theo BU" right={<Legend />}>
          <BreakdownTable dimension="BU" rows={rows(d.bu)} hrefFor={(g) => detail({ bu: g })} />
        </Panel>
        <Panel title="Theo miền" right={<Legend />}>
          <BreakdownTable dimension="Miền" rows={rows(d.mien)} hrefFor={(g) => detail({ mien: [g] })} emptyLabel="(Chưa ghi miền)" />
        </Panel>
        <Panel title="Theo nhóm sản phẩm" right={<Legend />}>
          <BreakdownTable dimension="Nhóm SP" rows={rows(d.nhom)} hrefFor={(g) => detail({ nhom: [g] })} />
        </Panel>
        <Panel title="Lý do trượt" subtitle="Số gói thầu có mặt hàng trượt, theo lý do">
          <ReasonBars rows={reasons} />
        </Panel>
      </div>

      {d.monthYear && (
        <Panel
          title={`Theo tháng dự thầu – năm ${d.monthYear}`}
          subtitle={f.nam ? undefined : "Chọn Năm ở bộ lọc để xem năm khác"}
          right={<Legend />}
        >
          <MonthColumns rows={rows(d.thang)} />
        </Panel>
      )}

      <Panel title="Theo sale" subtitle="Bấm tên để xem các mặt hàng của sale đó" right={<Legend />}>
        <BreakdownTable dimension="Sale" rows={rows(d.sale)} hrefFor={(g) => detail({ sale: g })} emptyLabel="(Chưa ghi sale)" />
      </Panel>
    </div>
  );
}
