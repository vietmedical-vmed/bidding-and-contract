"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, Suspense, useState } from "react";
import { AppShell, LoadingBlock, RefreshingBar } from "@/components/AppShell";
import { ContractFilters } from "@/components/ContractFilters";
import { DaysBadge, KpiCards, MienTabs, UsageBar } from "@/components/contractUi";
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
const COLUMNS = 11;

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

  const bac = useApi<Summary>("dashboard-summary", { bu: f.bu, nhom_sp: f.nhom_sp, mien: "Miền Bắc" }, "contract");
  const nam = useApi<Summary>("dashboard-summary", { bu: f.bu, nhom_sp: f.nhom_sp, mien: "Miền Nam" }, "contract");
  const kpi = (f.mien === "Miền Nam" ? nam : bac).data;

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
    <div className="space-y-4">
      {kpi && (
        <KpiCards
          summary={kpi}
          active={status}
          hrefFor={(key) => withParams({ status: key === "all" || key === status ? undefined : key })}
        />
      )}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-2">
          <MienTabs
            active={f.mien}
            counts={{ "Miền Bắc": bac.data?.total_contracts, "Miền Nam": nam.data?.total_contracts }}
            hrefFor={(m) => withParams({ mien: m })}
          />
          <div className="flex-1" />
          <div className="flex items-center gap-2 py-1.5 pr-2">
            <span className="text-[13px] text-slate-500">{d ? `${fmtInt(d.total ?? 0)} hợp đồng` : ""}</span>
            <SearchBox placeholder="Tìm số HĐ, mã HĐ, khách hàng…" />
            <ExportButton payload={{ mien: f.mien, bu: f.bu, nhom_sp: f.nhom_sp, status }} />
          </div>
        </div>

        {list.loading && d && (
          <div className="px-3 pt-3">
            <RefreshingBar />
          </div>
        )}
        {!d || list.error ? (
          <div className="p-4">
            <LoadingBlock error={list.error} />
          </div>
        ) : (
          <>
            <div className="scroll-shadow overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="w-8" />
                    <th className="px-3 py-2 text-left font-semibold">Mã HĐ</th>
                    <th className="px-3 py-2 text-left font-semibold">Số HĐ</th>
                    <th className="px-3 py-2 text-left font-semibold">Mã KH</th>
                    <th className="px-3 py-2 text-left font-semibold">Khách hàng</th>
                    <th className="px-3 py-2 text-center font-semibold">Loại</th>
                    <th className="px-3 py-2 text-center font-semibold">Ngày ký</th>
                    <th className="px-3 py-2 text-center font-semibold">Thời hạn</th>
                    <th className="px-3 py-2 text-center font-semibold">Còn lại</th>
                    <th className="px-3 py-2 text-left font-semibold">PS</th>
                    <th className="px-3 py-2 text-left font-semibold">SO</th>
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
          </>
        )}
      </section>
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
      {rows.map((c) => {
        const isOpen = open.has(c.ma_hd);
        return (
          <Fragment key={c.ma_hd}>
            <tr
              onClick={() => toggle(c.ma_hd)}
              className={`cursor-pointer border-b border-slate-100 ${isOpen ? "bg-blue-50/60" : "hover:bg-blue-50/40"}`}
            >
              <td className="py-2 pl-2 text-slate-400">
                <ChevronRight size={14} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-blue-600">{c.ma_hd}</td>
              <td className="whitespace-nowrap px-3 py-2">{c.so_hd || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">{c.ma_kh || "—"}</td>
              <td className="max-w-[250px] truncate px-3 py-2" title={c.ten_kh ?? ""}>
                {c.ten_kh || "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-center">
                {c.loai_bv ? (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${c.loai_bv === "Công" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"}`}
                  >
                    {c.loai_bv}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums">{fmtDate(c.ngay_ky)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums">{fmtDate(c.thoi_han)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-center">
                <DaysBadge days={c.days_remaining} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">{c.ten_ps || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">{c.ten_so || "—"}</td>
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

  return (
    <tr>
      <td colSpan={COLUMNS} className="p-0">
        <div className="border-b-2 border-slate-200 bg-slate-50/70 py-2 pl-8 pr-3">
          {!d ? (
            <div className={`py-4 text-center text-[12px] ${detail.error ? "text-red-600" : "text-slate-400"}`}>
              {detail.error ? `Lỗi: ${detail.error}` : "Đang tải sản phẩm…"}
            </div>
          ) : items.length === 0 ? (
            <div className="py-4 text-center text-[12px] text-slate-400">Không có sản phẩm</div>
          ) : (
            <>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-2 py-1.5 text-center font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">Mã chung</th>
                    <th className="px-2 py-1.5 text-left font-medium">Mã NCC</th>
                    <th className="px-2 py-1.5 text-left font-medium">Tên hàng hóa</th>
                    <th className="px-2 py-1.5 text-center font-medium">Đơn giá</th>
                    <th className="px-2 py-1.5 text-center font-medium">SL thầu</th>
                    {fyList.map((fy) => (
                      <th key={fy.fy} className="whitespace-nowrap px-2 py-1.5 text-center font-medium text-blue-600">
                        SL bán {fy.label}
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-center font-medium">SL bán</th>
                    <th className="px-2 py-1.5 text-center font-medium">Còn lại</th>
                    <th className="px-2 py-1.5 text-left font-medium">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.id ?? i} className="border-b border-slate-100 last:border-0">
                      <td className="px-2 py-1.5 text-center text-slate-400">{i + 1}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-medium">{it.ma_chung || "—"}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{it.ma_ncc || "—"}</td>
                      <td className="max-w-[220px] truncate px-2 py-1.5" title={it.ten_hang_hoa ?? ""}>
                        {it.ten_hang_hoa || "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-center tabular-nums">{fmtMoney(it.don_gia)}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{fmtInt(it.so_luong_hd ?? 0)}</td>
                      {fyList.map((fy) => {
                        const v = it.fy_sold?.[`fy${fy.fy % 100}`] ?? 0;
                        return (
                          <td key={fy.fy} className={`px-2 py-1.5 text-center tabular-nums ${v > 0 ? "text-blue-600" : "text-slate-400"}`}>
                            {fmtInt(v)}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center tabular-nums">{fmtInt(it.so_luong_da_ban ?? 0)}</td>
                      <td className="px-2 py-1.5 text-center font-medium tabular-nums">
                        {it.is_bv_tu ? "—" : fmtInt(it.so_luong_con_lai ?? 0)}
                      </td>
                      <td className="px-2 py-1.5">{it.is_bv_tu ? <span className="text-slate-400">—</span> : <UsageBar item={it} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-1 text-[11px] text-slate-400">{items.length} sản phẩm</div>
            </>
          )}
        </div>
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
      className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-green-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      <Download size={14} />
      {busy ? "Đang xuất…" : "Xuất Excel"}
    </button>
  );
}
