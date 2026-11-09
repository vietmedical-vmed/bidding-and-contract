-- Migration 018: drop the sold-quantity snapshot and keep is_ngoai_khoa current with a trigger.
-- Since migration 017 the quantity sold comes straight from the invoices, so the only things
-- left in contract_sold_snapshot were avg_daily_3m and synced_at, which nothing reads. The
-- "Đồng bộ dữ liệu bán" button (contract-api "sync-invoices") is removed with it.
-- That button also ran fn_refresh_ngoai_khoa, the only way is_ngoai_khoa got set for newly
-- imported contracts. A trigger on contract_items now recomputes it for the contracts whose
-- items change. A BU change in shared.dm_vat_tu / dm_bo_vat_tu is not seen by the trigger;
-- run SELECT fn_refresh_ngoai_khoa(); by hand after one.

-- ============================================================
-- 1. fn_refresh_ngoai_khoa: optional list of contracts (NULL = all)
-- ============================================================
DROP FUNCTION IF EXISTS fn_refresh_ngoai_khoa();

CREATE FUNCTION fn_refresh_ngoai_khoa(p_ma_hd text[] DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shared
AS $$
DECLARE v_count int;
BEGIN
  WITH nk AS (
    SELECT DISTINCT ci.ma_hd
    FROM contract_items ci
    WHERE (p_ma_hd IS NULL OR ci.ma_hd = ANY(p_ma_hd))
    AND (
      EXISTS (
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
    )
  ),
  updated AS (
    UPDATE contract_contracts cc
    SET is_ngoai_khoa = (EXISTS (SELECT 1 FROM nk WHERE nk.ma_hd = cc.ma_hd))
    WHERE (p_ma_hd IS NULL OR cc.ma_hd = ANY(p_ma_hd))
      AND cc.is_ngoai_khoa IS DISTINCT FROM (EXISTS (SELECT 1 FROM nk WHERE nk.ma_hd = cc.ma_hd))
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION fn_refresh_ngoai_khoa(text[]) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. Trigger on contract_items (one per event: transition tables allow only one)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_contract_items_ngoai_khoa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shared
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_refresh_ngoai_khoa(ARRAY(SELECT DISTINCT ma_hd FROM new_rows));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM fn_refresh_ngoai_khoa(ARRAY(
      SELECT ma_hd FROM new_rows UNION SELECT ma_hd FROM old_rows));
  ELSE
    PERFORM fn_refresh_ngoai_khoa(ARRAY(SELECT DISTINCT ma_hd FROM old_rows));
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION fn_contract_items_ngoai_khoa() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contract_items_ngoai_khoa_ins ON contract_items;
DROP TRIGGER IF EXISTS trg_contract_items_ngoai_khoa_upd ON contract_items;
DROP TRIGGER IF EXISTS trg_contract_items_ngoai_khoa_del ON contract_items;

CREATE TRIGGER trg_contract_items_ngoai_khoa_ins
  AFTER INSERT ON contract_items
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION fn_contract_items_ngoai_khoa();

CREATE TRIGGER trg_contract_items_ngoai_khoa_upd
  AFTER UPDATE ON contract_items
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION fn_contract_items_ngoai_khoa();

CREATE TRIGGER trg_contract_items_ngoai_khoa_del
  AFTER DELETE ON contract_items
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION fn_contract_items_ngoai_khoa();

-- ============================================================
-- 3. Items view without the snapshot columns (avg_daily_3m, synced_at)
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
),
sold_totals AS (
    SELECT
        inv.so_hd,
        inv.ma_chung,
        SUM(COALESCE(inv.so_luong, 0))::numeric AS so_luong_ban
    FROM app_contract.hoa_don_bovattu inv
    WHERE inv.ma_chung IS NOT NULL
    GROUP BY inv.so_hd, inv.ma_chung
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
    COALESCE(st.so_luong_ban, 0) AS so_luong_da_ban,
    CASE
        WHEN kh.type_lvl2 = 'Tư'
        THEN GREATEST(ig.so_luong_hd - COALESCE(st.so_luong_ban, 0), 0)
        ELSE ig.so_luong_hd - COALESCE(st.so_luong_ban, 0)
    END AS so_luong_con_lai,
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
LEFT JOIN sold_totals st ON st.so_hd = cc.so_hd AND st.ma_chung = ig.ma_chung;

-- Same access as the old view: only the edge function (service_role) reads it.
REVOKE ALL ON contract_items_remaining_view FROM PUBLIC, anon, authenticated;
GRANT ALL ON contract_items_remaining_view TO service_role;

-- ============================================================
-- 4. Drop the snapshot, its sync function and its setting
-- ============================================================
DROP FUNCTION IF EXISTS fn_sync_sold_snapshot(int);
DROP TABLE IF EXISTS contract_sold_snapshot;
DELETE FROM contract_alert_config WHERE key = 'avg_period_months';
