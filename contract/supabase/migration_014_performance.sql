-- Migration 014: Performance — pre-compute is_ngoai_khoa + indexes
-- Root cause: 3 correlated EXISTS subqueries per row in both views
-- Fix: store is_ngoai_khoa on contract_contracts, views read column directly

-- ============================================================
-- 1. Indexes for resolve functions and view JOINs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ci_ma_chung ON contract_items (ma_chung);
CREATE INDEX IF NOT EXISTS idx_dmvt_ma_ncc_bu ON shared.dm_vat_tu (ma_ncc, bu);
CREATE INDEX IF NOT EXISTS idx_dmvt_ma_chung_bu ON shared.dm_vat_tu (ma_chung, bu);
CREATE INDEX IF NOT EXISTS idx_dmbvt_ma_chung_bu ON shared.dm_bo_vat_tu (ma_chung, bu);

-- ============================================================
-- 2. Add is_ngoai_khoa column
-- ============================================================
ALTER TABLE contract_contracts
  ADD COLUMN IF NOT EXISTS is_ngoai_khoa BOOLEAN DEFAULT false;

-- ============================================================
-- 3. Function to refresh is_ngoai_khoa (call after contract import)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_refresh_ngoai_khoa()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count int;
BEGIN
  WITH nk AS (
    SELECT DISTINCT ci.ma_hd
    FROM contract_items ci
    WHERE EXISTS (
        SELECT 1 FROM shared.dm_vat_tu dmv
        WHERE dmv.ma_ncc = ci.ma_ncc
        AND dmv.bu IN ('CH&CS', 'CTTM & CTUT', 'THNS &CSVT', 'THNS & CSVT')
    )
    OR EXISTS (
        SELECT 1 FROM shared.dm_vat_tu dmv2
        WHERE dmv2.ma_chung = ci.ma_chung
        AND dmv2.bu IN ('CH&CS', 'CTTM & CTUT', 'THNS &CSVT', 'THNS & CSVT')
    )
    OR EXISTS (
        SELECT 1 FROM shared.dm_bo_vat_tu dbv
        WHERE dbv.ma_chung = ci.ma_chung
        AND dbv.bu IN ('CH&CS', 'CTTM & CTUT', 'THNS &CSVT', 'THNS & CSVT')
    )
  ),
  updated AS (
    UPDATE contract_contracts cc
    SET is_ngoai_khoa = (EXISTS (SELECT 1 FROM nk WHERE nk.ma_hd = cc.ma_hd))
    WHERE cc.is_ngoai_khoa IS DISTINCT FROM (EXISTS (SELECT 1 FROM nk WHERE nk.ma_hd = cc.ma_hd))
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 4. Populate is_ngoai_khoa for existing data
-- ============================================================
SELECT fn_refresh_ngoai_khoa();

-- Partial index: most queries filter is_ngoai_khoa = true
CREATE INDEX IF NOT EXISTS idx_cc_ngoai_khoa ON contract_contracts (thoi_han, mien)
  WHERE is_ngoai_khoa = true;

-- ============================================================
-- 5. Recreate expiry view — read stored column, no EXISTS
-- ============================================================
DROP VIEW IF EXISTS contract_expiry_view;
CREATE VIEW contract_expiry_view AS
SELECT
    c.ma_hd,
    c.so_hd,
    c.ma_kh,
    c.ten_kh,
    c.mien,
    c.khay,
    c.ngay_ky,
    c.thoi_han,
    (c.thoi_han - CURRENT_DATE) AS days_remaining,
    c.ten_ps,
    c.ten_so,
    CASE
        WHEN (c.thoi_han - CURRENT_DATE) > 0 AND (c.thoi_han - CURRENT_DATE) <= 30 THEN 1
        WHEN (c.thoi_han - CURRENT_DATE) > 30 THEN 2
        ELSE 3
    END AS status_order,
    c.is_ngoai_khoa,
    CASE
        WHEN LOWER(kh.type_lvl2) = 'công' THEN 'Công'
        WHEN LOWER(kh.type_lvl2) = 'tư' THEN 'Tư'
        WHEN LOWER(kh.type_lvl1) LIKE '%công%' THEN 'Công'
        WHEN LOWER(kh.type_lvl1) LIKE '%tư%' THEN 'Tư'
    END AS loai_bv
FROM contract_contracts c
LEFT JOIN shared.dm_khach_hang kh ON kh.customer_id = c.ma_kh
WHERE c.thoi_han IS NOT NULL;

-- ============================================================
-- 6. Recreate items view — read stored column, no EXISTS
-- ============================================================
DROP VIEW IF EXISTS contract_items_remaining_view;
CREATE VIEW contract_items_remaining_view AS
WITH items_grouped AS (
    SELECT
        MIN(ci.id) AS id,
        ci.ma_hd,
        ci.ma_chung,
        ci.ma_ncc,
        ci.ten_hang_hoa,
        SUM(ci.so_luong) AS so_luong_hd,
        ci.don_gia
    FROM contract_items ci
    GROUP BY ci.ma_hd, ci.ma_chung, ci.ma_ncc, ci.ten_hang_hoa, ci.don_gia
)
SELECT
    ig.id,
    ig.ma_hd,
    cc.so_hd,
    cc.ma_kh,
    cc.ten_kh,
    cc.mien,
    cc.khay,
    cc.thoi_han,
    ig.ma_chung,
    ig.ma_ncc,
    ig.ten_hang_hoa,
    ig.so_luong_hd,
    ig.don_gia,
    COALESCE(css.so_luong_ban, 0) AS so_luong_da_ban,
    CASE
        WHEN kh.type_lvl2 = 'Tư'
        THEN GREATEST(ig.so_luong_hd - COALESCE(css.so_luong_ban, 0), 0)
        ELSE ig.so_luong_hd - COALESCE(css.so_luong_ban, 0)
    END AS so_luong_con_lai,
    COALESCE(css.avg_daily_3m, 0) AS avg_daily_3m,
    css.synced_at,
    cc.is_ngoai_khoa,
    (kh.type_lvl2 = 'Tư') AS is_bv_tu,
    CASE
        WHEN LOWER(kh.type_lvl2) = 'công' THEN 'Công'
        WHEN LOWER(kh.type_lvl2) = 'tư' THEN 'Tư'
        WHEN LOWER(kh.type_lvl1) LIKE '%công%' THEN 'Công'
        WHEN LOWER(kh.type_lvl1) LIKE '%tư%' THEN 'Tư'
    END AS loai_bv
FROM items_grouped ig
JOIN contract_contracts cc ON cc.ma_hd = ig.ma_hd
LEFT JOIN shared.dm_khach_hang kh ON kh.customer_id = cc.ma_kh
LEFT JOIN contract_sold_snapshot css
    ON css.so_hd = cc.so_hd AND css.ma_chung = ig.ma_chung;
