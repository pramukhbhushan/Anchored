-- =============================================================================
-- Browser roles read cards only
-- =============================================================================
-- Earlier migrations gave the `authenticated` role, which one-click guests
-- also hold, insert, update and delete on its own rows in every owner table.
-- That let anyone with a guest token write cards, outbox rows and connections
-- through PostgREST, skipping every server check, including approval.
--
-- The server reaches Postgres with the service role, which ignores grants and
-- policies, so it needs none of this. The browser needs one thing: to receive
-- its own card changes through Realtime (`CardFeedRealtime.tsx`). So:
-- 1. Revoke every table privilege from `anon` and `authenticated`.
-- 2. Drop the read-write policies.
-- 3. Grant back a read of the caller's own cards, and the shared playbook.
-- 4. New tables start with no browser privileges either.

-- ---------- 1. revoke ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ---------- 2. drop read-write policies ----------
drop policy if exists businesses_own_rows on businesses;
drop policy if exists workflow_choices_own_rows on workflow_choices;
drop policy if exists cards_own_rows on cards;
drop policy if exists outbox_own_rows on outbox;
drop policy if exists events_own_rows on events;
drop policy if exists intake_drafts_owner on intake_drafts;
drop policy if exists chat_messages_owner on chat_messages;
drop policy if exists contacts_owner on contacts;
drop policy if exists connections_owner on connections;
drop policy if exists brief_runs_owner on brief_runs;
drop policy if exists profile_versions_own_rows on profile_versions;
drop policy if exists thread_messages_owner on thread_messages;
drop policy if exists standing_rules_owner on standing_rules;
drop policy if exists customer_followups_owner on public.customer_followups;
drop policy if exists conversation_states_owner on public.conversation_states;

-- ---------- 3. grant back reads ----------
drop policy if exists cards_read_own on cards;
create policy cards_read_own on cards
  for select to authenticated
  using (session_id = (select auth.uid())::text);
grant select on cards to authenticated;

grant select on post_formats, post_hooks, post_hashtags to anon, authenticated;

-- ---------- 4. future tables ----------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
