// Types and helpers for the contract-api pages (ported from contract-management's dashboard).

/** A row of contract_expiry_view. */
export type Contract = {
  ma_hd: string;
  so_hd: string | null;
  ma_kh: string | null;
  ten_kh: string | null;
  loai_bv: string | null;
  mien: string | null;
  ngay_ky: string | null;
  thoi_han: string | null;
  days_remaining: number | null;
  ten_ps: string | null;
  ten_so: string | null;
};

/** A row of contract_items_remaining_view (plus fy_sold from contract-detail). */
export type ContractItem = {
  id: number;
  ma_hd: string;
  so_hd: string | null;
  ten_kh: string | null;
  ma_chung: string | null;
  ma_ncc: string | null;
  ten_hang_hoa: string | null;
  don_gia: number | null;
  so_luong_hd: number | null;
  so_luong_da_ban: number | null;
  so_luong_con_lai: number | null;
  is_bv_tu?: boolean;
  fy_sold?: Record<string, number>;
};

export type Summary = {
  total_contracts: number;
  con_han_count: number;
  sap_het_han_count: number;
  het_han_count: number;
  ky_moi_count: number;
  max_warn_days: number;
  fy_label: string;
  expiry_alerts: Contract[];
  quantity_alerts: ContractItem[];
  quantity_warn_pct: number;
  last_invoice_date: string | null;
};

export type ContractList = { data: Contract[]; total: number; bu_list: string[]; nhom_sp_list: string[] };

export type ContractDetail = { contract: Contract; items: ContractItem[]; fy_list: { fy: number; label: string }[] };

/** The regions contract_contracts uses. */
export const MIEN_OPTIONS = ["Miền Bắc", "Miền Nam"];

/**
 * Contract status inside the current fiscal year (April → March), as contract-api counts it.
 * The four statuses split "all"; swatches follow the bidding palette (blue = active, grey = over).
 */
export const STATUSES = [
  { key: "all", label: "Tất cả", count: "total_contracts", swatch: "", sub: "" },
  { key: "con_han", label: "Còn hạn", count: "con_han_count", swatch: "bg-won", sub: "Không hết hạn trong năm" },
  { key: "ky_moi", label: "Ký mới", count: "ky_moi_count", swatch: "bg-blue-300", sub: "Ký mới trong năm" },
  { key: "sap_het", label: "Sắp hết hạn", count: "sap_het_han_count", swatch: "bg-amber-500", sub: "Hết hạn trong năm, chưa hết" },
  { key: "het_han", label: "Hết hạn", count: "het_han_count", swatch: "bg-pending", sub: "Đã hết hạn trong năm" },
] as const;

export type StatusKey = (typeof STATUSES)[number]["key"];

/** BU, nhóm SP and miền come from the URL (header filter row); the API reads "" as no filter. */
export function parseContractFilters(sp: URLSearchParams) {
  const mien = sp.get("mien") ?? "";
  return {
    bu: sp.get("bu") ?? "",
    nhom_sp: sp.get("nhom") ?? "",
    mien: MIEN_OPTIONS.includes(mien) ? mien : "",
  };
}

/** Share of the contract quantity already sold, 0–100. */
export function usedPct(it: Pick<ContractItem, "so_luong_hd" | "so_luong_con_lai">): number | null {
  const total = it.so_luong_hd ?? 0;
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(((total - (it.so_luong_con_lai ?? 0)) / total) * 100)));
}

/** yyyy-mm-dd[...] -> dd/mm/yyyy without going through Date (no timezone shift). */
export function fmtDate(v: string | null | undefined): string {
  return v ? v.slice(0, 10).split("-").reverse().join("/") : "—";
}

export function fmtMoney(n: number | null | undefined): string {
  return n ? `${n.toLocaleString("vi-VN")} đ` : "—";
}
