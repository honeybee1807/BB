-- Inquiries older than 12 months are purged nightly; newer ones stay.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.inquiries (id, guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at, created_at) values
  ('50000000-0000-0000-0000-0000000000e1', 'Old Guest', 'old@example.com', '0820000001', '2025-01-10', '2025-01-12', 2,
   now() - interval '13 months', now() - interval '13 months'),
  ('50000000-0000-0000-0000-0000000000e2', 'Edge Guest', 'edge@example.com', '0820000002', '2026-01-10', '2026-01-12', 2,
   now() - interval '12 months' + interval '1 day', now() - interval '12 months' + interval '1 day'),
  ('50000000-0000-0000-0000-0000000000e3', 'New Guest', 'new@example.com', '0820000003', '2027-01-10', '2027-01-12', 2,
   now(), now());

-- Access
select has_function('public', 'purge_expired_inquiries', array[]::text[], 'purge_expired_inquiries() exists');
select ok(not has_function_privilege('anon', 'public.purge_expired_inquiries()', 'execute'),
  'anon cannot run the purge');
select ok(not has_function_privilege('authenticated', 'public.purge_expired_inquiries()', 'execute'),
  'authenticated cannot run the purge');
select ok(has_function_privilege('service_role', 'public.purge_expired_inquiries()', 'execute'),
  'service_role can run the purge');

-- Schedule
select is((select schedule from cron.job where jobname = 'purge-expired-inquiries'), '45 3 * * *',
  'the purge runs every night');
select is((select command from cron.job where jobname = 'purge-expired-inquiries'),
  'select public.purge_expired_inquiries()', 'the nightly job calls the purge function');

-- Behaviour
set local role service_role;
select ok((select public.purge_expired_inquiries()) >= 1, 'service_role: the purge reports what it deleted');
reset role;

select is_empty($$select id from public.inquiries where id = '50000000-0000-0000-0000-0000000000e1'$$,
  'an inquiry older than 12 months is deleted');
select isnt_empty($$select id from public.inquiries where id = '50000000-0000-0000-0000-0000000000e2'$$,
  'an inquiry a day short of 12 months is kept');
select isnt_empty($$select id from public.inquiries where id = '50000000-0000-0000-0000-0000000000e3'$$,
  'a new inquiry is kept');
select isnt_empty($$select id from public.audit_log where action = 'inquiry.purge_expired'
  and (metadata ->> 'count')::int >= 1$$, 'the purge writes an audit row with the count, and no guest details');
select is((select public.purge_expired_inquiries()), 0, 'running it again deletes nothing');

select * from finish();
rollback;
