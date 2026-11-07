-- =============================================================================
-- Retention keeps real accounts
-- =============================================================================
-- `purge_expired_demo_data` from 20261107000100 deleted every row older than
-- 30 days, which would also erase owners who signed up for an account. This
-- version deletes only rows of guests and anonymous demo sessions: a row stays
-- when its `session_id` is the id of a Supabase user who is not anonymous.

create or replace function purge_expired_demo_data()
returns table (table_name text, deleted_rows bigint)
language plpgsql
set search_path = public
as $$
declare
  cutoff constant timestamptz := now() - interval '30 days';
  n bigint;
begin
  -- Session ids of real accounts, whose data is the owner's to keep or delete.
  create temporary table keep_sessions on commit drop as
    select id::text as session_id from auth.users where not coalesce(is_anonymous, false);

  -- Outbox goes before cards: deleting a card cascades to its outbox rows, and
  -- those would then be missing from the outbox count.
  delete from outbox where sent_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'outbox'; deleted_rows := n; return next;

  delete from cards where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'cards'; deleted_rows := n; return next;

  delete from events where received_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'events'; deleted_rows := n; return next;

  delete from workflow_choices where updated_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'workflow_choices'; deleted_rows := n; return next;

  delete from businesses where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'businesses'; deleted_rows := n; return next;
end;
$$;

-- `create or replace` keeps the earlier grants, but restate the revoke so this file stands alone.
revoke execute on function purge_expired_demo_data() from public, anon, authenticated;
