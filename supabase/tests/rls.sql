-- Row-level security checks. Run with scripts/test-db.sh. Any failure raises and stops the run.
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', what; end if;
  raise notice 'ok - %', what;
end $$;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"user_A"}';
insert into trips (city, start_date, end_date) values ('Jaipur', '2026-10-16', '2026-10-19');
insert into memories (kind, text, evidence, source) values ('fact', 'Vegetarian, eats eggs', 'You told me', 'quiz');
select pg_temp.expect((select count(*) from memories) = 1, 'a user sees their own memories');
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"user_B"}';
select pg_temp.expect((select count(*) from trips) = 0 and (select count(*) from memories) = 0, 'another user sees none of them');
with d as (delete from memories returning 1) select pg_temp.expect((select count(*) from d) = 0, 'another user cannot delete them');
rollback;

do $$ begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"user_B"}', true);
  insert into memories (user_id, kind, text, evidence, source) values ('user_A', 'fact', 'x', 'x', 'chat');
  raise exception 'FAIL: wrote a row as another user';
exception when insufficient_privilege then raise notice 'ok - cannot write a row as another user';
end $$;

do $$ begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"user_A"}', true);
  insert into memories (kind, text, evidence, source, sensitive) values ('person', 'Priya is vegan', 'chat', 'chat', true);
  raise exception 'FAIL: saved a sensitive memory without consent';
exception when check_violation then raise notice 'ok - sensitive memories need consent';
end $$;

begin;
set local role authenticated;
set local request.jwt.claims = '{}';
select pg_temp.expect((select count(*) from memories) = 0, 'a signed-out request sees nothing');
rollback;

insert into place_cache (place_id, data) values ('p_test', '{}');
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"user_A"}';
select pg_temp.expect((select count(*) from place_cache) = 0, 'users cannot read the server-only place cache');
with d as (delete from memories returning 1) select pg_temp.expect((select count(*) from d) = 1, 'a user can forget their own memory');
commit;
