"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppShell, LoadingBlock, RefreshingBar } from "@/components/AppShell";
import { ContractFilters } from "@/components/ContractFilters";
import { KpiCards, MienTabs } from "@/components/contractUi";
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
  const bac = useApi<Summary>("dashboard-summary", { bu: f.bu, nhom_sp: f.nhom_sp, mien: "Miền Bắc" }, "contract");
  const nam = useApi<Summary>("dashboard-summary", { bu: f.bu, nhom_sp: f.nhom_sp, mien: "Miền Nam" }, "contract");
  const cur = f.mien === "Miền Nam" ? nam : bac;
  const d = cur.data;

  if (!d) return <LoadingBlock error={cur.error} />;

  const withParams = (path: string, changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `${path}?${next.toString()}`;
  };

  return (
    <div className="space-y-4">
      {cur.loading && <RefreshingBar />}
      {cur.error && <LoadingBlock error={cur.error} />}

      {d.last_invoice_date && (
        <div className="text-[12px] text-slate-400">
          Dữ liệu bán hàng cập nhật đến: <span className="font-bold text-slate-800">{fmtDate(d.last_invoice_date)}</span>
        </div>
      )}

      <KpiCards
        summary={d}
        hrefFor={(key) => withParams("/hop-dong/danh-sach/", { status: key === "all" ? undefined : key })}
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-2">
          <MienTabs
            active={f.mien}
            counts={{ "Miền Bắc": bac.data?.total_contracts, "Miền Nam": nam.data?.total_contracts }}
            hrefFor={(m) => withParams("", { mien: m })}
          />
        </div>
        <div className="grid gap-6 p-4 lg:grid-cols-2">
          <ExpiryTable title={`HĐ sắp hết hạn (${d.max_warn_days || 30} ngày)`} rows={d.expiry_alerts ?? []} />
          <QuantityTable title={`SP đã sử dụng >${d.quantity_warn_pct ?? 80}% thầu`} rows={d.quantity_alerts ?? []} />
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, dot }: { title: string; dot: string }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-800">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {title}
    </h3>
  );
}

function ExpiryTable({ title, rows }: { title: string; rows: Contract[] }) {
  return (
    <div>
      <SectionTitle title={title} dot="bg-amber-500" />
      {rows.length === 0 ? (
        <p className="text-[13px] text-slate-500">Không có hợp đồng nào sắp hết hạn</p>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400">
              <th className="px-2 py-2 text-left font-medium">Số HĐ</th>
              <th className="px-2 py-2 text-left font-medium">Khách hàng</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Còn lại</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const days = a.days_remaining ?? 0;
              return (
                <tr key={a.ma_hd} className="border-b border-slate-100">
                  <td className="max-w-[180px] truncate whitespace-nowrap px-2 py-2 font-medium text-slate-800">{a.so_hd || a.ma_hd}</td>
                  <td className="max-w-[160px] truncate whitespace-nowrap px-2 py-2 text-slate-500">{a.ten_kh}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${days <= 7 ? "bg-red-500" : days <= 15 ? "bg-amber-500" : "bg-gray-500"}`}
                    >
                      {days} ngày
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function QuantityTable({ title, rows }: { title: string; rows: ContractItem[] }) {
  // One block per contract, its items listed underneath.
  const groups = new Map<string, { so_hd: string | null; ten_kh: string | null; items: ContractItem[] }>();
  for (const it of rows) {
    const g = groups.get(it.ma_hd) ?? { so_hd: it.so_hd, ten_kh: it.ten_kh, items: [] };
    g.items.push(it);
    groups.set(it.ma_hd, g);
  }

  return (
    <div>
      <SectionTitle title={title} dot="bg-red-500" />
      {rows.length === 0 ? (
        <p className="text-[13px] text-slate-500">Không có sản phẩm nào vượt ngưỡng</p>
      ) : (
        <div className="scroll-shadow max-h-[560px] space-y-3 overflow-y-auto pr-1">
          {[...groups].map(([maHd, g]) => (
            <div key={maHd} className="border-b border-slate-200 pb-3 last:border-0 last:pb-0">
              <div className="mb-2 flex items-center gap-2 text-[12px]">
                <span className="font-medium text-blue-600">{g.so_hd || maHd}</span>
                {g.ten_kh && <span className="text-slate-400">· {g.ten_kh}</span>}
              </div>
              <div className="space-y-1 border-l-2 border-slate-200 pl-3">
                {g.items.map((it) => {
                  const pct = usedPct(it) ?? 0;
                  return (
                    <div key={it.id} className="flex items-center gap-2 py-1 text-[12px]">
                      <span className="w-20 shrink-0 truncate text-slate-500">{it.ma_ncc || "—"}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800" title={it.ten_hang_hoa ?? ""}>
                        {it.ten_hang_hoa}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${pct >= 90 ? "bg-red-500" : "bg-amber-500"}`}
                      >
                        {pct}%
                      </span>
                      <span className="min-w-[70px] shrink-0 text-right tabular-nums text-slate-400">
                        {fmtInt(it.so_luong_con_lai ?? 0)}/{fmtInt(it.so_luong_hd ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
