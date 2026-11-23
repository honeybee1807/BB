-- A row means the night is blocked. Past rows are never pruned.

create table public.availability_blocks (
  property_id uuid not null references public.properties (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (property_id, date)
);

-- for the all-properties grid
create index availability_blocks_date_idx on public.availability_blocks (date);

alter table public.availability_blocks enable row level security;

-- Nothing for anon. Public dates only come through get_blocked_dates().
revoke all on table public.availability_blocks from anon, authenticated, service_role;
grant select, insert, delete on table public.availability_blocks to authenticated;
grant select, insert, update, delete on table public.availability_blocks to service_role;

create policy "availability_blocks: admins read" on public.availability_blocks
  for select to authenticated using ((select public.is_admin()));
create policy "availability_blocks: admins block" on public.availability_blocks
  for insert to authenticated with check ((select public.is_admin()));
create policy "availability_blocks: admins open" on public.availability_blocks
  for delete to authenticated using ((select public.is_admin()));

create function public.assert_valid_date_range(p_from date, p_to date) returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null then
    raise exception 'Both dates are required' using errcode = '22023';
  end if;
  if p_to < p_from then
    raise exception 'The end date is before the start date' using errcode = '22023';
  end if;
  if p_to - p_from >= 366 then
    raise exception 'The range is longer than 366 days' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.assert_valid_date_range(date, date) from public, anon;
grant execute on function public.assert_valid_date_range(date, date) to authenticated, service_role;

-- Security invoker, so RLS limits these to active admins.
create function public.block_dates(p_property_id uuid, p_from date, p_to date) returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public.assert_valid_date_range(p_from, p_to);
  insert into public.availability_blocks (property_id, date)
    select p_property_id, d::date from generate_series(p_from, p_to, interval '1 day') as g(d)
    on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.open_dates(p_property_id uuid, p_from date, p_to date) returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public.assert_valid_date_range(p_from, p_to);
  delete from public.availability_blocks
    where property_id = p_property_id and date between p_from and p_to;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.block_dates(uuid, date, date) from public, anon;
revoke execute on function public.open_dates(uuid, date, date) from public, anon;
grant execute on function public.block_dates(uuid, date, date) to authenticated;
grant execute on function public.open_dates(uuid, date, date) to authenticated;

-- Drafts, deleted and unknown properties return nothing.
create function public.get_blocked_dates(p_property_id uuid, p_from date, p_to date)
returns setof date
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_property_id is null then
    raise exception 'A property is required' using errcode = '22023';
  end if;
  perform public.assert_valid_date_range(p_from, p_to);

  return query
    select b.date
    from public.availability_blocks b
    join public.properties p on p.id = b.property_id
    where b.property_id = p_property_id
      and p.is_published
      and p.deleted_at is null
      and b.date between p_from and p_to
    order by b.date;
end;
$$;

revoke execute on function public.get_blocked_dates(uuid, date, date) from public;
grant execute on function public.get_blocked_dates(uuid, date, date) to anon, authenticated;
