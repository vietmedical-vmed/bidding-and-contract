"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { FilterSelect } from "@/components/FilterSelect";
import { Modal } from "@/components/Modal";
import { RefreshCw, Settings } from "@/components/icons";
import { api, errorMessage } from "@/lib/api";
import { MIEN_OPTIONS, parseContractFilters, type ContractList } from "@/lib/contracts";
import { useApi } from "@/lib/useApi";

/** Filter row of the contract pages: BU, nhóm SP and miền (one each), plus the admin tools. */
export function ContractFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useAuth();
  const f = parseContractFilters(params);
  // list-contracts also returns the dropdown lists; nhóm SP narrows to the chosen BU.
  const options = useApi<ContractList>("list-contracts", { page_size: 1, bu: f.bu }, "contract");
  const opts = options.data;

  function setFilters(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <>
      {opts ? (
        <>
          <FilterSelect
            label="BU"
            options={opts.bu_list}
            selected={f.bu ? [f.bu] : []}
            onChange={(v) => setFilters({ bu: v[0], nhom: undefined })}
          />
          <FilterSelect
            label="Nhóm SP"
            searchable
            options={opts.nhom_sp_list}
            selected={f.nhom_sp ? [f.nhom_sp] : []}
            onChange={(v) => setFilters({ nhom: v[0] })}
          />
          <FilterSelect
            label="Miền"
            options={MIEN_OPTIONS}
            selected={f.mien ? [f.mien] : []}
            onChange={(v) => setFilters({ mien: v[0] })}
          />
          {(f.bu || f.nhom_sp || f.mien) && (
            <button
              type="button"
              onClick={() => setFilters({ bu: undefined, nhom: undefined, mien: undefined })}
              className="px-1 text-[13px] text-blue-600 hover:underline"
            >
              Bỏ lọc
            </button>
          )}
        </>
      ) : (
        <span className="text-[12px] text-slate-400">{options.error ?? "Đang tải bộ lọc…"}</span>
      )}
      <div className="flex-1" />
      {user.role === "admin" && (
        <>
          <SyncButton />
          <ConfigButton />
        </>
      )}
    </>
  );
}

const toolClass =
  "flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60";

/** Recomputes sold quantities from the invoices (fn_sync_sold_snapshot + fn_refresh_ngoai_khoa). */
function SyncButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{ updated?: number }>("sync-invoices", {}, "contract");
      setMsg({ ok: true, text: `Đồng bộ xong ${res.updated ?? 0} dòng. Bấm Reload để xem số mới.` });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={sync} disabled={busy} className={toolClass}>
        <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
        {busy ? "Đang đồng bộ…" : "Đồng bộ dữ liệu bán"}
      </button>
      {msg && (
        <div
          className={`absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded px-2 py-1 text-[12px] shadow-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

type AlertConfig = { contract_warn_days?: number[]; quantity_warn_pct?: number };

function ConfigButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={toolClass}>
        <Settings size={13} />
        Cấu hình cảnh báo
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cấu hình cảnh báo" icon={<Settings size={15} />} width={420}>
        {open && <ConfigForm />}
      </Modal>
    </>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function ConfigForm() {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ config: AlertConfig }>("get-config", {}, "contract")
      .then((res) => {
        setConfig(res.config ?? {});
        setDays((res.config?.contract_warn_days ?? []).join(", "));
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const warnDays = days
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    // contract-api takes Math.max/min of the list, so it must not be empty.
    if (!warnDays.length) {
      setError("Nhập ít nhất một mốc ngày (số nguyên dương)");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api("update-config", { config: { ...config, contract_warn_days: warnDays } }, "contract");
      setDays(warnDays.join(", "));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return <div className="px-4 py-8 text-center text-[13px] text-slate-400">{error || "Đang tải…"}</div>;
  }
  return (
    <form onSubmit={save} className="space-y-4 p-4 text-[13px]">
      <label className="block">
        <span className="font-medium text-slate-800">Cảnh báo hết hạn HĐ (ngày)</span>
        <span className="mb-1.5 block text-[12px] text-slate-500">Các mốc trước ngày hết hạn, cách nhau bằng dấu phẩy. VD: 30, 15</span>
        <input
          value={days}
          onChange={(e) => {
            setDays(e.target.value);
            setSaved(false);
          }}
          placeholder="30, 15"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="font-medium text-slate-800">Cảnh báo mức sử dụng thầu (%)</span>
        <span className="mb-1.5 block text-[12px] text-slate-500">Cảnh báo khi sản phẩm đã bán vượt ngưỡng này</span>
        <input
          type="number"
          min={1}
          max={100}
          value={config.quantity_warn_pct ?? 80}
          onChange={(e) => {
            setConfig({ ...config, quantity_warn_pct: Number(e.target.value) });
            setSaved(false);
          }}
          className={`${inputClass} max-w-[120px]`}
        />
      </label>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      {saved && <div className="rounded-md bg-green-50 px-3 py-2 text-green-700">Đã lưu. Bấm Reload để áp dụng.</div>}
      <button
        disabled={saving}
        className="rounded-md bg-blue-500 px-5 py-2 font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {saving ? "Đang lưu…" : "Lưu"}
      </button>
    </form>
  );
}
