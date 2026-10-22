"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  return (
    <form
      className="flex flex-col gap-1 text-xs text-ink-2"
      onSubmit={(e) => {
        e.preventDefault();
        const next = new URLSearchParams(params);
        if (value.trim()) next.set("q", value.trim());
        else next.delete("q");
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      Tìm kiếm
      <input
        type="search"
        className="input w-64"
        placeholder="Mặt hàng, model, TBMT, bệnh viện…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
