-- The web app now reads data only through the bidding-api Edge Function
-- (org-wide login: shared.users + HMAC token), which uses the service_role key
-- and applies per-user scope itself. Supabase Auth users get no access.

-- 1. Remove the direct-read path for Supabase Auth users.
drop policy if exists bid_sync_runs_read on public.bid_sync_runs;
drop policy if exists stg_bid_rows_read on public.stg_bid_rows;
drop policy if exists bid_sheets_read on public.bid_sheets;
revoke select on public.bid_sync_runs, public.stg_bid_rows, public.bid_sheets from authenticated;
revoke select on public.bid_items from authenticated;

-- 2. KPI and filter options with scope lists (miền / nhóm sản phẩm the user may see).
drop function if exists public.bid_kpi(text, integer, text, text, text, text);
drop function if exists public.bid_filter_options();

create or replace function public.bid_kpi(
  p_group text default null,  -- null = grand total; or nam | bu | nhom_san_pham | mien | sale | thang | ly_do
  p_nam integer default null,
  p_bu text default null,
  p_nhom text default null,
  p_mien text default null,
  p_sale text default null,
  p_mien_in text[] default null, -- scope: allowed miền (null = all)
  p_nhom_in text[] default null  -- scope: allowed nhóm sản phẩm (null = all)
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
    and (p_mien_in is null or i.mien = any (p_mien_in))
    and (p_nhom_in is null or i.nhom_san_pham = any (p_nhom_in))
  group by 1
  order by 2 desc;
$$;

-- Distinct values for the filter dropdowns, limited to the user's scope.
create or replace function public.bid_filter_options(
  p_mien_in text[] default null,
  p_nhom_in text[] default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with s as (
    select * from public.bid_items
    where (p_mien_in is null or mien = any (p_mien_in))
      and (p_nhom_in is null or nhom_san_pham = any (p_nhom_in))
  )
  select jsonb_build_object(
    'nam', (select coalesce(jsonb_agg(distinct nam order by nam desc), '[]') from s where nam is not null),
    'bu', (select coalesce(jsonb_agg(distinct bu order by bu), '[]') from s where bu is not null),
    'nhom_san_pham', (select coalesce(jsonb_agg(distinct nhom_san_pham order by nhom_san_pham), '[]') from s where nhom_san_pham is not null),
    'mien', (select coalesce(jsonb_agg(distinct mien order by mien), '[]') from s where mien is not null),
    'sale', (select coalesce(jsonb_agg(distinct sale order by sale), '[]') from s where sale is not null)
  );
$$;

revoke execute on function public.bid_kpi(text, integer, text, text, text, text, text[], text[]) from public, anon, authenticated;
revoke execute on function public.bid_filter_options(text[], text[]) from public, anon, authenticated;
grant execute on function public.bid_kpi(text, integer, text, text, text, text, text[], text[]) to service_role;
grant execute on function public.bid_filter_options(text[], text[]) to service_role;
