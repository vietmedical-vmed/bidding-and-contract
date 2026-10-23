"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, Suspense, useState } from "react";
import { AppShell, LoadingBlock, RefreshingBar } from "@/components/AppShell";
import { ContractFilters } from "@/components/ContractFilters";
import { Badge, DaysBadge, StatusTabs, UsageBar } from "@/components/contractUi";
import { ChevronLeft, ChevronRight, Download } from "@/components/icons";
import { PageLink } from "@/components/PageLink";
import { SearchBox } from "@/components/SearchBox";
import { api, errorMessage } from "@/lib/api";
import { fmtInt } from "@/lib/bids";
import { downloadContractsXlsx, type ExportRow } from "@/lib/contractExport";
import {
  fmtDate,
  fmtMoney,
  parseContractFilters,
  STATUSES,
  usedPct,
  type Contract,
  type ContractDetail,
  type ContractList,
  type StatusKey,
  type Summary,
} from "@/lib/contracts";
import { useApi } from "@/lib/useApi";

const PAGE_SIZE = 15;
const COLUMNS = 8;

export default function ContractListPage() {
  return (
    <Suspense>
      <AppShell module="hop-dong" filters={<ContractFilters />}>
        <ContractListView />
      </AppShell>
    </Suspense>
  );
}

function ContractListView() {
  const params = useSearchParams();
  const f = parseContractFilters(params);
  const rawStatus = params.get("status");
  const status: StatusKey = STATUSES.find((s) => s.key === rawStatus)?.key ?? "all";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const summary = useApi<Summary>("dashboard-summary", { ...f }, "contract");
  const query = { ...f, status, search: q, page, page_size: PAGE_SIZE };
  const list = useApi<ContractList>("list-contracts", query, "contract");
  const d = list.data;
  const pages = d ? Math.max(1, Math.ceil((d.total ?? 0) / PAGE_SIZE)) : 1;

  /** Current URL with some params changed (undefined removes the param); any change but paging resets the page. */
  const withParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    if (!("page" in changes)) next.delete("page");
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `?${next.toString()}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Tìm số HĐ, mã HĐ, khách hàng…" />
        <StatusTabs
          active={status}
          summary={summary.data}
          hrefFor={(key) => withParams({ status: key === "all" ? undefined : key })}
        />
        <span className="ml-auto text-[13px] text-slate-500">{d ? `${fmtInt(d.total ?? 0)} hợp đồng` : ""}</span>
        <ExportButton payload={{ mien: f.mien, bu: f.bu, nhom_sp: f.nhom_sp, status }} />
      </div>

      {list.loading && d && <RefreshingBar />}
      {!d || list.error ? (
        <LoadingBlock error={list.error} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="scroll-shadow overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="w-8" />
                  <th className="px-3 py-2 text-left font-semibold">Hợp đồng</th>
                  <th className="px-3 py-2 text-left font-semibold">Khách hàng</th>
                  <th className="px-3 py-2 text-left font-semibold">Miền</th>
                  <th className="px-3 py-2 text-left font-semibold">Ngày ký</th>
                  <th className="px-3 py-2 text-left font-semibold">Thời hạn</th>
                  <th className="px-3 py-2 text-left font-semibold">Còn lại</th>
                  <th className="px-3 py-2 text-left font-semibold">PS / SO</th>
                </tr>
              </thead>
              {/* Re-keyed on every new result so expanded rows close with the page they belong to. */}
              <ContractRows key={JSON.stringify(query)} rows={d.data ?? []} />
            </table>
          </div>
          <nav className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2 text-[13px]" aria-label="Phân trang">
            <span className="mr-1 text-slate-500">
              Trang {page} / {pages}
            </span>
            <PageLink href={page > 1 ? withParams({ page: String(page - 1) }) : null} label="Trang trước">
              <ChevronLeft size={14} />
            </PageLink>
            <PageLink href={page < pages ? withParams({ page: String(page + 1) }) : null} label="Trang sau">
              <ChevronRight size={14} />
            </PageLink>
          </nav>
        </div>
      )}
    </div>
  );
}

function ContractRows({ rows }: { rows: Contract[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (maHd: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(maHd)) next.add(maHd);
      return next;
    });

  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={COLUMNS} className="px-3 py-10 text-center text-slate-400">
            Không có hợp đồng nào khớp bộ lọc
          </td>
        </tr>
      </tbody>
    );
  }
  return (
    <tbody>
      {rows.map((c, i) => {
        const isOpen = open.has(c.ma_hd);
        return (
          <Fragment key={c.ma_hd}>
            <tr
              onClick={() => toggle(c.ma_hd)}
              className={`cursor-pointer align-top ${isOpen ? "bg-blue-50/60" : `${i % 2 ? "bg-slate-50/50" : "bg-white"} hover:bg-blue-50/40`}`}
            >
              <td className="py-2 pl-2 text-slate-400">
                <ChevronRight size={14} className={`mt-0.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <div className="font-medium text-slate-800">{c.so_hd || "—"}</div>
                <div className="text-[11px] text-slate-400">{c.ma_hd}</div>
              </td>
              <td className="max-w-72 px-3 py-2">
                <div className="line-clamp-1 text-slate-800" title={c.ten_kh ?? ""}>
                  {c.ten_kh || "—"}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  {c.ma_kh}
                  {c.loai_bv && <Badge tone={c.loai_bv === "Công" ? "blue" : "grey"}>{c.loai_bv}</Badge>}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{c.mien || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{fmtDate(c.ngay_ky)}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{fmtDate(c.thoi_han)}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <DaysBadge days={c.days_remaining} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <div className="text-slate-800">{c.ten_ps || "—"}</div>
                <div className="text-[11px] text-slate-400">{c.ten_so}</div>
              </td>
            </tr>
            {isOpen && <ContractItems maHd={c.ma_hd} />}
          </Fragment>
        );
      })}
    </tbody>
  );
}

