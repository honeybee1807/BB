-- audit_log and rate_limits: written and read by the server only (service role).
-- anon and authenticated have NO grants. RLS is enabled with no policies, so even a
-- stray grant would expose nothing. Both tables are pruned by pg_cron.

-- ---------------------------------------------------------------------------
-- audit_log. No guest personal data: ids and hashed IPs only.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)*$' and char_length(action) <= 64),
  entity_type text check (char_length(entity_type) <= 40),
  entity_id text check (char_length(entity_id) <= 64),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4000),
  ip_hash text check (char_length(ip_hash) <= 128),
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);

alter table public.audit_log enable row level security;

revoke all on table public.audit_log from anon, authenticated, service_role;
revoke all on sequence public.audit_log_id_seq from anon, authenticated, service_role;
grant select, insert, delete on table public.audit_log to service_role;

-- ---------------------------------------------------------------------------
-- rate_limits: one row per counted event, keyed by a bucket name and a hash
-- (hashed IP or hashed email; never the raw value).
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket ~ '^[a-z_]+$' and char_length(bucket) <= 40),
  key_hash text not null check (char_length(key_hash) between 16 and 128),
  created_at timestamptz not null default now()
);

create index rate_limits_lookup_idx on public.rate_limits (bucket, key_hash, created_at desc);
create index rate_limits_created_at_idx on public.rate_limits (created_at);

alter table public.rate_limits enable row level security;

revoke all on table public.rate_limits from anon, authenticated, service_role;
revoke all on sequence public.rate_limits_id_seq from anon, authenticated, service_role;
grant select, insert, delete on table public.rate_limits to service_role;

-- Events for a key inside the window.
create function public.rate_limit_count(p_bucket text, p_key_hash text, p_window_seconds integer)
returns integer
language sql stable
set search_path = ''
as $$
  select count(*)::integer
  from public.rate_limits
  where bucket = p_bucket
    and key_hash = p_key_hash
    and created_at > now() - make_interval(secs => p_window_seconds);
$$;

-- Atomically: if fewer than p_max events exist in the window, record one and
-- return true; otherwise record nothing and return false. The advisory lock
-- serialises concurrent calls for the same key.
create function public.rate_limit_hit(p_bucket text, p_key_hash text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if p_window_seconds is null or p_window_seconds <= 0 or p_max is null or p_max <= 0 then
    raise exception 'Invalid rate limit settings' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key_hash, 0));
  if public.rate_limit_count(p_bucket, p_key_hash, p_window_seconds) >= p_max then
    return false;
  end if;
  insert into public.rate_limits (bucket, key_hash) values (p_bucket, p_key_hash);
  return true;
end;
$$;

-- Record one event unconditionally (for example a failed login).
create function public.rate_limit_record(p_bucket text, p_key_hash text)
returns void
language sql
set search_path = ''
as $$
  insert into public.rate_limits (bucket, key_hash) values (p_bucket, p_key_hash);
$$;

-- Clear a key's events (for example failed logins after a successful sign-in).
create function public.rate_limit_clear(p_bucket text, p_key_hash text)
returns void
language sql
set search_path = ''
as $$
  delete from public.rate_limits where bucket = p_bucket and key_hash = p_key_hash;
$$;

revoke execute on function public.rate_limit_count(text, text, integer) from public, anon, authenticated;
revoke execute on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.rate_limit_record(text, text) from public, anon, authenticated;
revoke execute on function public.rate_limit_clear(text, text) from public, anon, authenticated;
grant execute on function public.rate_limit_count(text, text, integer) to service_role;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;
grant execute on function public.rate_limit_record(text, text) to service_role;
grant execute on function public.rate_limit_clear(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Pruning with pg_cron (daily). Availability is never pruned.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'prune-rate-limits',
  '15 3 * * *',
  $$delete from public.rate_limits where created_at < now() - interval '2 days'$$
);

select cron.schedule(
  'prune-audit-log',
  '30 3 * * *',
  $$delete from public.audit_log where created_at < now() - interval '90 days'$$
);
