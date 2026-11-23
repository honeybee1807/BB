-- inquiries: no anon access at all; admins manage workflow columns; owner-only soft delete.
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
insert into public.inquiries (id, guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at, deleted_at) values
  ('50000000-0000-0000-0000-000000000001', 'Guest One', 'one@example.com', '+27 82 000 0001', '2027-01-10', '2027-01-14', 2, now(), null),
  ('50000000-0000-0000-0000-000000000002', 'Guest Two', 'two@example.com', '082 000 0002', '2027-02-10', '2027-02-12', 1, now(), null),
  ('50000000-0000-0000-0000-000000000003', 'Guest Three', 'three@example.com', '(082) 000 0003', '2027-03-10', '2027-03-12', 4, now(), now());

-- Structure -----------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.inquiries'::regclass), 'inquiries has RLS enabled');
select ok(not has_table_privilege('anon', 'public.inquiries', 'select,insert,update,delete,truncate,references,trigger'),
  'anon has NO privileges on inquiries');
select is((select count(*)::int from pg_policies where tablename = 'inquiries' and 'anon' = any(roles)), 0,
  'inquiries has no policies for anon');
select ok(not has_table_privilege('authenticated', 'public.inquiries', 'insert,delete,truncate'),
  'authenticated cannot insert, delete or truncate inquiries');
select ok(has_column_privilege('authenticated', 'public.inquiries', 'status', 'update'), 'authenticated can update status');
select ok(not has_column_privilege('authenticated', 'public.inquiries', 'guest_email', 'update'),
  'authenticated cannot update guest details');
select enum_has_labels('public', 'inquiry_status', array['new', 'in_progress', 'actioned'], 'statuses are new, in_progress, actioned');

-- Anon ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select * from public.inquiries', '42501', null, 'anon: cannot read inquiries');
select throws_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at)
  values ('Spam', 's@example.com', '0820000000', '2027-01-01', '2027-01-02', 1, now())$$, '42501', null,
  'anon: cannot insert inquiries directly');
select throws_ok($$update public.inquiries set status = 'actioned'$$, '42501', null, 'anon: cannot update');
select throws_ok($$delete from public.inquiries$$, '42501', null, 'anon: cannot delete');
reset role;

-- Outsider ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;
select is_empty('select id from public.inquiries', 'outsider: sees no inquiries');
select is_empty($$update public.inquiries set status = 'actioned' returning id$$, 'outsider: cannot update');
reset role;

-- Team member ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select results_eq('select id from public.inquiries order by id',
  $$values ('50000000-0000-0000-0000-000000000001'::uuid), ('50000000-0000-0000-0000-000000000002'::uuid)$$,
  'team: sees all non-deleted inquiries');
select isnt_empty($$update public.inquiries set status = 'in_progress', assigned_to = '00000000-0000-0000-0000-0000000000a2',
  internal_notes = 'Called guest' where id = '50000000-0000-0000-0000-000000000001' returning id$$,
  'team: can change status, assignment and notes');
select throws_ok($$update public.inquiries set guest_email = 'x@example.com' where id = '50000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'team: cannot edit guest details');
select throws_ok($$update public.inquiries set deleted_at = now() where id = '50000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'team: cannot soft delete (set deleted_at)');
select is_empty($$update public.inquiries set deleted_at = null where id = '50000000-0000-0000-0000-000000000003' returning id$$,
  'team: cannot restore (clear deleted_at)');
select throws_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at)
  values ('X', 'x@example.com', '0820000000', '2027-01-01', '2027-01-02', 1, now())$$, '42501', null, 'team: cannot insert');
select throws_ok($$delete from public.inquiries where id = '50000000-0000-0000-0000-000000000002'$$, '42501', null,
  'team: cannot hard delete');
reset role;
select ok((select deleted_at is null from public.inquiries where id = '50000000-0000-0000-0000-000000000002'),
  'inquiry two is still not deleted');
select ok((select deleted_at is not null from public.inquiries where id = '50000000-0000-0000-0000-000000000003'),
  'inquiry three is still deleted');
select is((select status::text from public.inquiries where id = '50000000-0000-0000-0000-000000000001'), 'in_progress',
  'status change was stored');

-- Owner ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.inquiries), 3, 'owner: sees all inquiries, including soft-deleted');
select isnt_empty($$update public.inquiries set deleted_at = now() where id = '50000000-0000-0000-0000-000000000002' returning id$$,
  'owner: can soft delete');
select isnt_empty($$update public.inquiries set deleted_at = null where id = '50000000-0000-0000-0000-000000000003' returning id$$,
  'owner: can restore');
select throws_ok($$delete from public.inquiries where id = '50000000-0000-0000-0000-000000000002'$$, '42501', null,
  'owner: cannot hard delete through the API role');
reset role;

-- Service role (public inquiry route and owner purge) -----------------------
set local role service_role;
select lives_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults, children,
  budget_min_zar, budget_max_zar, accommodation_type, consent_given_at)
  values ('Route Guest', 'route@example.com', '0820000009', '2027-05-01', '2027-05-05', 2, 1, 1500, 3000, 'resort', now())$$,
  'service_role: the inquiry route can insert');
select isnt_empty($$delete from public.inquiries where id = '50000000-0000-0000-0000-000000000002' returning id$$,
  'service_role: owner purge can hard delete');
reset role;

-- Constraints ---------------------------------------------------------------
select throws_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at)
  values ('Bad Dates', 'b@example.com', '0820000000', '2027-01-05', '2027-01-05', 1, now())$$, '23514', null,
  'check-out must be after check-in');
select throws_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at)
  values ('Long Stay', 'b@example.com', '0820000000', '2027-01-01', '2027-03-05', 1, now())$$, '23514', null,
  'stays longer than 60 nights are rejected');
select throws_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at)
  values ('No Adults', 'b@example.com', '0820000000', '2027-01-01', '2027-01-02', 0, now())$$, '23514', null,
  'at least one adult');
select throws_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults,
  budget_min_zar, budget_max_zar, consent_given_at)
  values ('Budget', 'b@example.com', '0820000000', '2027-01-01', '2027-01-02', 1, 5000, 1000, now())$$, '23514', null,
  'budget max cannot be below min');
select throws_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults)
  values ('No Consent', 'b@example.com', '0820000000', '2027-01-01', '2027-01-02', 1)$$, '23502', null,
  'consent timestamp is required');
select throws_ok($$insert into public.inquiries (guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at)
  values ('Bad Phone', 'b@example.com', '082-abc', '2027-01-01', '2027-01-02', 1, now())$$, '23514', null,
  'phone allows digits, spaces, plus and brackets only');

select * from finish();
rollback;
