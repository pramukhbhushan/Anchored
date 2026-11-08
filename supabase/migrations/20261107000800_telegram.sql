-- =============================================================================
-- Telegram: link codes, customer conversations, and the purge
-- =============================================================================
-- 1. `channel_links` holds the code in each business's Telegram link. A
--    customer who opens the link sends the code to the bot, which binds their
--    chat to that business.
-- 2. `conversations` holds each bound chat: its business, the agent that owns
--    it, and whether the customer opted out. A chat talks to one business at a
--    time, so the chat is the key.
-- 3. The 30-day purge covers the new tables and profile versions, and still
--    keeps real accounts.
-- The webhook has no visitor session, so `SupabaseStore` looks these tables up
-- by code and by chat with the service role, only after the webhook's secret checks out.

-- ---------- 1. link codes ----------
create table if not exists channel_links (
  code text primary key,
  session_id text not null,
  business_id text not null,
  channel text not null check (channel in ('telegram')),
  created_at timestamptz not null default now(),
  unique (session_id, business_id, channel)
);

-- ---------- 2. conversations ----------
create table if not exists conversations (
  channel text not null check (channel in ('telegram')),
  contact text not null,
  session_id text not null,
  business_id text not null,
  display_name text not null default '',
  owner_agent text not null default 'frontdesk' check (owner_agent in ('frontdesk', 'followup', 'books', 'closed')),
  opted_out boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (channel, contact)
);
create index if not exists conversations_session_idx on conversations (session_id, business_id);

alter table channel_links enable row level security;
alter table conversations enable row level security;

drop policy if exists channel_links_own_rows on channel_links;
create policy channel_links_own_rows on channel_links
  for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);

drop policy if exists conversations_own_rows on conversations;
create policy conversations_own_rows on conversations
  for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);

grant select, insert, update, delete on channel_links, conversations to authenticated;

-- ---------- 3. purge ----------
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

  delete from profile_versions where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'profile_versions'; deleted_rows := n; return next;

  delete from conversations where updated_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'conversations'; deleted_rows := n; return next;

  delete from channel_links where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'channel_links'; deleted_rows := n; return next;

  delete from businesses where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'businesses'; deleted_rows := n; return next;

  -- AI usage rows are counts with no personal data; keep a few days for the cap.
  delete from ai_usage where day < (now() - interval '7 days')::date;
end;
$$;

revoke execute on function purge_expired_demo_data() from public, anon, authenticated;
