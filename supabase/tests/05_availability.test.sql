-- availability_blocks and its functions
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
insert into public.regions (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'pgtap-drakensberg', 'Drakensberg');
insert into public.estates (id, region_id, slug, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'pgtap-cathkin-estate', 'Cathkin Estate');
insert into public.properties (id, estate_id, slug, name, is_published, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'pgtap-published-home', 'Published', true, null),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'pgtap-draft-home', 'Draft', false, null),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'pgtap-deleted-home', 'Deleted', true, now());
insert into public.availability_blocks (property_id, date) values
  ('30000000-0000-0000-0000-000000000001', '2027-01-10'),
  ('30000000-0000-0000-0000-000000000001', '2027-01-11'),
  ('30000000-0000-0000-0000-000000000002', '2027-01-10'),
  ('30000000-0000-0000-0000-000000000003', '2027-01-10');

-- Structure
select ok((select relrowsecurity from pg_class where oid = 'public.availability_blocks'::regclass),
  'availability_blocks has RLS enabled');
select ok(not has_table_privilege('anon', 'public.availability_blocks', 'select,insert,update,delete,truncate'),
  'anon has NO privileges on availability_blocks');
select is((select count(*)::int from pg_policies where tablename = 'availability_blocks' and 'anon' = any(roles)),
  0, 'availability_blocks has no policies for anon');
select ok(not has_table_privilege('authenticated', 'public.availability_blocks', 'update,truncate'),
  'authenticated cannot update or truncate availability_blocks');
select ok(has_function_privilege('anon', 'public.get_blocked_dates(uuid,date,date)', 'execute'),
  'anon can execute get_blocked_dates');
select ok(not has_function_privilege('anon', 'public.block_dates(uuid,date,date)', 'execute'), 'anon cannot execute block_dates');
select ok(not has_function_privilege('anon', 'public.open_dates(uuid,date,date)', 'execute'), 'anon cannot execute open_dates');
select is((select prosecdef from pg_proc where oid = 'public.get_blocked_dates(uuid,date,date)'::regprocedure), true,
  'get_blocked_dates is SECURITY DEFINER');
select is((select proconfig from pg_proc where oid = 'public.get_blocked_dates(uuid,date,date)'::regprocedure),
  array['search_path=""'], 'get_blocked_dates has an empty search_path');

-- Anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select * from public.availability_blocks', '42501', null, 'anon: cannot read the table directly');
select throws_ok($$insert into public.availability_blocks values ('30000000-0000-0000-0000-000000000001', '2027-02-01')$$,
  '42501', null, 'anon: cannot insert');
select throws_ok($$select public.block_dates('30000000-0000-0000-0000-000000000001', '2027-02-01', '2027-02-02')$$,
  '42501', null, 'anon: cannot call block_dates');
select results_eq($$select * from public.get_blocked_dates('30000000-0000-0000-0000-000000000001', '2027-01-01', '2027-01-31')$$,
  $$values ('2027-01-10'::date), ('2027-01-11'::date)$$, 'anon: gets blocked dates of a published property');
select results_eq($$select * from public.get_blocked_dates('30000000-0000-0000-0000-000000000001', '2027-01-11', '2027-01-11')$$,
  $$values ('2027-01-11'::date)$$, 'anon: a one-day range works and the range is inclusive');
select is_empty($$select * from public.get_blocked_dates('30000000-0000-0000-0000-000000000002', '2027-01-01', '2027-01-31')$$,
  'anon: unpublished property returns an empty set');
select is_empty($$select * from public.get_blocked_dates('30000000-0000-0000-0000-000000000003', '2027-01-01', '2027-01-31')$$,
  'anon: soft-deleted property returns an empty set');
select is_empty($$select * from public.get_blocked_dates('99999999-9999-9999-9999-999999999999', '2027-01-01', '2027-01-31')$$,
  'anon: unknown property id returns an empty set');
select throws_ok($$select * from public.get_blocked_dates(null, '2027-01-01', '2027-01-31')$$, '22023', null,
  'anon: call with no property is rejected');
select throws_ok($$select * from public.get_blocked_dates('30000000-0000-0000-0000-000000000001', '2027-01-31', '2027-01-01')$$,
  '22023', null, 'anon: inverted range is rejected');
select throws_ok($$select * from public.get_blocked_dates('30000000-0000-0000-0000-000000000001', '2027-01-01', '2028-01-02')$$,
  '22023', null, 'anon: range over 366 days is rejected');
select lives_ok($$select * from public.get_blocked_dates('30000000-0000-0000-0000-000000000001', '2027-01-01', '2028-01-01')$$,
  'anon: a range of exactly 366 days is accepted');
select throws_ok($$select * from public.get_blocked_dates('30000000-0000-0000-0000-000000000001', null, '2027-01-01')$$,
  '22023', null, 'anon: missing start date is rejected');
reset role;

-- Outsider (authenticated, no profile)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;
select is_empty('select * from public.availability_blocks', 'outsider: sees no rows');
select throws_ok($$select public.block_dates('30000000-0000-0000-0000-000000000001', '2027-02-01', '2027-02-02')$$,
  '42501', null, 'outsider: block_dates is refused by RLS');
reset role;

-- Team member
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.availability_blocks where property_id::text like '30000000-%'), 4, 'team: sees all blocks (including drafts)');
select is(public.block_dates('30000000-0000-0000-0000-000000000001', '2027-01-09', '2027-01-12'), 2,
  'team: blocking a range inserts only the missing nights');
select is(public.block_dates('30000000-0000-0000-0000-000000000001', '2027-01-09', '2027-01-12'), 0,
  'team: repeating the same range is harmless');
select is(public.open_dates('30000000-0000-0000-0000-000000000001', '2027-01-10', '2027-01-10'), 1,
  'team: opening one date removes one row');
select lives_ok($$insert into public.availability_blocks values ('30000000-0000-0000-0000-000000000002', '2027-03-01')$$,
  'team: can block a single date');
select isnt_empty($$delete from public.availability_blocks
  where property_id = '30000000-0000-0000-0000-000000000002' and date = '2027-03-01' returning date$$,
  'team: can open a single date');
select throws_ok($$select public.block_dates('30000000-0000-0000-0000-000000000001', '2027-02-10', '2027-02-01')$$,
  '22023', null, 'team: inverted range is rejected');
select throws_ok($$select public.block_dates('30000000-0000-0000-0000-000000000001', '2027-01-01', '2028-06-01')$$,
  '22023', null, 'team: oversized range is rejected');
reset role;

-- Owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.block_dates('30000000-0000-0000-0000-000000000002', '2027-04-01', '2027-04-03'), 3,
  'owner: can block a range');
reset role;

-- Cascade
set local role service_role;
delete from public.properties where id = '30000000-0000-0000-0000-000000000003';
reset role;
select is((select count(*)::int from public.availability_blocks where property_id = '30000000-0000-0000-0000-000000000003'),
  0, 'blocks cascade when a property is purged');

select * from finish();
rollback;
