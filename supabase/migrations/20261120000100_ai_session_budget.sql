-- =============================================================================
-- A daily AI call cap per session
-- =============================================================================
-- `ai_usage` caps model calls per day for every visitor together, so one
-- visitor could spend the whole day's budget. `ai_session_usage` and
-- `use_session_ai_call` add a cap per session that the server checks first.
-- Only the service role reads or writes the table: row level security is on
-- with no policies, and the function can't be called by anon or signed-in users.

create table if not exists ai_session_usage (
  session_id text not null,
  day date not null,
  calls integer not null default 0,
  primary key (session_id, day)
);
alter table ai_session_usage enable row level security;

-- Count one call for the session and report whether it fits under `p_cap`, in
-- one statement so concurrent callers can't both slip under the cap. A cap of 0
-- inserts nothing, so it refuses the day's first call too.
create or replace function use_session_ai_call(p_session_id text, p_day date, p_cap integer)
returns boolean
language sql
set search_path = public
as $$
  insert into ai_session_usage as usage (session_id, day, calls)
    select p_session_id, p_day, 1 where p_cap > 0
  on conflict (session_id, day) do update set calls = usage.calls + 1
    where usage.calls < p_cap
  returning true;
$$;
revoke execute on function use_session_ai_call(text, date, integer) from public, anon, authenticated;
