begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-a@example.test', 'x', now(), '{}', '{}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-b@example.test', 'x', now(), '{}', '{}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor@example.test', 'x', now(), '{}', '{}', now(), now());
update public.profiles set role = 'editor' where id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select is((select count(*) from public.workspaces), 1::bigint, 'a student only sees their own workspace');
select throws_ok($$insert into public.workspaces (owner_id) values ('22222222-2222-2222-2222-222222222222')$$, '42501', null, 'a student cannot create another user workspace');
select throws_ok($$update public.profiles set role = 'guardian' where id = '11111111-1111-1111-1111-111111111111'$$, '42501', null, 'a student cannot change their own role');
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select lives_ok($$insert into public.resources (stable_key) values ('editor-can-create')$$, 'an editor can create catalog resources');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select throws_ok($$insert into public.resources (stable_key) values ('student-cannot-create')$$, '42501', null, 'a student cannot create catalog resources');
select is((select count(*) from public.profiles), 1::bigint, 'a student cannot list other profiles');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*) from public.workspaces), 1::bigint, 'another student only sees their own workspace');
select * from finish();
rollback;
