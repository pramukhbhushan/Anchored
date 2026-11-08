-- =============================================================================
-- Connectors: contacts with consent, connected services, and a sending queue
-- =============================================================================
-- 1. `contacts` holds each customer's consent source and any STOP reply, so
--    Anchored texts only people with an OK on file.
-- 2. `connections` holds each business's connected services. Secrets arrive
--    encrypted by the app; `hook_id` names a connection in webhook URLs.
-- 3. The outbox says who sends each entry and how far the send got.
-- Only signed-in email and Google accounts can add contacts or connections, so
-- the 30-day purge of guest data has nothing to clear in the new tables.

-- ---------- 1. contacts ----------
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  business_id text not null,
  name text not null,
  phone text,
  email text,
  consent_source text check (consent_source in ('texted-first', 'web-form', 'in-person', 'paper', 'imported')),
  consent_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists contacts_business_idx on contacts (session_id, business_id);
create unique index if not exists contacts_phone_unique on contacts (session_id, business_id, phone) where phone is not null;
alter table contacts enable row level security;
drop policy if exists contacts_owner on contacts;
create policy contacts_owner on contacts for all to authenticated
  using (session_id = (select auth.uid())::text) with check (session_id = (select auth.uid())::text);

-- ---------- 2. connections ----------
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  business_id text not null,
  kind text not null check (kind in ('texting', 'email-out', 'email-in', 'stripe')),
  hook_id text not null unique,
  settings jsonb not null default '{}'::jsonb,
  secret text,
  created_at timestamptz not null default now(),
  unique (session_id, business_id, kind)
);
alter table connections enable row level security;
drop policy if exists connections_owner on connections;
create policy connections_owner on connections for all to authenticated
  using (session_id = (select auth.uid())::text) with check (session_id = (select auth.uid())::text);

-- ---------- 3. the outbox as a sending queue ----------
-- Every existing row was the owner's to send, which is what `yours` means.
alter table outbox add column if not exists delivery text not null default 'yours'
  check (delivery in ('yours', 'queued', 'sending', 'sent', 'failed'));
alter table outbox add column if not exists delivery_note text;
alter table outbox add column if not exists provider_id text;
create index if not exists outbox_due_idx on outbox (sent_at) where delivery = 'queued';
