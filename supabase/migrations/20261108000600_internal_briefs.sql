-- =============================================================================
-- Daily brief runs
-- =============================================================================
-- One row per business: whether a brief is being written now, and the last
-- brief that finished, with the numbers it counted. The Overview and the
-- Internal Communications page read that snapshot, so both show the same
-- counts. A brief started twice at once runs once; a failed one leaves the
-- last good brief and its window in place. Rows go with their business, so the
-- guest purge and "Delete my businesses" clear them without a change here.

create table if not exists brief_runs (
  session_id text not null,
  business_id text not null references businesses (id) on delete cascade,
  running_since timestamptz,
  last_success_at timestamptz,
  last_card_key text,
  last_snapshot jsonb,
  primary key (session_id, business_id)
);
alter table brief_runs enable row level security;
drop policy if exists brief_runs_owner on brief_runs;
create policy brief_runs_owner on brief_runs for all to authenticated
  using (session_id = (select auth.uid())::text) with check (session_id = (select auth.uid())::text);

-- Start a run in one statement: no run yet, the last one finished, or it started before `p_retake_before` and stalled.
create or replace function claim_brief_run(p_session text, p_business text, p_now timestamptz, p_retake_before timestamptz)
returns boolean
language sql
set search_path = public
as $$
  insert into brief_runs as run (session_id, business_id, running_since) values (p_session, p_business, p_now)
  on conflict (session_id, business_id) do update set running_since = p_now
    where run.running_since is null or run.running_since <= p_retake_before
  returning true;
$$;
revoke execute on function claim_brief_run(text, text, timestamptz, timestamptz) from public, anon, authenticated;
