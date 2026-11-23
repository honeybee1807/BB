-- audit_log and rate_limits
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local');
insert into public.admin_profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member');
insert into public.audit_log (actor_id, action, entity_type, entity_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'login.ok', 'admin', '00000000-0000-0000-0000-0000000000a1');

-- Structure
select ok((select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass), 'audit_log has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.rate_limits'::regclass), 'rate_limits has RLS enabled');
select is((select count(*)::int from pg_policies where tablename = 'rate_limits'), 0, 'rate_limits has no policies');
select results_eq($$select cmd::text from pg_policies where tablename = 'audit_log'$$, $$values ('SELECT')$$,
  'audit_log has a single read policy');
select ok(not has_table_privilege('anon', 'public.audit_log', 'select,insert,update,delete,truncate,references,trigger'),
  'anon has NO privileges on audit_log');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'insert,update,delete,truncate,references,trigger'),
  'authenticated cannot write audit_log');
select ok(has_table_privilege('authenticated', 'public.audit_log', 'select'),
  'authenticated has select on audit_log (filtered to the owner by RLS)');
select ok(not has_table_privilege('anon', 'public.rate_limits', 'select,insert,update,delete,truncate,references,trigger'),
  'anon has NO privileges on rate_limits');
select ok(not has_table_privilege('authenticated', 'public.rate_limits', 'select,insert,update,delete,truncate,references,trigger'),
  'authenticated has NO privileges on rate_limits');
select ok(not has_sequence_privilege('anon', 'public.rate_limits_id_seq', 'usage,select,update'),
  'anon has no privileges on the rate_limits sequence');
select ok(not has_function_privilege('anon', 'public.rate_limit_hit(text,text,integer,integer)', 'execute'),
  'anon cannot execute rate_limit_hit');
select ok(not has_function_privilege('authenticated', 'public.rate_limit_hit(text,text,integer,integer)', 'execute'),
  'authenticated cannot execute rate_limit_hit');
select ok(not has_function_privilege('authenticated', 'public.rate_limit_clear(text,text)', 'execute'),
  'authenticated cannot execute rate_limit_clear');
select isnt_empty($$select 1 from cron.job where jobname = 'prune-rate-limits'
  and command like '%rate_limits%2 days%'$$, 'pg_cron prunes rate_limits older than 2 days');
select isnt_empty($$select 1 from cron.job where jobname = 'prune-audit-log'
  and command like '%audit_log%90 days%'$$, 'pg_cron prunes audit_log older than 90 days');
select is_empty($$select 1 from cron.job where command like '%availability%'$$, 'availability is never pruned');

-- Anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select * from public.audit_log', '42501', null, 'anon: cannot read audit_log');
select throws_ok($$insert into public.audit_log (action) values ('x')$$, '42501', null, 'anon: cannot write audit_log');
select throws_ok('select * from public.rate_limits', '42501', null, 'anon: cannot read rate_limits');
select throws_ok($$select public.rate_limit_hit('login', repeat('a', 32), 900, 5)$$, '42501', null,
  'anon: cannot call rate_limit_hit');
reset role;

-- Team member
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select is_empty('select id from public.audit_log', 'team: reads no audit rows');
select throws_ok($$insert into public.audit_log (action) values ('x')$$, '42501', null, 'team: cannot write audit_log');
select throws_ok($$delete from public.rate_limits$$, '42501', null, 'team: cannot clear rate_limits');
reset role;

-- Owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from public.audit_log), 1, 'owner (aal2): can read the audit log');
select throws_ok($$insert into public.audit_log (action) values ('owner.write')$$, '42501', null, 'owner: cannot write audit rows');
select throws_ok($$delete from public.audit_log$$, '42501', null, 'owner: cannot delete audit rows');
select throws_ok('select * from public.rate_limits', '42501', null, 'owner: cannot read rate_limits');
select throws_ok($$select public.rate_limit_clear('login', repeat('a', 32))$$, '42501', null,
  'owner: cannot call rate_limit_clear');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty('select id from public.audit_log', 'owner without TOTP (aal1): reads no audit rows');
reset role;

-- Service role: rate limit behaviour
set local role service_role;
select lives_ok($$insert into public.audit_log (action, metadata) values ('property.soft_delete', '{"property_id":"x"}')$$,
  'service_role: can write audit rows');
select is((select count(*)::int from public.audit_log), 2, 'service_role: can read audit rows');
select is((select bool_and(public.rate_limit_hit('inquiry_hour', repeat('b', 32), 3600, 5)) from generate_series(1, 5)),
  true, 'service_role: first 5 hits in the window are allowed');
select is(public.rate_limit_hit('inquiry_hour', repeat('b', 32), 3600, 5), false, 'service_role: the 6th hit is refused');
select is(public.rate_limit_count('inquiry_hour', repeat('b', 32), 3600), 5, 'refused hits are not recorded');
select is(public.rate_limit_hit('inquiry_hour', repeat('c', 32), 3600, 5), true, 'a different key has its own limit');
select lives_ok($$select public.rate_limit_record('login_fail_email', repeat('d', 32))$$, 'service_role: can record a failure');
select is(public.rate_limit_count('login_fail_email', repeat('d', 32), 900), 1, 'failure is counted');
select lives_ok($$select public.rate_limit_clear('login_fail_email', repeat('d', 32))$$, 'service_role: can clear a key');
select is(public.rate_limit_count('login_fail_email', repeat('d', 32), 900), 0, 'cleared key counts zero');
select throws_ok($$select public.rate_limit_hit('x', repeat('e', 32), 0, 5)$$, '22023', null, 'invalid window is rejected');
reset role;

-- Old events fall outside the window and are pruned by the cron command.
insert into public.rate_limits (bucket, key_hash, created_at) values ('inquiry_hour', repeat('f', 32), now() - interval '3 days');
select is(public.rate_limit_count('inquiry_hour', repeat('f', 32), 3600), 0, 'events outside the window are not counted');
delete from public.rate_limits where created_at < now() - interval '2 days';
select is((select count(*)::int from public.rate_limits where key_hash = repeat('f', 32)), 0,
  'the prune statement removes rows older than 2 days');
select throws_ok($$insert into public.rate_limits (bucket, key_hash) values ('login', 'short')$$, '23514', null,
  'key_hash must look like a hash, not a raw value');

select * from finish();
rollback;
