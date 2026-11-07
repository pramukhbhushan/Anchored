-- =============================================================================
-- Demo data retention
-- =============================================================================
-- Demo sessions should not keep anyone's data forever. `purge_expired_demo_data`
-- deletes rows older than 30 days, the same lifetime as the `anchored_session`
-- cookie in `lib/session-cookie.ts`, and returns how many rows each table lost.

create or replace function purge_expired_demo_data()
returns table (table_name text, deleted_rows bigint)
language plpgsql
set search_path = public
as $$
declare
  cutoff constant timestamptz := now() - interval '30 days';
  n bigint;
begin
  -- Outbox goes before cards: deleting a card cascades to its outbox rows, and
  -- those would then be missing from the outbox count.
  delete from outbox where sent_at < cutoff;
  get diagnostics n = row_count;
  table_name := 'outbox'; deleted_rows := n; return next;

  delete from cards where created_at < cutoff;
  get diagnostics n = row_count;
  table_name := 'cards'; deleted_rows := n; return next;

  delete from events where received_at < cutoff;
  get diagnostics n = row_count;
  table_name := 'events'; deleted_rows := n; return next;

  delete from workflow_choices where updated_at < cutoff;
  get diagnostics n = row_count;
  table_name := 'workflow_choices'; deleted_rows := n; return next;

  delete from businesses where created_at < cutoff;
  get diagnostics n = row_count;
  table_name := 'businesses'; deleted_rows := n; return next;
end;
$$;

-- Supabase grants EXECUTE on new public functions to the API roles, which would
-- let anyone call this through `/rest/v1/rpc`. Only the database owner and the
-- server's service role may run it.
revoke execute on function purge_expired_demo_data() from public, anon, authenticated;

-- Run it daily with pg_cron. pg_cron must be enabled in the Supabase project
-- first (Dashboard > Database > Extensions > pg_cron); then run this once in
-- the SQL editor. Scheduling again under the same name replaces the job.
--
-- select cron.schedule(
--   'purge-expired-demo-data',
--   '17 4 * * *',
--   $cron$select purge_expired_demo_data()$cron$
-- );
--
-- To run it by hand: select * from purge_expired_demo_data();
