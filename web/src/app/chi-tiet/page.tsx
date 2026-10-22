"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Header } from "@/components/Header";
import { SearchBox } from "@/components/SearchBox";
import { fmtInt, parseFilters, toQuery, type FilterOptions } from "@/lib/bids";
import { useApi } from "@/lib/useApi";

const KET_QUA: Record<string, string> = {
  trung: "Trúng",
  truot: "Trượt",
  cho_kq: "Chưa có KQ",
  huy: "Hủy",
};

const KQ_DOT: Record<string, string> = {
  trung: "bg-series-1",
  truot: "bg-series-2",
  cho_kq: "bg-series-3",
};

type Item = {
  id: number;
  nam: number;
  thang_du_thau: string | null;
  so_tbmt: string | null;
  ben_moi_thau: string | null;
  ten_goi_thau: string | null;
  danh_muc_hang: string | null;
  model: string | null;
  nhom_san_pham: string | null;
  bu: string | null;
  mien: string | null;
  sale: string | null;
  so_luong: number | null;
  don_gia: number | null;
  thanh_tien: number | null;
  ket_qua: string;
  ket_qua_thau: string | null;
  ngay_trung_thau: string | null;
};

type ItemsResp = { rows: Item[]; total: number; page: number; pageSize: number };

const nf = new Intl.NumberFormat("vi-VN");
const num = (v: number | null) => (v === null ? "" : nf.format(v));
const date = (v: string | null) => (v ? v.split("-").reverse().join("/") : "");

export default function DetailPage() {
  return (
    <Suspense>
      <Detail />
    </Suspense>
  );
}

function Detail() {
  const params = useSearchParams();
  const f = parseFilters(params);
  const kq = params.get("kq") ?? undefined;
  const q = params.get("q") ?? undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const options = useApi<{ options: FilterOptions }>("filter-options", {});
  const items = useApi<ItemsResp>("items", { ...f, kq, q, page });

  /** Current URL with some params changed (undefined removes the param). */
  const withParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `?${next.toString()}`;
  };

  const d = items.data;
  const rows = d?.rows ?? [];
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;

  return (
    <>
      <Header current="/chi-tiet/" query={toQuery(f)} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {options.data && (
          <FilterBar options={options.data.options}>
            <SearchBox />
          </FilterBar>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-2">Kết quả:</span>
          {[undefined, ...Object.keys(KET_QUA)].map((k) => (
            <Link
              key={k ?? "all"}
              href={withParams({ kq: k, page: undefined })}
              className={`rounded-full border px-3 py-1 ${kq === k ? "border-accent text-ink" : "border-line text-ink-2 hover:text-ink"}`}
            >
              {k ? KET_QUA[k] : "Tất cả"}
            </Link>
          ))}
          <span className="ml-auto text-ink-2">{d ? `${fmtInt(d.total)} mặt hàng` : ""}</span>
        </div>

        {items.error && <p className="text-sm text-critical">Không tải được dữ liệu: {items.error}</p>}

        <div className={`card overflow-x-auto p-0 transition-opacity ${items.loading ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-3">
              <tr>
                <th className="px-3 py-2 font-normal">Năm / tháng</th>
                <th className="px-3 py-2 font-normal">Số TBMT</th>
                <th className="px-3 py-2 font-normal">Bên mời thầu / gói thầu</th>
                <th className="px-3 py-2 font-normal">Mặt hàng</th>
                <th className="px-3 py-2 font-normal">Nhóm SP</th>
                <th className="px-3 py-2 font-normal">Miền / sale</th>
                <th className="px-3 py-2 text-right font-normal">SL</th>
                <th className="px-3 py-2 text-right font-normal">Đơn giá</th>
                <th className="px-3 py-2 text-right font-normal">Thành tiền</th>
                <th className="px-3 py-2 font-normal">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0 hover:bg-page">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {r.nam} · {r.thang_du_thau}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.so_tbmt}</td>
                  <td className="max-w-72 px-3 py-2">
                    <div className="line-clamp-1" title={r.ben_moi_thau ?? ""}>
                      {r.ben_moi_thau}
                    </div>
                    <div className="line-clamp-1 text-xs text-ink-3" title={r.ten_goi_thau ?? ""}>
                      {r.ten_goi_thau}
                    </div>
                  </td>
                  <td className="max-w-72 px-3 py-2">
                    <div className="line-clamp-2" title={r.danh_muc_hang ?? ""}>
                      {r.danh_muc_hang}
                    </div>
                    {r.model && (
                      <div className="line-clamp-1 text-xs text-ink-3" title={r.model}>
                        {r.model}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.nhom_san_pham}</div>
                    <div className="text-xs text-ink-3">{r.bu}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div>{r.mien}</div>
                    <div className="text-xs text-ink-3">{r.sale}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(r.so_luong)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(r.don_gia)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(r.thanh_tien)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {KQ_DOT[r.ket_qua] && <span className={`h-2 w-2 rounded-full ${KQ_DOT[r.ket_qua]}`} aria-hidden />}
                      {r.ket_qua_thau ?? KET_QUA[r.ket_qua] ?? r.ket_qua}
                    </span>
                    {r.ngay_trung_thau && <div className="text-xs text-ink-3">{date(r.ngay_trung_thau)}</div>}
                  </td>
                </tr>
              ))}
              {d && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-ink-3">
                    Không có mặt hàng nào khớp bộ lọc.
                  </td>
                </tr>
              )}
              {!d && !items.error && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-ink-3">
                    Đang tải dữ liệu…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <nav className="flex items-center justify-end gap-3 text-sm" aria-label="Phân trang">
          <span className="text-ink-2">
            Trang {page} / {pages}
          </span>
          {page > 1 && (
            <Link href={withParams({ page: String(page - 1) })} className="rounded-md border border-line px-3 py-1 hover:bg-page">
              ← Trước
            </Link>
          )}
          {page < pages && (
            <Link href={withParams({ page: String(page + 1) })} className="rounded-md border border-line px-3 py-1 hover:bg-page">
              Sau →
            </Link>
          )}
        </nav>
      </main>
    </>
  );
}
