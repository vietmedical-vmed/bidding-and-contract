-- Migration 017: quantity sold read from the invoices again, not from the snapshot.
-- Migration 014 rebuilt contract_items_remaining_view on contract_sold_snapshot, which is
-- only refreshed by the "Đồng bộ dữ liệu bán" button (fn_sync_sold_snapshot). Between
-- refreshes, so_luong_da_ban lagged behind the "Bán FYxx" numbers, which fn_sold_by_fy and
-- fn_sold_by_fy_multi read from app_contract.hoa_don_bovattu, so the per-year sales did not
-- add up to the total. The view now sums the invoices itself, with the same rule as those
-- functions. avg_daily_3m and synced_at still come from the snapshot.
-- Same columns, names and types as before, so CREATE OR REPLACE keeps the grants.

CREATE OR REPLACE VIEW contract_items_remaining_view AS
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
LEFT JOIN sold_totals st ON st.so_hd = cc.so_hd AND st.ma_chung = ig.ma_chung
LEFT JOIN contract_sold_snapshot css ON css.so_hd = cc.so_hd AND css.ma_chung = ig.ma_chung;
