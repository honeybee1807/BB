-- Page SEO settings: the public reads them, only the owner reads or changes them when signed in.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local');
insert into public.admin_profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member');

-- Structure
select col_is_null('public', 'seo_pages', 'title', 'a blank title is allowed (the default is used)');
select col_is_null('public', 'seo_pages', 'description', 'a blank description is allowed (the default is used)');
select has_column('public', 'seo_pages', 'updated_by', 'seo_pages records who changed it');
select ok(not has_column_privilege('authenticated', 'public.seo_pages', 'updated_by', 'update'),
  'authenticated cannot set updated_by');
select ok(not has_column_privilege('authenticated', 'public.seo_pages', 'path', 'update'),
  'authenticated cannot move a page to another path');
select throws_ok($$update public.seo_pages set title = '   ' where path = '/'$$, '23514', null,
  'a whitespace-only title is refused (blank is stored as null)');

-- Anon: the public site reads them
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select isnt_empty($$select title from public.seo_pages where path = '/'$$, 'anon: reads page SEO for the public site');
select throws_ok($$update public.seo_pages set title = 'X' where path = '/'$$, '42501', null, 'anon: cannot change page SEO');
reset role;

-- Team member
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty('select path from public.seo_pages', 'team: cannot read settings');
select is_empty($$update public.seo_pages set title = 'Team title' where path = '/' returning path$$,
  'team: cannot change a page');
select throws_ok($$insert into public.seo_pages (path, title) values ('/new-page', 'X')$$, '42501', null,
  'team: cannot add a page');
reset role;

-- Owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select isnt_empty('select path from public.seo_pages', 'owner: reads settings');
select lives_ok($$update public.seo_pages set title = 'Owner title', description = null where path = '/about'$$,
  'owner: can change a title and clear a description');
select throws_ok($$update public.seo_pages set updated_by = '00000000-0000-0000-0000-0000000000a2' where path = '/about'$$,
  '42501', null, 'owner: cannot set who made the change');
select throws_ok($$delete from public.seo_pages where path = '/about'$$, '42501', null, 'owner: cannot delete a page');
reset role;

select is((select updated_by from public.seo_pages where path = '/about'), '00000000-0000-0000-0000-0000000000a1'::uuid,
  'the change is recorded against the signed-in owner');
select is((select description from public.seo_pages where path = '/about'), null, 'a cleared description is stored as null');

select * from finish();
rollback;
