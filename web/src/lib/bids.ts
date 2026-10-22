/** Counts are gói thầu (packages); trung/truot/huy/cho_kq split them by package outcome. */
export type KpiRow = {
  grp: string | null;
  goi: number;
  trung: number;
  truot: number;
  huy: number;
  cho_kq: number;
  mat_hang: number;
  gia_tri_du_thau: number;
  gia_tri_da_co_kq: number;
  gia_tri_du_thau_trung: number;
};

export type FilterOptions = {
  nam: number[];
  bu: string[];
  nhom_san_pham: string[];
  mien: string[];
  sale: string[];
};

/** Năm, BU, sale: one value. Nhóm SP, miền: several (repeated URL params). */
export type Filters = {
  nam?: number;
  bu?: string;
  sale?: string;
  nhom: string[];
  mien: string[];
};

export const FILTER_KEYS = ["nam", "bu", "nhom", "mien", "sale"] as const;

export function parseFilters(sp: URLSearchParams): Filters {
  const nam = Number(sp.get("nam"));
  const str = (k: string) => sp.get(k) || undefined;
  return {
    nam: Number.isInteger(nam) && nam > 0 ? nam : undefined,
    bu: str("bu"),
    sale: str("sale"),
    nhom: sp.getAll("nhom").filter(Boolean),
    mien: sp.getAll("mien").filter(Boolean),
  };
}

type QueryValue = string | number | string[] | undefined;

/** Query string for the given filters (plus overrides); empty values are dropped. */
export function toQuery(f: Partial<Filters>, extra: Record<string, QueryValue> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra } as Record<string, QueryValue>)) {
    for (const item of Array.isArray(v) ? v : [v]) {
      if (item !== undefined && item !== "") q.append(k, String(item));
    }
  }
  return q.toString();
}

/** bigint/numeric arrive as strings when large; normalize to numbers. */
export function toKpiRow(r: Record<string, unknown>): KpiRow {
  return {
    grp: (r.grp as string | null) ?? null,
    goi: Number(r.goi),
    trung: Number(r.goi_trung),
    truot: Number(r.goi_truot),
    huy: Number(r.goi_huy),
    cho_kq: Number(r.goi_cho_kq),
    mat_hang: Number(r.mat_hang),
    gia_tri_du_thau: Number(r.gia_tri_du_thau),
    gia_tri_da_co_kq: Number(r.gia_tri_da_co_kq),
    gia_tri_du_thau_trung: Number(r.gia_tri_du_thau_trung),
  };
}

/** Win rate by package count, over packages that already have a result (won or lost). */
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
