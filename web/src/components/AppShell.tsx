"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { AlertCircle, Loader2, LogOut, RefreshCw } from "@/components/icons";
import { ReloadContext } from "@/lib/useApi";

export type ModuleId = "thau" | "hop-dong";

const MODULES: Record<
  ModuleId,
  { title: string; label: string; filterKeys: string[]; tabs: { href: string; label: string }[] }
> = {
  thau: {
    title: "KẾT QUẢ THẦU",
    label: "Kết quả thầu",
    filterKeys: ["nam", "bu", "nhom", "mien", "sale"],
    tabs: [
      { href: "/thau/", label: "Tổng quan" },
      { href: "/thau/chi-tiet/", label: "Chi tiết mặt hàng" },
    ],
  },
  "hop-dong": {
    title: "QUẢN LÝ HỢP ĐỒNG",
    label: "Hợp đồng",
    filterKeys: ["bu", "nhom", "mien"],
    tabs: [
      { href: "/hop-dong/", label: "Tổng quan" },
      { href: "/hop-dong/danh-sach/", label: "Danh sách hợp đồng" },
    ],
  },
};

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  manager: { label: "Manager", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  product_manager: { label: "PM", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  area_manager: { label: "AM", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  ps: { label: "PS", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const isActive = (pathname: string, href: string) => pathname === href || pathname === href.replace(/\/$/, "");

/**
 * Header, module switch, filter row and tabs in the sale-target layout; pages render below it.
 * Each module brings its own filter row; tabs of the same module keep its filters in the URL.
 */
export function AppShell({
  module,
  filters,
  children,
}: {
  module: ModuleId;
  filters: React.ReactNode;
  children: React.ReactNode;
}) {
  const [nonce, setNonce] = useState(0);
  return (
    <ReloadContext.Provider value={nonce}>
      <Shell module={module} filters={filters} onReload={() => setNonce((n) => n + 1)}>
        {children}
      </Shell>
    </ReloadContext.Provider>
  );
}

function Shell({
  module,
  filters,
  onReload,
  children,
}: {
  module: ModuleId;
  filters: React.ReactNode;
  onReload: () => void;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();
  const m = MODULES[module];

  const keep = new URLSearchParams();
  for (const k of m.filterKeys) params.getAll(k).forEach((v) => keep.append(k, v));
  const filterQuery = keep.toString();

  const initials = (user.ho_ten || user.username || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const badge = ROLE_BADGE[user.role];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-500 text-sm font-bold text-white">
                {initials}
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold text-slate-900 md:text-lg">{m.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  {user.ho_ten || user.username}
                  {badge && (
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {(Object.keys(MODULES) as ModuleId[]).map((id) => (
                <Link
                  key={id}
                  href={MODULES[id].tabs[0].href}
                  className={`rounded px-3 py-1 text-[13px] ${id === module ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  {MODULES[id].label}
                </Link>
              ))}
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
          {filters}
        </div>

        <nav className="flex items-center gap-1 border-t border-slate-100 px-6">
          {m.tabs.map((t) => (
            <Link
              key={t.href}
              href={`${t.href}${filterQuery ? `?${filterQuery}` : ""}`}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${isActive(pathname, t.href) ? "border-blue-500 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </Link>
          ))}
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
