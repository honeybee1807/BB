-- blog_posts (public published only, admins write, owner-only soft delete) and seo_pages (public read, owner write).
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
insert into public.blog_posts (id, slug, title, is_published, deleted_at) values
  ('60000000-0000-0000-0000-000000000001', 'published-post', 'Published', true, null),
  ('60000000-0000-0000-0000-000000000002', 'draft-post', 'Draft', false, null),
  ('60000000-0000-0000-0000-000000000003', 'deleted-post', 'Deleted', true, now());

-- Structure -----------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.blog_posts'::regclass), 'blog_posts has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.seo_pages'::regclass), 'seo_pages has RLS enabled');
select ok(has_table_privilege('anon', 'public.blog_posts', 'select'), 'anon has select on blog_posts');
select ok(not has_table_privilege('anon', 'public.blog_posts', 'insert,update,delete,truncate'), 'anon has no write on blog_posts');
select ok(not has_table_privilege('authenticated', 'public.blog_posts', 'delete,truncate'),
  'authenticated has NO delete grant on blog_posts');
select ok(has_table_privilege('anon', 'public.seo_pages', 'select'), 'anon has select on seo_pages');
select ok(not has_table_privilege('anon', 'public.seo_pages', 'insert,update,delete,truncate'), 'anon has no write on seo_pages');
select is((select count(*)::int from public.seo_pages), 6, 'six static pages are seeded in seo_pages');
select ok((select published_at is not null from public.blog_posts where slug = 'published-post'),
  'published_at is stamped automatically on publish');

-- Anon ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq('select id from public.blog_posts',
  $$values ('60000000-0000-0000-0000-000000000001'::uuid)$$, 'anon: sees only published, non-deleted posts (no error)');
select is((select count(*)::int from public.seo_pages), 6, 'anon: reads seo_pages (no error)');
select throws_ok($$insert into public.blog_posts (slug, title) values ('x', 'X')$$, '42501', null, 'anon: cannot insert posts');
select throws_ok($$update public.seo_pages set title = 'X'$$, '42501', null, 'anon: cannot update seo_pages');
reset role;

-- Team member ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select results_eq('select id from public.blog_posts order by id',
  $$values ('60000000-0000-0000-0000-000000000001'::uuid), ('60000000-0000-0000-0000-000000000002'::uuid)$$,
  'team: sees published and drafts, not soft-deleted');
select lives_ok($$insert into public.blog_posts (id, slug, title, body_md, author_id) values
  ('60000000-0000-0000-0000-000000000004', 'team-post', 'Halal-friendly weekends', '# Hello', '00000000-0000-0000-0000-0000000000a2')$$,
  'team: can create a post');
select isnt_empty($$update public.blog_posts set is_published = true where slug = 'draft-post' returning id$$,
  'team: can publish a post');
select throws_ok($$update public.blog_posts set deleted_at = now() where slug = 'team-post'$$, '42501', null,
  'team: cannot soft delete a post');
select is_empty($$update public.blog_posts set deleted_at = null where slug = 'deleted-post' returning id$$,
  'team: cannot restore a post');
select throws_ok($$delete from public.blog_posts where slug = 'team-post'$$, '42501', null, 'team: cannot hard delete posts');
select throws_ok($$insert into public.seo_pages (path, title, description) values ('/team', 'T', 'D')$$, '42501', null,
  'team: cannot insert seo_pages');
select is_empty($$update public.seo_pages set title = 'Changed' returning path$$, 'team: cannot update seo_pages');
select throws_ok($$delete from public.seo_pages$$, '42501', null, 'team: cannot delete seo_pages (no grant)');
reset role;
select ok((select deleted_at is null from public.blog_posts where slug = 'team-post'), 'team-post is still not deleted');
select ok((select deleted_at is not null from public.blog_posts where slug = 'deleted-post'), 'deleted-post is still deleted');

-- Outsider ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.blog_posts), 2, 'outsider: sees only published posts');
select throws_ok($$insert into public.blog_posts (slug, title) values ('o', 'O')$$, '42501', null, 'outsider: cannot insert posts');
reset role;

-- Owner ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from public.blog_posts), 4, 'owner: sees all posts, including soft-deleted');
select isnt_empty($$update public.blog_posts set deleted_at = now() where slug = 'team-post' returning id$$, 'owner: can soft delete');
select isnt_empty($$update public.blog_posts set deleted_at = null where slug = 'deleted-post' returning id$$, 'owner: can restore');
select isnt_empty($$update public.seo_pages set description = 'New description' where path = '/about' returning path$$,
  'owner: can edit page SEO');
select lives_ok($$insert into public.seo_pages (path, title, description) values ('/halal-guide', 'Guide', 'Desc')$$,
  'owner: can add a page SEO row');
select throws_ok($$delete from public.seo_pages where path = '/halal-guide'$$, '42501', null,
  'owner: cannot delete page SEO rows (no DELETE grant)');
reset role;

-- Constraints ---------------------------------------------------------------
select throws_ok($$insert into public.seo_pages (path, title, description) values ('no-slash', 'T', 'D')$$, '23514', null,
  'seo_pages path must start with /');
insert into public.blog_posts (slug, title, is_published) values ('x-post', 'X', false);
update public.blog_posts set is_published = true, published_at = null where slug = 'x-post';
select ok((select published_at is not null from public.blog_posts where slug = 'x-post'),
  'publishing without a date gets published_at stamped by the trigger');

select * from finish();
rollback;
