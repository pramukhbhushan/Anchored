-- =============================================================================
-- Telegram, customer threads and standing rules
-- =============================================================================
-- 1. Contacts can be Telegram customers, with no phone or email, and record
--    that they messaged the business first.
-- 2. Each business gets a random Telegram hook id for its customer link.
-- 3. The outbox can send to Telegram, and can hold an entry a standing rule or
--    a protocol notice authorized instead of a card.
-- 4. `thread_messages` keeps every message in and out of a customer's chat.
-- 5. `telegram_chats` and `telegram_updates` belong to the one shared bot: which
--    business each chat talks to, and which updates were already processed.
-- 6. `standing_rules` holds the rules an owner turned on; all start off.
-- 7. The 30-day purge covers the new tables, and guests' contacts, since a
--    guest's own business can now receive Telegram messages.

-- ---------- 1. contacts ----------
alter table contacts add column if not exists telegram_chat_id text;
alter table contacts add column if not exists telegram_name text;
create unique index if not exists contacts_telegram_unique on contacts (session_id, business_id, telegram_chat_id) where telegram_chat_id is not null;
alter table contacts drop constraint if exists contacts_consent_source_check;
alter table contacts add constraint contacts_consent_source_check
  check (consent_source in ('texted-first', 'messaged-first', 'web-form', 'in-person', 'paper', 'imported'));

-- ---------- 2. business hook ids ----------
-- Set the first time the business's link is shown, so existing businesses get one when they need it.
alter table businesses add column if not exists telegram_hook_id text unique;

-- ---------- 3. the outbox ----------
alter table outbox drop constraint if exists outbox_channel_check;
alter table outbox add constraint outbox_channel_check check (channel in ('sms', 'email', 'telegram', 'list'));
alter table outbox alter column card_id drop not null;
alter table outbox add column if not exists rule text check (rule in ('acknowledge', 'protocol'));
-- One acknowledgment per customer per window: a retry or a burst of messages can't queue a second.
alter table outbox add column if not exists rule_key text;
create unique index if not exists outbox_rule_key_unique on outbox (session_id, rule_key) where rule_key is not null;
-- Every entry is either a card the owner approved or a rule's fixed text.
alter table outbox drop constraint if exists outbox_card_or_rule;
alter table outbox add constraint outbox_card_or_rule check (card_id is not null or rule is not null);

-- ---------- 4. customer threads ----------
create table if not exists thread_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  business_id text not null,
  contact_id uuid not null,
  direction text not null check (direction in ('in', 'out')),
  body text not null check (char_length(body) <= 4096),
  skill text,
  card_key text,
  outbox_id uuid,
  provider_id text,
  created_at timestamptz not null default now()
);
create index if not exists thread_messages_contact_idx on thread_messages (session_id, business_id, contact_id, created_at);
alter table thread_messages enable row level security;
drop policy if exists thread_messages_owner on thread_messages;
create policy thread_messages_owner on thread_messages for all to authenticated
  using (session_id = (select auth.uid())::text) with check (session_id = (select auth.uid())::text);

-- ---------- 5. the shared bot ----------
-- Read and written only by the server with the service role. No policy, so no visitor reads another's chat.
create table if not exists telegram_chats (
  chat_id text primary key,
  session_id text not null,
  business_id text not null,
  contact_id uuid not null,
  bound_at timestamptz not null,
  blocked_at timestamptz
);
create index if not exists telegram_chats_session_idx on telegram_chats (session_id);
alter table telegram_chats enable row level security;

create table if not exists telegram_updates (
  update_id bigint primary key,
  status text not null check (status in ('claimed', 'done', 'failed')),
  claimed_at timestamptz not null,
  finished_at timestamptz
);
alter table telegram_updates enable row level security;

-- Claim an update in one statement: a new one, a failed one, or one claimed before `p_retake_before` and never finished.
create or replace function claim_telegram_update(p_update_id bigint, p_now timestamptz, p_retake_before timestamptz)
returns boolean
language sql
set search_path = public
as $$
  insert into telegram_updates as claim (update_id, status, claimed_at) values (p_update_id, 'claimed', p_now)
  on conflict (update_id) do update set status = 'claimed', claimed_at = p_now, finished_at = null
    where claim.status = 'failed' or (claim.status = 'claimed' and claim.claimed_at <= p_retake_before)
  returning true;
$$;
revoke execute on function claim_telegram_update(bigint, timestamptz, timestamptz) from public, anon, authenticated;

-- ---------- 6. standing rules ----------
create table if not exists standing_rules (
  session_id text not null,
  business_id text not null,
  rule text not null check (rule in ('acknowledge')),
  enabled boolean not null default false,
  approved_at timestamptz,
  changed_at timestamptz not null default now(),
  primary key (session_id, business_id, rule)
);
alter table standing_rules enable row level security;
drop policy if exists standing_rules_owner on standing_rules;
create policy standing_rules_owner on standing_rules for all to authenticated
  using (session_id = (select auth.uid())::text) with check (session_id = (select auth.uid())::text);

-- ---------- 7. purge ----------
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

  delete from thread_messages where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'thread_messages'; deleted_rows := n; return next;

  delete from contacts where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'contacts'; deleted_rows := n; return next;

  delete from telegram_chats where bound_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'telegram_chats'; deleted_rows := n; return next;

  delete from standing_rules where changed_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'standing_rules'; deleted_rows := n; return next;

  delete from businesses where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'businesses'; deleted_rows := n; return next;

  -- Update ids carry no personal data and only guard against Telegram's retries, which stop within a day.
  delete from telegram_updates where claimed_at < now() - interval '7 days';

  -- AI usage rows are counts with no personal data; keep a few days for the cap.
  delete from ai_usage where day < (now() - interval '7 days')::date;
end;
$$;
revoke execute on function purge_expired_demo_data() from public, anon, authenticated;
