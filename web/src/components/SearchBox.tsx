"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "@/components/icons";

export function SearchBox({ placeholder = "Tìm mặt hàng, model, TBMT, bệnh viện…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const next = new URLSearchParams(params);
        if (value.trim()) next.set("q", value.trim());
        else next.delete("q");
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        className="w-72 rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-[13px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
