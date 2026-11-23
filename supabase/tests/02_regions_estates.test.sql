-- regions and estates: public read, owner write.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'outsider@test.local');
insert into public.admin_profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member');
insert into public.regions (id, slug, name) values
  ('10000000-0000-0000-0000-000000000001', 'drakensberg', 'Drakensberg');

-- Structure
select ok((select relrowsecurity from pg_class where oid = 'public.regions'::regclass), 'regions has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.estates'::regclass), 'estates has RLS enabled');
select ok(has_table_privilege('anon', 'public.regions', 'select'), 'anon has select on regions');
select ok(not has_table_privilege('anon', 'public.regions', 'insert,update,delete,truncate'), 'anon has no write on regions');
select ok(has_table_privilege('anon', 'public.estates', 'select'), 'anon has select on estates');
select ok(not has_table_privilege('anon', 'public.estates', 'insert,update,delete,truncate'), 'anon has no write on estates');
select ok(not has_table_privilege('authenticated', 'public.regions', 'truncate'), 'authenticated cannot truncate regions');

-- Anon: reads return rows or an empty set, never an error
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is_empty('select id from public.estates', 'anon: estates read returns an empty set (no error)');
select isnt_empty('select id from public.regions', 'anon: regions read returns rows');
select throws_ok($$insert into public.regions (slug, name) values ('x', 'X')$$, '42501', null, 'anon: cannot insert regions');
select throws_ok($$update public.regions set name = 'X'$$, '42501', null, 'anon: cannot update regions');
select throws_ok($$delete from public.regions$$, '42501', null, 'anon: cannot delete regions');
select throws_ok($$insert into public.estates (region_id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'x', 'X')$$,
  '42501', null, 'anon: cannot insert estates');
reset role;

-- Owner: full write
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$insert into public.estates (id, region_id, slug, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cathkin-estate', 'Cathkin Estate')$$,
  'owner: can insert an estate');
select lives_ok($$insert into public.regions (id, slug, name) values
  ('10000000-0000-0000-0000-000000000002', 'north-coast', 'North Coast')$$, 'owner: can insert a region');
select isnt_empty($$update public.regions set description = 'Mountains' where slug = 'drakensberg' returning id$$,
  'owner: can update a region');
select throws_ok($$delete from public.regions where id = '10000000-0000-0000-0000-000000000001'$$, '23503', null,
  'owner: cannot delete a region that still has estates (on delete restrict)');
select isnt_empty($$delete from public.regions where id = '10000000-0000-0000-0000-000000000002' returning id$$,
  'owner: can delete an empty region');
select throws_ok($$insert into public.regions (slug, name) values ('Bad Slug!', 'Bad')$$, '23514', null,
  'slug format is enforced');
reset role;

-- Team member: read only
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty('select id from public.estates', 'team: can read estates');
select throws_ok($$insert into public.regions (slug, name) values ('team-region', 'Team')$$, '42501', null,
  'team: cannot insert regions (RLS)');
select is_empty($$update public.regions set name = 'Changed' returning id$$, 'team: cannot update regions');
select is_empty($$delete from public.estates returning id$$, 'team: cannot delete estates');
select throws_ok($$insert into public.estates (region_id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'team-estate', 'T')$$,
  '42501', null, 'team: cannot insert estates (RLS)');
select is_empty($$update public.estates set name = 'Changed' returning id$$, 'team: cannot update estates');
reset role;

-- Authenticated user with no admin profile
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty('select id from public.regions', 'outsider: can read regions like the public');
select throws_ok($$insert into public.regions (slug, name) values ('outsider', 'O')$$, '42501', null,
  'outsider: cannot insert regions');
reset role;

-- updated_at trigger
update public.regions set updated_at = '2000-01-01' where slug = 'drakensberg';
select ok((select updated_at > '2000-01-01' from public.regions where slug = 'drakensberg'),
  'updated_at is refreshed by the trigger');

select * from finish();
rollback;
