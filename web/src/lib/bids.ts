export type KpiRow = {
  grp: string | null;
  items: number;
  trung: number;
  truot: number;
  huy: number;
  cho_kq: number;
  gia_tri_du_thau: number;
  gia_tri_da_co_kq: number;
  gia_tri_du_thau_trung: number;
  gia_tri_trung: number;
};

export type FilterOptions = {
  nam: number[];
  bu: string[];
  nhom_san_pham: string[];
  mien: string[];
  sale: string[];
};

export type Filters = {
  nam?: number;
  bu?: string;
  nhom?: string;
  mien?: string;
  sale?: string;
};

export const FILTER_KEYS = ["nam", "bu", "nhom", "mien", "sale"] as const;

export function parseFilters(sp: URLSearchParams): Filters {
  const nam = Number(sp.get("nam"));
  const str = (k: string) => sp.get(k) || undefined;
  return {
    nam: Number.isInteger(nam) && nam > 0 ? nam : undefined,
    bu: str("bu"),
    nhom: str("nhom"),
    mien: str("mien"),
    sale: str("sale"),
  };
}

/** Query string for the given filters (plus overrides); undefined values are dropped. */
export function toQuery(f: Filters, extra: Record<string, string | number | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

/** bigint/numeric arrive as strings when large; normalize to numbers. */
export function toKpiRow(r: Record<string, unknown>): KpiRow {
  return {
    grp: (r.grp as string | null) ?? null,
    items: Number(r.items),
    trung: Number(r.trung),
    truot: Number(r.truot),
    huy: Number(r.huy),
    cho_kq: Number(r.cho_kq),
    gia_tri_du_thau: Number(r.gia_tri_du_thau),
    gia_tri_da_co_kq: Number(r.gia_tri_da_co_kq),
    gia_tri_du_thau_trung: Number(r.gia_tri_du_thau_trung),
    gia_tri_trung: Number(r.gia_tri_trung),
  };
}

/** Win rate by item count, over items that already have a result (won or lost). */
export function winRate(r: Pick<KpiRow, "trung" | "truot">): number | null {
  const decided = r.trung + r.truot;
  return decided ? r.trung / decided : null;
}

/** Win rate by bid value (thành tiền), over items that already have a result. */
export function valueWinRate(r: Pick<KpiRow, "gia_tri_du_thau_trung" | "gia_tri_da_co_kq">): number | null {
  return r.gia_tri_da_co_kq ? r.gia_tri_du_thau_trung / r.gia_tri_da_co_kq : null;
}

const nf = new Intl.NumberFormat("vi-VN");

export function fmtInt(n: number): string {
  return nf.format(n);
}

export function fmtPct(n: number | null): string {
  return n === null ? "–" : `${(n * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

/** Compact VND: 1,23 tỷ / 456 tr. */
export function fmtVnd(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  return nf.format(n);
}
