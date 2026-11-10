"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppShell, LoadingBlock, RefreshingBar } from "@/components/AppShell";
import { Panel } from "@/components/charts";
import { ContractFilters } from "@/components/ContractFilters";
import { Badge, ContractTotalCard, StatusCards, UsageBar } from "@/components/contractUi";
import { fmtInt } from "@/lib/bids";
import { fmtDate, parseContractFilters, usedPct, type Contract, type ContractItem, type Summary } from "@/lib/contracts";
import { useApi } from "@/lib/useApi";

export default function ContractDashboardPage() {
  return (
    <Suspense>
      <AppShell module="hop-dong" filters={<ContractFilters />}>
        <ContractDashboard />
      </AppShell>
    </Suspense>
  );
}

function ContractDashboard() {
  const params = useSearchParams();
  const f = parseContractFilters(params);
  const summary = useApi<Summary>("dashboard-summary", { ...f }, "contract");
  const d = summary.data;

  if (!d) return <LoadingBlock error={summary.error} />;

  /** Contract list with the current filters plus the given params. */
  const listHref = (extra: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(extra)) next.set(k, v);
    return `/hop-dong/danh-sach/?${next.toString()}`;
  };
  // Split on the quantity left, not the rounded %: 99.6 % sold rounds to 100 % but can still ship.
  const alerts = d.quantity_alerts ?? [];
  const exhausted = alerts
    .filter((it) => (it.so_luong_con_lai ?? 0) <= 0)
    .sort((a, b) => overBy(b) - overBy(a) || (a.so_hd || a.ma_hd).localeCompare(b.so_hd || b.ma_hd));
  const nearing = alerts
    .filter((it) => (it.so_luong_con_lai ?? 0) > 0)
    .sort((a, b) => (usedPct(b) ?? 0) - (usedPct(a) ?? 0));

  return (
    <div className="space-y-4">
      {summary.loading && <RefreshingBar />}
      {summary.error && <LoadingBlock error={summary.error} />}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)]">
        <ContractTotalCard summary={d} />
        <StatusCards summary={d} hrefFor={(status) => listHref({ status })} />
      </div>

      {exhausted.length > 0 ? (
        <Panel
          title="Đã hết số lượng thầu — dừng xuất"
          subtitle="Đã bán hết hoặc vượt số lượng hợp đồng, không xuất thêm (HĐ bệnh viện công còn hạn)"
          accent="red"
          right={<Badge tone="red">{fmtInt(exhausted.length)} sản phẩm</Badge>}
        >
          <ExhaustedTable rows={exhausted} />
        </Panel>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-700">
          Không có sản phẩm nào hết số lượng thầu
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Hợp đồng sắp hết hạn"
          subtitle={`Hết hạn trong ${d.max_warn_days || 30} ngày tới, ${fmtInt(d.expiry_alerts?.length ?? 0)} hợp đồng gần nhất`}
        >
          <ExpiryTable rows={d.expiry_alerts ?? []} hrefFor={(c) => listHref({ q: c.so_hd || c.ma_hd })} />
        </Panel>
        <Panel
          title="Sản phẩm sắp hết số lượng thầu"
          subtitle={`Đã bán trên ${d.quantity_warn_pct ?? 80}%, vẫn còn hàng — theo dõi (HĐ bệnh viện công còn hạn)`}
          right={nearing.length > 0 ? <Badge tone="amber">{fmtInt(nearing.length)} sản phẩm</Badge> : undefined}
        >
          <QuantityTable rows={nearing} />
        </Panel>
      </div>
    </div>
  );
}

/** Quantity sold beyond the contract quantity, 0 when within it. */
function overBy(it: ContractItem): number {
  return Math.max(0, -(it.so_luong_con_lai ?? 0));
}

const th = "px-2 py-2 font-semibold";

/** Contract and customer, stacked: the first column of both quantity tables. */
function ContractCell({ it }: { it: ContractItem }) {
  return (
    <td className="max-w-[200px] py-1.5 pl-4 pr-2">
      <div className="truncate text-slate-800" title={it.so_hd ?? it.ma_hd}>
        {it.so_hd || it.ma_hd}
      </div>
      <div className="truncate text-[11px] text-slate-400" title={it.ten_kh ?? ""}>
        {it.ten_kh}
      </div>
    </td>
  );
}

