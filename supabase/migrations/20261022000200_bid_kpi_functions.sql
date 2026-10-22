-- Aggregations for the web dashboard. Computed in the database so the app never
-- has to page through bid_items (hosted PostgREST returns at most 1000 rows).
-- security invoker (default): RLS on stg_bid_rows still applies.

create or replace function public.bid_kpi(
  p_group text default null,  -- null = grand total; or nam | bu | nhom_san_pham | mien | sale | thang | ly_do
  p_nam integer default null,
  p_bu text default null,
  p_nhom text default null,
  p_mien text default null,
  p_sale text default null
)
returns table (
  grp text,
  items bigint,
  trung bigint,
  truot bigint,
  huy bigint,
  cho_kq bigint,
  gia_tri_du_thau numeric,       -- thanh_tien of all items
  gia_tri_da_co_kq numeric,      -- thanh_tien of items won or lost
  gia_tri_du_thau_trung numeric, -- thanh_tien of items won
  gia_tri_trung numeric          -- gia_trung_thau of items won
)
language sql
stable
set search_path = ''
as $$
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
    count(*) as items,
    count(*) filter (where i.ket_qua = 'trung') as trung,
    count(*) filter (where i.ket_qua = 'truot') as truot,
    count(*) filter (where i.ket_qua = 'huy') as huy,
    count(*) filter (where i.ket_qua not in ('trung', 'truot', 'huy')) as cho_kq,
    coalesce(sum(i.thanh_tien), 0) as gia_tri_du_thau,
    coalesce(sum(i.thanh_tien) filter (where i.ket_qua in ('trung', 'truot')), 0) as gia_tri_da_co_kq,
    coalesce(sum(i.thanh_tien) filter (where i.ket_qua = 'trung'), 0) as gia_tri_du_thau_trung,
    coalesce(sum(i.gia_trung_thau) filter (where i.ket_qua = 'trung'), 0) as gia_tri_trung
  from public.bid_items i
  where (p_nam is null or i.nam = p_nam)
    and (p_bu is null or i.bu = p_bu)
    and (p_nhom is null or i.nhom_san_pham = p_nhom)
    and (p_mien is null or i.mien = p_mien)
    and (p_sale is null or i.sale = p_sale)
  group by 1
  order by 2 desc;
$$;

-- Distinct values for the filter dropdowns.
create or replace function public.bid_filter_options()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'nam', (select coalesce(jsonb_agg(distinct nam order by nam desc), '[]') from public.bid_items where nam is not null),
    'bu', (select coalesce(jsonb_agg(distinct bu order by bu), '[]') from public.bid_items where bu is not null),
    'nhom_san_pham', (select coalesce(jsonb_agg(distinct nhom_san_pham order by nhom_san_pham), '[]') from public.bid_items where nhom_san_pham is not null),
    'mien', (select coalesce(jsonb_agg(distinct mien order by mien), '[]') from public.bid_items where mien is not null),
    'sale', (select coalesce(jsonb_agg(distinct sale order by sale), '[]') from public.bid_items where sale is not null)
  );
$$;

revoke execute on function public.bid_kpi(text, integer, text, text, text, text) from public, anon;
revoke execute on function public.bid_filter_options() from public, anon;
grant execute on function public.bid_kpi(text, integer, text, text, text, text) to authenticated, service_role;
grant execute on function public.bid_filter_options() to authenticated, service_role;
