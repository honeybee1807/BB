-- Inquiries: tracked leads. Inserted only by the public inquiry route with the
-- service role. Anon has NO grants. Admins read and manage; owner-only soft delete.

create type public.inquiry_status as enum ('new', 'in_progress', 'actioned');
create type public.accommodation_preference as enum ('resort', 'holiday_home', 'no_preference');

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null check (char_length(btrim(guest_name)) between 2 and 100),
  guest_email text not null check (char_length(guest_email) <= 254 and guest_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  guest_phone text not null check (guest_phone ~ '^[0-9 +()]{7,20}$'),
  check_in date not null,
  check_out date not null,
  adults int not null check (adults between 1 and 30),
  children int not null default 0 check (children between 0 and 30),
  budget_min_zar int check (budget_min_zar between 0 and 10000000),
  budget_max_zar int check (budget_max_zar between 0 and 10000000),
  accommodation_type public.accommodation_preference not null default 'no_preference',
  additional_requirements text check (char_length(additional_requirements) <= 2000),
  property_id uuid references public.properties (id) on delete set null,
  status public.inquiry_status not null default 'new',
  assigned_to uuid references public.admin_profiles (id) on delete set null,
  internal_notes text check (char_length(internal_notes) <= 5000),
  consent_given_at timestamptz not null,
  email_sent_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inquiries_dates_order check (check_out > check_in),
  constraint inquiries_max_stay check (check_out - check_in <= 60),
  constraint inquiries_budget_order check (
    budget_min_zar is null or budget_max_zar is null or budget_max_zar >= budget_min_zar
  )
);

create index inquiries_status_created_at_idx on public.inquiries (status, created_at desc);
create index inquiries_assigned_to_idx on public.inquiries (assigned_to);
create index inquiries_property_id_idx on public.inquiries (property_id);

alter table public.inquiries enable row level security;

create trigger inquiries_set_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();
create trigger inquiries_owner_soft_delete before insert or update on public.inquiries
  for each row execute function public.enforce_owner_soft_delete();

-- Anon: nothing. Authenticated: read, and update only the workflow columns.
-- No INSERT (the public route uses the service role) and no DELETE (soft delete only).
revoke all on table public.inquiries from anon, authenticated, service_role;
grant select on table public.inquiries to authenticated;
grant update (status, assigned_to, internal_notes, deleted_at) on table public.inquiries to authenticated;
grant select, insert, update, delete on table public.inquiries to service_role;

create policy "inquiries: admins read" on public.inquiries
  for select to authenticated
  using ((deleted_at is null and (select public.is_admin())) or (select public.is_owner()));

create policy "inquiries: admins update, owner soft deletes" on public.inquiries
  for update to authenticated
  using ((select public.is_admin()) and (deleted_at is null or (select public.is_owner())))
  with check ((select public.is_admin()) and (deleted_at is null or (select public.is_owner())));