function ProductCell({ it }: { it: ContractItem }) {
  return (
    <td className="max-w-[280px] px-2 py-1.5">
      <div className="line-clamp-1 text-slate-800" title={it.ten_hang_hoa ?? ""}>
        {it.ten_hang_hoa}
      </div>
      <div className="text-[11px] text-slate-400">{it.ma_ncc}</div>
    </td>
  );
}

function ExhaustedTable({ rows }: { rows: ContractItem[] }) {
  return (
    <div className="scroll-shadow max-h-[360px] overflow-auto">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead className="sticky top-0">
          <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th className={`${th} pl-4 text-left`}>Hợp đồng</th>
            <th className={`${th} text-left`}>Sản phẩm</th>
            <th className={`${th} text-right`}>SL hợp đồng</th>
            <th className={`${th} text-right`}>Đã bán</th>
            <th className={`${th} text-right`}>Vượt</th>
            <th className={`${th} pr-4 text-right`}>Hạn HĐ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => {
            const total = it.so_luong_hd ?? 0;
            const over = overBy(it);
            return (
              <tr key={it.id} className={`align-top ${i % 2 ? "bg-slate-50/50" : "bg-white"} hover:bg-blue-50/40`}>
                <ContractCell it={it} />
                <ProductCell it={it} />
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-600">{fmtInt(total)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-800">
                  {fmtInt(total - (it.so_luong_con_lai ?? 0))}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  {over > 0 ? <Badge tone="red">+{fmtInt(over)}</Badge> : <span className="text-slate-400">—</span>}
                </td>
                <td className="whitespace-nowrap py-1.5 pl-2 pr-4 text-right tabular-nums text-slate-600">
                  {fmtDate(it.thoi_han)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpiryTable({ rows, hrefFor }: { rows: Contract[]; hrefFor: (c: Contract) => string }) {
  return (
    <div className="scroll-shadow overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th className={`${th} pl-4 text-left`}>Số HĐ</th>
            <th className={`${th} text-left`}>Khách hàng</th>
            <th className={`${th} text-left`}>Thời hạn</th>
            <th className={`${th} pr-4 text-right`}>Còn lại</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const days = c.days_remaining ?? 0;
            return (
              <tr key={c.ma_hd} className={`${i % 2 ? "bg-slate-50/50" : "bg-white"} hover:bg-blue-50/40`}>
                <td className="max-w-[200px] truncate whitespace-nowrap py-1.5 pl-4 pr-2" title={c.so_hd ?? c.ma_hd}>
                  <Link href={hrefFor(c)} className="text-slate-800 hover:text-blue-600 hover:underline">
                    {c.so_hd || c.ma_hd}
                  </Link>
                </td>
                <td className="max-w-[220px] truncate px-2 py-1.5 text-slate-600" title={c.ten_kh ?? ""}>
                  {c.ten_kh}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-600">{fmtDate(c.thoi_han)}</td>
                <td className="py-1.5 pl-2 pr-4 text-right">
                  <Badge tone={days <= 7 ? "red" : days <= 15 ? "amber" : "grey"}>{days} ngày</Badge>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                Không có hợp đồng nào sắp hết hạn
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function QuantityTable({ rows }: { rows: ContractItem[] }) {
  return (
    <div className="scroll-shadow max-h-[480px] overflow-auto">
      <table className="w-full min-w-[620px] border-collapse text-[13px]">
        <thead className="sticky top-0">
          <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th className={`${th} pl-4 text-left`}>Hợp đồng</th>
            <th className={`${th} text-left`}>Sản phẩm</th>
            <th className={`${th} text-left`}>Đã bán</th>
            <th className={`${th} pr-4 text-right`}>Còn lại</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => (
            <tr key={it.id} className={`align-top ${i % 2 ? "bg-slate-50/50" : "bg-white"} hover:bg-blue-50/40`}>
              <ContractCell it={it} />
              <ProductCell it={it} />
              <td className="px-2 py-1.5">
                <UsageBar item={it} />
              </td>
              <td className="whitespace-nowrap py-1.5 pl-2 pr-4 text-right tabular-nums text-slate-600">
                {fmtInt(it.so_luong_con_lai ?? 0)}
                <span className="text-slate-400"> / {fmtInt(it.so_luong_hd ?? 0)}</span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                Không có sản phẩm nào sắp hết
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
