-- Add ky_du_thau (bid month as a real date) to bid_items, so lists can be ordered
-- by fiscal period: each "So lieu <year>" sheet runs T4 of <year> to T3 of <year>+1,
-- so T1-T3 belong to the next calendar year (T1 of sheet 2025 = 2026-01-01).
-- create or replace view can only append columns; everything above stays identical.
-- Grants are unchanged (service_role only, see 20261022000300).

create or replace view public.bid_items
with (security_invoker = true)
as
select
  r.id,
  r.sheet_name,
  nullif(regexp_replace(r.sheet_name, '\D', '', 'g'), '')::integer as nam,
  r.source_row,

  -- Package
  r.data ->> 'thang_du_thau' as thang_du_thau,
  nullif(regexp_replace(r.data ->> 'thang_du_thau', '\D', '', 'g'), '')::integer as thang_du_thau_so,
  r.data ->> 'so_tbmt' as so_tbmt,
  r.data ->> 'tbmt' as tbmt,
  r.data ->> 'ben_moi_thau' as ben_moi_thau,
  r.data ->> 'ten_goi_thau' as ten_goi_thau,
  r.data ->> 'hinh_thuc_dau_thau' as hinh_thuc_dau_thau,
  (r.data ->> 'thoi_gian_dang_tai_bg')::date as thoi_gian_dang_tai_bg,
  (r.data ->> 'thoi_gian_nop_thau')::date as thoi_gian_nop_thau,
  (r.data ->> 'ngay_nhan_yeu_cau')::date as ngay_nhan_yeu_cau,
  r.data ->> 'mien' as mien,
  r.data ->> 'sale' as sale,
  r.data ->> 'pic' as pic,
  r.data ->> 'cong_ty_tham_du' as cong_ty_tham_du,
  r.data ->> 'nganh_hang' as nganh_hang,

  -- Item
  r.data ->> 'danh_muc_hang' as danh_muc_hang,
  r.data ->> 'model' as model,
  r.data ->> 'xuat_xu' as xuat_xu,
  r.data ->> 'yeu_cau_xuat_xu' as yeu_cau_xuat_xu,
  r.data ->> 'phan_loai' as phan_loai,
  r.data ->> 'nhom_san_pham' as nhom_san_pham,
  r.data ->> 'bu' as bu,
  r.data ->> 'dvt' as dvt,
  (r.data ->> 'so_luong')::numeric as so_luong,
  (r.data ->> 'don_gia')::numeric as don_gia,
  (r.data ->> 'thanh_tien')::numeric as thanh_tien,
  (r.data ->> 'gia_ke_hoach')::numeric as gia_ke_hoach,
  (r.data ->> 'chenh_lech_gia_du_thau_va_gia_ke_hoach')::numeric as chenh_lech_gia_ke_hoach,
  (r.data ->> 'bao_lanh')::numeric as bao_lanh,
  (r.data ->> 'gia_tri_hdtt')::numeric as gia_tri_hdtt,

  -- Result
  r.data ->> 'ket_qua_thau' as ket_qua_thau,
  coalesce(r.data ->> 'ket_qua_thau_chuan', 'cho_kq') as ket_qua,
  (r.data ->> 'gia_trung_thau')::numeric as gia_trung_thau,
  (r.data ->> 'ngay_trung_thau')::date as ngay_trung_thau,
  r.data ->> 'thang_co_kq_thau' as thang_co_kq_thau,
  r.data ->> 'ly_do_trung_truot' as ly_do_trung_truot,
  r.data ->> 'ket_qua_ca_goi_thau' as ket_qua_ca_goi_thau,
  r.data ->> 'ghi_chu' as ghi_chu,

  r.sync_run_id,
  r.loaded_at,

  -- Bid month as a date (first day of the month), in the calendar year it falls in.
  case
    when nullif(regexp_replace(r.data ->> 'thang_du_thau', '\D', '', 'g'), '')::integer between 1 and 12
     and nullif(regexp_replace(r.sheet_name, '\D', '', 'g'), '') is not null
    then make_date(
      nullif(regexp_replace(r.sheet_name, '\D', '', 'g'), '')::integer
        + case when nullif(regexp_replace(r.data ->> 'thang_du_thau', '\D', '', 'g'), '')::integer < 4 then 1 else 0 end,
      nullif(regexp_replace(r.data ->> 'thang_du_thau', '\D', '', 'g'), '')::integer,
      1
    )
  end as ky_du_thau
from public.stg_bid_rows r;
