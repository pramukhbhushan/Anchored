-- =============================================================================
-- AI budget, one send per card, and chat tables brought in line
-- =============================================================================
-- 1. `ai_usage` and `use_ai_call` cap model calls per day across every server
--    instance, so no visitor can run up the AI bill past the cap.
-- 2. A card can reach the outbox once: a double tap can't send it twice.
-- 3. The chat tables get the same signed-in-user policies as the others.
-- 4. The 30-day purge covers the chat tables, and still keeps real accounts.

-- ---------- 1. daily AI budget ----------
create table if not exists ai_usage (
  day date primary key,
  calls integer not null default 0
);
alter table ai_usage enable row level security;

-- Count one call and report whether it fits under `p_cap`, in one statement so
-- concurrent callers can't both slip under the cap.
create or replace function use_ai_call(p_day date, p_cap integer)
returns boolean
language sql
set search_path = public
as $$
  insert into ai_usage as usage (day, calls) values (p_day, 1)
  on conflict (day) do update set calls = usage.calls + 1
    where usage.calls < p_cap
  returning true;
$$;
revoke execute on function use_ai_call(date, integer) from public, anon, authenticated;

-- ---------- 2. one outbox row per card ----------
create unique index if not exists outbox_card_unique on outbox (card_id);

-- ---------- 3. chat table policies ----------
drop policy if exists intake_drafts_owner on intake_drafts;
create policy intake_drafts_owner on intake_drafts for all to authenticated
  using (session_id = (select auth.uid())::text) with check (session_id = (select auth.uid())::text);

drop policy if exists chat_messages_owner on chat_messages;
create policy chat_messages_owner on chat_messages for all to authenticated
  using (session_id = (select auth.uid())::text) with check (session_id = (select auth.uid())::text);

-- ---------- 4. purge covers chats ----------
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

  -- Outbox goes before cards: deleting a card cascades to its outbox rows.
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

  delete from chat_messages where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'chat_messages'; deleted_rows := n; return next;

  delete from intake_drafts where updated_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'intake_drafts'; deleted_rows := n; return next;

  delete from businesses where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'businesses'; deleted_rows := n; return next;

  -- AI usage rows are counts with no personal data; keep a few days for the cap.
  delete from ai_usage where day < (now() - interval '7 days')::date;
end;
$$;
revoke execute on function purge_expired_demo_data() from public, anon, authenticated;
