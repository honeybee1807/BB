-- Catches any new table or function that skips the rules.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select tables_are('public', array[
  'admin_profiles', 'regions', 'estates', 'properties', 'property_photos', 'availability_blocks',
  'inquiries', 'blog_posts', 'seo_pages', 'audit_log', 'rate_limits', 'testimonials',
  'team_invites'
],'public schema holds exactly the approved tables');

select is_empty($$select tablename from pg_tables where schemaname = 'public' and not rowsecurity$$,
  'every public table has RLS enabled');

select is((
  select array_agg(c.relname::text order by c.relname::text) from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('anon', c.oid, 'select')
  ),
  array['blog_posts', 'estates', 'properties', 'property_photos', 'regions', 'seo_pages', 'testimonials'],
  'anon can select only the seven public content tables');

select is_empty($$
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update')
      or has_table_privilege('anon', c.oid, 'delete') or has_table_privilege('anon', c.oid, 'truncate')
      or has_table_privilege('anon', c.oid, 'references') or has_table_privilege('anon', c.oid, 'trigger'))$$,
  'anon has no write, truncate, references or trigger privilege on any public table');

select is_empty($$
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('authenticated', c.oid, 'truncate')
      or has_table_privilege('authenticated', c.oid, 'references')
      or has_table_privilege('authenticated', c.oid, 'trigger'))$$,
  'authenticated has no truncate, references or trigger privilege on any public table');

select is((
  select array_agg(p.proname::text order by p.proname::text) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
  ),
  array['get_blocked_dates'],
  'get_blocked_dates is the only public function anon can execute');

select is_empty($$
  select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false)$$,
  'every SECURITY DEFINER function sets an empty search_path');

select is_empty($$
  select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not coalesce(exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'), false)$$,
  'every public function pins its search_path');

select is_empty($$select 1 from pg_policies where schemaname = 'public' and 'public' = any(roles)$$,
  'no policy applies to the PUBLIC pseudo-role');

select is_empty($$
  select policyname from pg_policies
  where schemaname = 'public' and 'anon' = any(roles)
    and (coalesce(qual, '') ~ 'is_(admin|owner)' or coalesce(with_check, '') ~ 'is_(admin|owner)')$$,
  'no anon policy calls is_admin() or is_owner() (anon cannot execute them)');

select * from finish();
rollback;
