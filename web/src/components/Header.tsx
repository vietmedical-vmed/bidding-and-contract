"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthGate";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/chi-tiet/", label: "Chi tiết mặt hàng" },
];

export function Header({ current, query }: { current: string; query: string }) {
  const { user, logout } = useAuth();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-6">
        <span className="hidden font-semibold sm:inline">Kết quả thầu</span>
        <nav className="flex gap-4 whitespace-nowrap text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={`${l.href}${query ? `?${query}` : ""}`}
              className={l.href === current ? "font-medium text-ink" : "text-ink-2 hover:text-ink"}
              aria-current={l.href === current ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-ink-2 md:inline">{user.ho_ten}</span>
          <button type="button" onClick={logout} className="whitespace-nowrap text-ink-2 hover:text-ink">
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
