"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { FilterSelect } from "@/components/FilterSelect";
import { AlertCircle, Loader2, LogOut, RefreshCw } from "@/components/icons";
import { parseFilters, toQuery, type FilterOptions } from "@/lib/bids";
import { ReloadContext, useApi } from "@/lib/useApi";

const TABS = [
  { href: "/", label: "Tổng quan" },
  { href: "/chi-tiet/", label: "Chi tiết mặt hàng" },
];

/** Header, filter row and tabs in the sale-target layout; pages render below it. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [nonce, setNonce] = useState(0);
  return (
    <ReloadContext.Provider value={nonce}>
      <Shell onReload={() => setNonce((n) => n + 1)}>{children}</Shell>
    </ReloadContext.Provider>
  );
}

function Shell({ onReload, children }: { onReload: () => void; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = parseFilters(params);
  const options = useApi<{ options: FilterOptions }>("filter-options", {});
  const opts = options.data?.options;

  function setFilter(key: string, values: string[]) {
    const next = new URLSearchParams(params);
    next.delete(key);
    values.forEach((v) => next.append(key, v));
    next.delete("page"); // any filter change starts from page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  const initials = (user.ho_ten || user.username || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // "Bỏ lọc" returns to the defaults, including the latest year.
  const hasFilter = Boolean(f.nam || f.bu || f.sale || f.nhom.length || f.mien.length);
  const filterQuery = toQuery(f);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-500 text-sm font-bold text-white">
              {initials}
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold text-slate-900 md:text-lg">KẾT QUẢ THẦU</div>
              <div className="mt-0.5 text-xs text-slate-500">{user.ho_ten || user.username}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-[9px] italic text-slate-400">
              Designed and developed by <span className="font-semibold not-italic text-slate-500">Do Hoang Giang</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReload}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700"
              >
                <RefreshCw size={14} />
                Reload
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-red-700"
              >
                <LogOut size={14} />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 px-6 py-2">
          <span className="pl-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lọc</span>
          {opts ? (
            <>
              <FilterSelect
                label="Năm"
                options={opts.nam.map(String)}
                // No year in the URL means the latest year (the API applies the same default).
                selected={f.nam === "all" ? [] : [String(f.nam ?? opts.nam[0] ?? "")].filter(Boolean)}
                onChange={(v) => setFilter("nam", v.length ? v : ["all"])}
              />
              <FilterSelect label="BU" options={opts.bu} selected={f.bu ? [f.bu] : []} onChange={(v) => setFilter("bu", v)} />
              <FilterSelect
                label="Nhóm SP"
                multiple
                options={opts.nhom_san_pham}
                selected={f.nhom}
                onChange={(v) => setFilter("nhom", v)}
              />
              {opts.mien.length > 1 && (
                <FilterSelect label="Miền" multiple options={opts.mien} selected={f.mien} onChange={(v) => setFilter("mien", v)} />
              )}
              <FilterSelect
                label="Sale"
                searchable
                options={opts.sale}
                selected={f.sale ? [f.sale] : []}
                onChange={(v) => setFilter("sale", v)}
              />
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => router.push(pathname)}
                  className="px-1 text-[13px] text-blue-600 hover:underline"
                >
                  Bỏ lọc
                </button>
              )}
            </>
          ) : (
            <span className="text-[12px] text-slate-400">{options.error ?? "Đang tải bộ lọc…"}</span>
          )}
        </div>

        <nav className="flex items-center gap-1 border-t border-slate-100 px-6">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname === t.href.replace(/\/$/, "");
            return (
              <Link
                key={t.href}
                href={`${t.href}${filterQuery ? `?${filterQuery}` : ""}`}
                className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${active ? "border-blue-500 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="px-6 py-4">{children}</main>
    </div>
  );
}

/** Full-area loader with elapsed time, so a slow first load never looks frozen. */
export function LoadingBlock({ error }: { error?: string | null }) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-[13px] text-red-700">
        <span className="flex items-center gap-1.5">
          <AlertCircle size={14} /> Không tải được dữ liệu: {error}
        </span>
        <span className="text-[12px] text-red-600">Bấm Reload trên header để thử lại.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-[13px] text-slate-500">
      <div className="spinner" />
      Đang tải dữ liệu…
    </div>
  );
}

/** Thin bar shown while new data loads over the current one (same as sale-target). */
export function RefreshingBar() {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] text-blue-700">
      <Loader2 size={12} className="animate-spin" />
      Đang cập nhật dữ liệu…
    </div>
  );
}
