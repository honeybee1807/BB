-- testimonials: anon reads visible ones only, admins edit, only the owner deletes.
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
insert into public.testimonials (id, guest_name, quote, is_visible) values
  ('70000000-0000-0000-0000-000000000001', 'Visible Guest', 'Lovely stay.', true),
  ('70000000-0000-0000-0000-000000000002', 'Hidden Guest', 'Not shown yet.', false);

-- Structure
select ok((select relrowsecurity from pg_class where oid = 'public.testimonials'::regclass), 'testimonials has RLS enabled');
select ok(has_table_privilege('anon', 'public.testimonials', 'select'), 'anon has select on testimonials');
select ok(not has_table_privilege('anon', 'public.testimonials', 'insert,update,delete,truncate'),
  'anon has no write on testimonials');
select ok(not has_table_privilege('authenticated', 'public.testimonials', 'truncate'), 'authenticated cannot truncate');
select is((select is_visible from public.testimonials where guest_name = 'Hidden Guest'), false, 'hidden is stored');
select throws_ok($$insert into public.testimonials (guest_name, quote) values ('No Quote', ' ')$$, '23514', null,
  'a blank quote is refused');
select col_default_is('public', 'testimonials', 'is_visible', 'false', 'new testimonials are hidden by default');

-- Anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq($$select id from public.testimonials where id::text like '70000000-%'$$,
  $$values ('70000000-0000-0000-0000-000000000001'::uuid)$$, 'anon: sees visible testimonials only');
select throws_ok($$insert into public.testimonials (guest_name, quote) values ('X', 'X')$$, '42501', null,
  'anon: cannot insert');
select throws_ok($$update public.testimonials set quote = 'X'$$, '42501', null, 'anon: cannot update');
select throws_ok($$delete from public.testimonials$$, '42501', null, 'anon: cannot delete');
reset role;

-- Outsider
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select id from public.testimonials where id::text like '70000000-%'$$, 'outsider: sees nothing');
select throws_ok($$insert into public.testimonials (guest_name, quote) values ('X', 'X')$$, '42501', null,
  'outsider: cannot insert');
reset role;

-- Team member
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.testimonials where id::text like '70000000-%'), 2,
  'team: sees hidden and visible testimonials');
select lives_ok($$insert into public.testimonials (id, guest_name, quote) values
  ('70000000-0000-0000-0000-000000000003', 'Team Added', 'Added by the team.')$$, 'team: can add a testimonial');
select isnt_empty($$update public.testimonials set is_visible = true where id = '70000000-0000-0000-0000-000000000002'
  returning id$$, 'team: can show a testimonial');
select is_empty($$delete from public.testimonials where id = '70000000-0000-0000-0000-000000000003' returning id$$,
  'team: cannot delete');
reset role;
select is((select count(*)::int from public.testimonials where id::text like '70000000-%'), 3,
  'nothing was deleted by the team');

-- Owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select isnt_empty($$delete from public.testimonials where id = '70000000-0000-0000-0000-000000000003' returning id$$,
  'owner: can delete');
reset role;

select * from finish();
rollback;
