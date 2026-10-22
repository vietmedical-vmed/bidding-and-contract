"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppShell, LoadingBlock, RefreshingBar } from "@/components/AppShell";
import { FilterSelect } from "@/components/FilterSelect";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { SearchBox } from "@/components/SearchBox";
import { fmtInt, parseFilters } from "@/lib/bids";
import { useApi } from "@/lib/useApi";

const KET_QUA: Record<string, string> = {
  trung: "Trúng",
  truot: "Trượt",
  cho_kq: "Chưa có KQ",
  huy: "Hủy",
};

const KQ_BADGE: Record<string, string> = {
  trung: "bg-blue-50 text-blue-700 border-blue-200",
  truot: "bg-red-50 text-red-700 border-red-200",
  cho_kq: "bg-slate-50 text-slate-500 border-slate-200",
  huy: "bg-slate-100 text-slate-500 border-slate-200",
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

// Fiscal year order (T4 → T3 of the next year), as in the month chart.
const MONTH_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((m) => `T${m}`);

function monthParam(v: string | null): number | undefined {
  const m = Number(v);
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : undefined;
}

/** "T1" of fiscal year 2025 is January 2026: show the calendar month and year. */
function bidMonth(r: Item): string {
  const m = Number(r.thang_du_thau?.replace(/\D/g, ""));
  if (!m) return r.thang_du_thau ?? "";
  return `T${m}/${m < 4 ? r.nam + 1 : r.nam}`;
}

const nf = new Intl.NumberFormat("vi-VN");
const num = (v: number | null) => (v === null ? "" : nf.format(v));
const date = (v: string | null) => (v ? v.split("-").reverse().join("/") : "");

export default function DetailPage() {
  return (
    <Suspense>
      <AppShell>
        <Detail />
      </AppShell>
    </Suspense>
  );
}

function Detail() {
  const params = useSearchParams();
  const f = parseFilters(params);
  const kq = params.get("kq") ?? undefined;
  const q = params.get("q") ?? undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const tu = monthParam(params.get("tu"));
  const den = monthParam(params.get("den"));
  const items = useApi<ItemsResp>("items", { ...f, kq, q, page, tu, den });
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox />
        <FilterSelect
          label="Từ tháng"
          options={MONTH_OPTIONS}
          selected={tu ? [`T${tu}`] : []}
          onChange={(v) => router.push(`${pathname}${withParams({ tu: v[0]?.slice(1), page: undefined })}`)}
        />
        <FilterSelect
          label="Đến tháng"
          options={MONTH_OPTIONS}
          selected={den ? [`T${den}`] : []}
          onChange={(v) => router.push(`${pathname}${withParams({ den: v[0]?.slice(1), page: undefined })}`)}
        />
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
          {[undefined, ...Object.keys(KET_QUA)].map((k) => (
            <Link
              key={k ?? "all"}
              href={withParams({ kq: k, page: undefined })}
              className={`rounded px-2.5 py-1 text-[13px] ${kq === k ? "bg-blue-500 font-medium text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {k ? KET_QUA[k] : "Tất cả"}
            </Link>
          ))}
        </div>
        <span className="ml-auto text-[13px] text-slate-500">{d ? `${fmtInt(d.total)} mặt hàng` : ""}</span>
      </div>

      {items.loading && d && <RefreshingBar />}
      {!d || items.error ? (
        <LoadingBlock error={items.error} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="scroll-shadow overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold">Tháng dự thầu</th>
                  <th className="px-3 py-2 text-left font-semibold">Số TBMT</th>
                  <th className="px-3 py-2 text-left font-semibold">Bên mời thầu / gói thầu</th>
                  <th className="px-3 py-2 text-left font-semibold">Mặt hàng</th>
                  <th className="px-3 py-2 text-left font-semibold">Nhóm SP</th>
                  <th className="px-3 py-2 text-left font-semibold">Miền / sale</th>
                  <th className="px-3 py-2 text-right font-semibold">SL</th>
                  <th className="px-3 py-2 text-right font-semibold">Đơn giá</th>
                  <th className="px-3 py-2 text-right font-semibold">Thành tiền</th>
                  <th className="px-3 py-2 text-left font-semibold">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`align-top ${i % 2 ? "bg-slate-50/50" : "bg-white"} hover:bg-blue-50/40`}>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                      {bidMonth(r)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.so_tbmt}</td>
                    <td className="max-w-72 px-3 py-2">
                      <div className="line-clamp-1 text-slate-800" title={r.ben_moi_thau ?? ""}>
                        {r.ben_moi_thau}
                      </div>
                      <div className="line-clamp-1 text-[11px] text-slate-400" title={r.ten_goi_thau ?? ""}>
                        {r.ten_goi_thau}
                      </div>
                    </td>
                    <td className="max-w-72 px-3 py-2">
                      <div className="line-clamp-2 text-slate-800" title={r.danh_muc_hang ?? ""}>
                        {r.danh_muc_hang}
                      </div>
                      {r.model && (
                        <div className="line-clamp-1 text-[11px] text-slate-400" title={r.model}>
                          {r.model}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-slate-800">{r.nhom_san_pham}</div>
                      <div className="text-[11px] text-slate-400">{r.bu}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="text-slate-800">{r.mien}</div>
                      <div className="text-[11px] text-slate-400">{r.sale}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(r.so_luong)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(r.don_gia)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{num(r.thanh_tien)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${KQ_BADGE[r.ket_qua] ?? KQ_BADGE.cho_kq}`}>
                        {r.ket_qua_thau ?? KET_QUA[r.ket_qua] ?? r.ket_qua}
                      </span>
                      {r.ngay_trung_thau && <div className="mt-0.5 text-[11px] text-slate-400">{date(r.ngay_trung_thau)}</div>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-slate-400">
                      Không có mặt hàng nào khớp bộ lọc
                    </td>
                  </tr>
                )}
              </tbody>
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

function PageLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "grid h-7 w-7 place-items-center rounded-md border border-slate-200";
  return href ? (
    <Link href={href} aria-label={label} className={`${cls} text-slate-600 hover:bg-slate-50`}>
      {children}
    </Link>
  ) : (
    <span aria-hidden className={`${cls} text-slate-300`}>
      {children}
    </span>
  );
}
