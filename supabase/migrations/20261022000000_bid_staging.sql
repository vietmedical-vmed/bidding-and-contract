-- Staging layer for the bid report Excel file.
-- Each sync replaces the rows of a sheet atomically; typed tables/views for the
-- web app are built on top of stg_bid_rows once the column mapping is final.

create table public.bid_sync_runs (
  id bigint generated always as identity primary key,
  source_name text not null,
  source_etag text,
  source_modified_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  row_count integer,
  issue_count integer,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index bid_sync_runs_last_success_idx
  on public.bid_sync_runs (source_name, id desc)
  where status = 'success';

create table public.stg_bid_rows (
  id bigint generated always as identity primary key,
  sync_run_id bigint not null references public.bid_sync_runs (id),
  sheet_name text not null,
  source_row integer not null,
  data jsonb not null,
  loaded_at timestamptz not null default now(),
  unique (sheet_name, source_row)
);

create index stg_bid_rows_sync_run_id_idx on public.stg_bid_rows (sync_run_id);

-- Last loaded content per sheet; the ETL skips sheets whose hash is unchanged
-- (e.g. the closed "So lieu 2025" sheet).
create table public.bid_sheets (
  sheet_name text primary key,
  content_hash text not null,
  row_count integer not null,
  sync_run_id bigint not null references public.bid_sync_runs (id),
  loaded_at timestamptz not null default now()
);

create index bid_sheets_sync_run_id_idx on public.bid_sheets (sync_run_id);

-- Replace every row of one sheet in a single transaction.
create or replace function public.replace_stg_bid_rows(p_run_id bigint, p_sheet text, p_hash text, p_rows jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted integer;
begin
  delete from public.stg_bid_rows where sheet_name = p_sheet;

  insert into public.stg_bid_rows (sync_run_id, sheet_name, source_row, data)
  select p_run_id, p_sheet, (r ->> '_source_row')::integer, r - '_source_row'
  from jsonb_array_elements(p_rows) as r;

  get diagnostics inserted = row_count;

  insert into public.bid_sheets (sheet_name, content_hash, row_count, sync_run_id)
  values (p_sheet, p_hash, inserted, p_run_id)
  on conflict (sheet_name) do update
    set content_hash = excluded.content_hash,
        row_count = excluded.row_count,
        sync_run_id = excluded.sync_run_id,
        loaded_at = now();

  return inserted;
end;
$$;

revoke execute on function public.replace_stg_bid_rows(bigint, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_stg_bid_rows(bigint, text, text, jsonb) to service_role;

-- New tables get no Data API privileges by default, so grant them explicitly.
-- The ETL uses the secret/service_role key, which bypasses RLS.
grant select, insert, update on public.bid_sync_runs to service_role;
grant select, insert, delete on public.stg_bid_rows to service_role;
grant select, insert, update on public.bid_sheets to service_role;

-- Signed-in users of the web app may only read.
grant select on public.bid_sync_runs, public.stg_bid_rows, public.bid_sheets to authenticated;
alter table public.bid_sync_runs enable row level security;
alter table public.stg_bid_rows enable row level security;
alter table public.bid_sheets enable row level security;

create policy bid_sync_runs_read on public.bid_sync_runs
  for select to authenticated using (true);

create policy stg_bid_rows_read on public.stg_bid_rows
  for select to authenticated using (true);

create policy bid_sheets_read on public.bid_sheets
  for select to authenticated using (true);
