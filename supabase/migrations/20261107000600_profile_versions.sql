-- =============================================================================
-- Profile versions: every save of a business profile keeps a copy
-- =============================================================================
-- `SupabaseStore.saveBusiness` writes the profile to `businesses` as before and
-- adds one row here with the whole profile and what saved it: onboarding, the
-- owner, the business chat, or an edit the owner made on a card. An earlier
-- version stays readable after a later one replaces it.

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
