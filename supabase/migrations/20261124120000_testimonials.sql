-- Guest testimonials: the public sees visible ones only; admins edit, only the owner deletes.

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null check (char_length(btrim(guest_name)) between 1 and 80),
  -- where the guest is from, shown under their name
  place text check (char_length(place) <= 80),
  quote text not null check (char_length(btrim(quote)) between 1 and 600),
  property_id uuid references public.properties (id) on delete set null,
  is_visible boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index testimonials_visible_sort_idx on public.testimonials (sort_order, created_at desc) where is_visible;
create index testimonials_property_id_idx on public.testimonials (property_id);

alter table public.testimonials enable row level security;

create trigger testimonials_set_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();

revoke all on table public.testimonials from anon, authenticated, service_role;
grant select on table public.testimonials to anon;
grant select, insert, update, delete on table public.testimonials to authenticated;
grant select, insert, update, delete on table public.testimonials to service_role;

create policy "testimonials: anon read visible" on public.testimonials
  for select to anon using (is_visible);
create policy "testimonials: admin read" on public.testimonials
  for select to authenticated using ((select public.is_admin()));
create policy "testimonials: admin insert" on public.testimonials
  for insert to authenticated with check ((select public.is_admin()));
create policy "testimonials: admin update" on public.testimonials
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "testimonials: owner delete" on public.testimonials
  for delete to authenticated using ((select public.is_owner()));