/** Items of one contract with the quantity sold in each fiscal year it spans. */
function ContractItems({ maHd }: { maHd: string }) {
  const detail = useApi<ContractDetail>("contract-detail", { ma_hd: maHd }, "contract");
  const d = detail.data;
  const fyList = d?.fy_list ?? [];
  // Most used first, then by supplier code.
  const items = [...(d?.items ?? [])].sort(
    (a, b) => (usedPct(b) ?? 0) - (usedPct(a) ?? 0) || (a.ma_ncc ?? "").localeCompare(b.ma_ncc ?? ""),
  );

  const num = "px-2 py-1.5 text-right tabular-nums";
  return (
    <tr>
      <td colSpan={COLUMNS} className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 pl-9">
        {!d ? (
          <div className={`py-4 text-center text-[12px] ${detail.error ? "text-red-600" : "text-slate-400"}`}>
            {detail.error ? `Lỗi: ${detail.error}` : "Đang tải sản phẩm…"}
          </div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center text-[12px] text-slate-400">Không có sản phẩm</div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1.5 text-right font-semibold">#</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Sản phẩm</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Đơn giá</th>
                  <th className="px-2 py-1.5 text-right font-semibold">SL thầu</th>
                  {fyList.map((fy) => (
                    <th key={fy.fy} className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                      Bán {fy.label}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-right font-semibold">Đã bán</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Còn lại</th>
                  <th className="px-2 py-1.5 pr-3 text-left font-semibold">Tiến độ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id ?? i} className={`align-top ${i % 2 ? "bg-slate-50/50" : "bg-white"}`}>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{i + 1}</td>
                    <td className="max-w-80 px-2 py-1.5">
                      <div className="line-clamp-1 text-slate-800" title={it.ten_hang_hoa ?? ""}>
                        {it.ten_hang_hoa || "—"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {it.ma_chung || "—"} · {it.ma_ncc || "—"}
                      </div>
                    </td>
                    <td className={`${num} whitespace-nowrap text-slate-600`}>{fmtMoney(it.don_gia)}</td>
                    <td className={`${num} text-slate-700`}>{fmtInt(it.so_luong_hd ?? 0)}</td>
                    {fyList.map((fy) => {
                      const v = it.fy_sold?.[`fy${fy.fy % 100}`] ?? 0;
                      return (
                        <td key={fy.fy} className={`${num} ${v > 0 ? "text-slate-700" : "text-slate-300"}`}>
                          {fmtInt(v)}
                        </td>
                      );
                    })}
                    <td className={`${num} text-slate-700`}>{fmtInt(it.so_luong_da_ban ?? 0)}</td>
                    <td className={`${num} font-semibold text-slate-800`}>{it.is_bv_tu ? "—" : fmtInt(it.so_luong_con_lai ?? 0)}</td>
                    <td className="px-2 py-1.5 pr-3">{it.is_bv_tu ? <span className="text-slate-400">—</span> : <UsageBar item={it} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">{items.length} sản phẩm</div>
          </div>
        )}
      </td>
    </tr>
  );
}

function ExportButton({ payload }: { payload: Record<string, string> }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await api<{ rows: ExportRow[] }>("export-contracts", payload, "contract");
      if (!res.rows?.length) alert("Không có dữ liệu để xuất");
      else await downloadContractsXlsx(res.rows);
    } catch (err) {
      alert(`Lỗi xuất Excel: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download size={14} />
      {busy ? "Đang xuất…" : "Xuất Excel"}
    </button>
  );
}
