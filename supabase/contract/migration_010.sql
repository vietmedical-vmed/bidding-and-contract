-- Migration 010: Replace PostgREST .in() sync with Postgres RPC function
-- Fixes: so_hd with special chars (/, Đ) not matching via PostgREST .in() filter

CREATE OR REPLACE FUNCTION fn_sync_sold_snapshot(p_avg_months int DEFAULT 3)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_since date := current_date - (p_avg_months || ' months')::interval;
  v_count int;
BEGIN
  -- Upsert total sold + avg daily from invoices, joined directly in SQL
  WITH contract_so_hd AS (
    SELECT DISTINCT so_hd
    FROM contract_contracts
    WHERE so_hd IS NOT NULL
  ),
  totals AS (
    SELECT inv.so_hd,
           inv.ma_san_pham AS ma_ncc,
           SUM(COALESCE(inv.so_luong, 0)) AS so_luong_ban
    FROM app_sale.hoa_don_bovattu inv
    INNER JOIN contract_so_hd c ON c.so_hd = inv.so_hd
    WHERE inv.ma_san_pham IS NOT NULL
    GROUP BY inv.so_hd, inv.ma_san_pham
  ),
  recent_stats AS (
    SELECT inv.so_hd,
           inv.ma_san_pham AS ma_ncc,
           SUM(COALESCE(inv.so_luong, 0)) AS recent_sold,
           COUNT(DISTINCT inv.ngay_tai_lieu::date) AS days_with_sales
    FROM app_sale.hoa_don_bovattu inv
    INNER JOIN contract_so_hd c ON c.so_hd = inv.so_hd
    WHERE inv.ma_san_pham IS NOT NULL
      AND inv.ngay_tai_lieu >= v_since
    GROUP BY inv.so_hd, inv.ma_san_pham
  ),
  upserted AS (
    INSERT INTO contract_sold_snapshot (so_hd, ma_ncc, so_luong_ban, avg_daily_3m, synced_at)
    SELECT t.so_hd,
           t.ma_ncc,
           t.so_luong_ban,
           COALESCE(ROUND(r.recent_sold / NULLIF(r.days_with_sales, 0), 2), 0),
           now()
    FROM totals t
    LEFT JOIN recent_stats r ON r.so_hd = t.so_hd AND r.ma_ncc = t.ma_ncc
    ON CONFLICT (so_hd, ma_ncc) DO UPDATE SET
      so_luong_ban = EXCLUDED.so_luong_ban,
      avg_daily_3m = EXCLUDED.avg_daily_3m,
      synced_at    = EXCLUDED.synced_at
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upserted;

  RETURN v_count;
END;
$$;
