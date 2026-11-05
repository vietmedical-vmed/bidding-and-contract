-- Migration 016: sold quantities by fiscal year for many contracts at once.
-- Same rule as fn_sold_by_fy (FY = April to March, FY25 = Apr 2025 - Mar 2026),
-- used by contract-api "export-contracts" to fill the "Bán FYxx" columns.
-- Ordered so the caller can page through the result with range().

CREATE OR REPLACE FUNCTION fn_sold_by_fy_multi(p_so_hd text[])
RETURNS TABLE(so_hd text, ma_chung text, fy int, sold numeric)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT inv.so_hd::text,
         inv.ma_chung::text,
         (CASE WHEN EXTRACT(MONTH FROM inv.ngay_tai_lieu) >= 4
               THEN EXTRACT(YEAR FROM inv.ngay_tai_lieu)
               ELSE EXTRACT(YEAR FROM inv.ngay_tai_lieu) - 1
          END)::int AS fy,
         SUM(COALESCE(inv.so_luong, 0))::numeric AS sold
  FROM app_contract.hoa_don_bovattu inv
  WHERE inv.so_hd = ANY(p_so_hd)
    AND inv.ma_chung IS NOT NULL
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
$$;
