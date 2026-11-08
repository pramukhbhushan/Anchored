-- =============================================================================
-- Profile versions: every save of a business profile keeps a copy
-- =============================================================================
-- `SupabaseStore.saveBusiness` writes the profile to `businesses` as before and
-- adds one row here with the whole profile and what saved it: onboarding, the
-- owner, the business chat, or an edit the owner made on a card. An earlier
-- version stays readable after a later one replaces it. The 30-day purge of
-- guest data now clears guests' versions too, and still keeps real accounts.

create table if not exists profile_versions (
  session_id text not null,
  business_id text not null,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  changed_by text not null check (changed_by in ('onboarding', 'owner', 'chat', 'card_edit')),
  created_at timestamptz not null default now(),
  primary key (session_id, business_id, version)
);

alter table profile_versions enable row level security;

-- As on the other tables: a signed-in user's own token reaches only their own rows.
drop policy if exists profile_versions_own_rows on profile_versions;
create policy profile_versions_own_rows on profile_versions
  for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);

grant select, insert, update, delete on profile_versions to authenticated;

-- ---------- purge ----------
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

  delete from businesses where created_at < cutoff and session_id not in (select session_id from keep_sessions);
  get diagnostics n = row_count;
  table_name := 'businesses'; deleted_rows := n; return next;

  -- AI usage rows are counts with no personal data; keep a few days for the cap.
  delete from ai_usage where day < (now() - interval '7 days')::date;
end;
$$;
revoke execute on function purge_expired_demo_data() from public, anon, authenticated;
