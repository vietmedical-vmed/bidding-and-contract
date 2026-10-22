-- KPI counted by gói thầu (package = năm + số TBMT) instead of by mặt hàng.
--
-- A package's outcome within a segment (BU, nhóm SP, miền, sale, tháng) looks only at
-- the package's items in that segment:
--   trung  : at least one item won (includes packages won partially)
--   cho_kq : nothing won yet and at least one item still has no result
--   truot  : every item has a result and none was won (ignoring cancelled items)
--   huy    : every item was cancelled
-- Values (thành tiền) are still summed over items.
-- Additive: bid_kpi stays until the deployed bidding-api no longer calls it.

create or replace function public.bid_package_kpi(
  p_group text default null,  -- null = grand total; or nam | bu | nhom_san_pham | mien | sale | thang | ly_do
  p_nam integer default null,
  p_bu text default null,
  p_sale text default null,
  p_mien_in text[] default null, -- allowed / selected miền (null = all)
  p_nhom_in text[] default null  -- allowed / selected nhóm sản phẩm (null = all)
)
returns table (
  grp text,
  goi bigint,
  goi_trung bigint,
  goi_truot bigint,
  goi_huy bigint,
  goi_cho_kq bigint,
  mat_hang bigint,
  gia_tri_du_thau numeric,       -- thanh_tien of all items
  gia_tri_da_co_kq numeric,      -- thanh_tien of items won or lost
  gia_tri_du_thau_trung numeric  -- thanh_tien of items won
)
language sql
stable
set search_path = ''
as $$
  with items as (
    select
      case p_group
        when 'nam' then i.nam::text
        when 'bu' then i.bu
        when 'nhom_san_pham' then i.nhom_san_pham
        when 'mien' then i.mien
        when 'sale' then i.sale
        when 'thang' then i.thang_du_thau_so::text
        when 'ly_do' then i.ket_qua_thau
      end as grp,
      i.nam,
      coalesce(i.so_tbmt, 'row-' || i.id) as goi_key, -- an item without TBMT counts as its own package
      i.ket_qua,
      i.thanh_tien
    from public.bid_items i
    where (p_nam is null or i.nam = p_nam)
      and (p_bu is null or i.bu = p_bu)
      and (p_sale is null or i.sale = p_sale)
      and (p_mien_in is null or i.mien = any (p_mien_in))
      and (p_nhom_in is null or i.nhom_san_pham = any (p_nhom_in))
  ),
  packages as (
    select
      grp,
      case
        when bool_or(ket_qua = 'trung') then 'trung'
        when bool_or(ket_qua not in ('trung', 'truot', 'huy')) then 'cho_kq'
        when bool_or(ket_qua = 'truot') then 'truot'
        else 'huy'
      end as kq,
      count(*) as mat_hang,
      sum(thanh_tien) as tt,
      sum(thanh_tien) filter (where ket_qua in ('trung', 'truot')) as tt_co_kq,
      sum(thanh_tien) filter (where ket_qua = 'trung') as tt_trung
    from items
    group by grp, nam, goi_key
  )
  select
    grp,
    count(*) as goi,
    count(*) filter (where kq = 'trung') as goi_trung,
    count(*) filter (where kq = 'truot') as goi_truot,
    count(*) filter (where kq = 'huy') as goi_huy,
    count(*) filter (where kq = 'cho_kq') as goi_cho_kq,
    sum(mat_hang) as mat_hang,
    coalesce(sum(tt), 0) as gia_tri_du_thau,
    coalesce(sum(tt_co_kq), 0) as gia_tri_da_co_kq,
    coalesce(sum(tt_trung), 0) as gia_tri_du_thau_trung
  from packages
  group by grp
  order by 2 desc, 1;
$$;

revoke execute on function public.bid_package_kpi(text, integer, text, text, text[], text[]) from public, anon, authenticated;
grant execute on function public.bid_package_kpi(text, integer, text, text, text[], text[]) to service_role;
