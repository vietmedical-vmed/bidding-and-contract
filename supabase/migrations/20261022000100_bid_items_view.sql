-- Typed view over the staged item rows, for the web app.
-- security_invoker makes the view respect the RLS policies of stg_bid_rows.

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
  r.loaded_at
from public.stg_bid_rows r;

revoke all on public.bid_items from anon;
grant select on public.bid_items to authenticated, service_role;
