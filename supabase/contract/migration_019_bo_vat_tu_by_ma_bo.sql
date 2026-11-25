-- Migration 019: match contract items to shared.dm_bo_vat_tu by ma_bo_vat_tu as well as ma_chung.
-- Some contracts list a kit under its kit code instead of its ma_chung: contract
-- 83-25/HĐ/VIETCUONG-BVĐKTH has ma_chung = 'UL.ADD2' and 'UL.OBL', which are
-- dm_bo_vat_tu.ma_bo_vat_tu (their ma_chung are MC.UL.CT1.052 / .053). The product-group
-- filter, the BU filter and is_ngoai_khoa missed these items.
-- The functions keep their live signatures and search_path (fn_resolve_* were created
-- outside these files; fn_refresh_ngoai_khoa since moved to schema app_contract's search_path).

-- ============================================================
-- 1. Product-group filter
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_resolve_nhom_sp(p_nhom_sp text)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = public, extensions, app_contract
AS $$
  SELECT COALESCE(array_agg(DISTINCT ci.ma_hd), '{}')
  FROM contract_items ci
  WHERE ci.ma_chung IN (
    SELECT ma_chung FROM shared.dm_vat_tu WHERE nhom_san_pham = p_nhom_sp
    UNION
    SELECT ma_chung FROM shared.dm_bo_vat_tu WHERE nhom_san_pham = p_nhom_sp
    UNION
    SELECT ma_bo_vat_tu FROM shared.dm_bo_vat_tu WHERE nhom_san_pham = p_nhom_sp
  );
$$;

-- ============================================================
-- 2. BU filter
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_resolve_bu(p_bu text)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = public, extensions, app_contract
AS $$
  SELECT COALESCE(array_agg(DISTINCT ci.ma_hd), '{}')
  FROM contract_items ci
  WHERE ci.ma_chung IN (
    SELECT ma_chung FROM shared.dm_vat_tu WHERE bu = p_bu
    UNION
    SELECT ma_chung FROM shared.dm_bo_vat_tu WHERE bu = p_bu
    UNION
    SELECT ma_bo_vat_tu FROM shared.dm_bo_vat_tu WHERE bu = p_bu
  );
$$;

-- ============================================================
-- 3. is_ngoai_khoa
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_refresh_ngoai_khoa(p_ma_hd text[] DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shared, app_contract
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
        WHERE (dbv.ma_chung = ci.ma_chung OR dbv.ma_bo_vat_tu = ci.ma_chung)
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

REVOKE ALL ON FUNCTION public.fn_refresh_ngoai_khoa(text[]) FROM PUBLIC, anon, authenticated;

SELECT public.fn_refresh_ngoai_khoa();
