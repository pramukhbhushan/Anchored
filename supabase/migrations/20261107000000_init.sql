-- =============================================================================
-- Anchored schema
-- =============================================================================
-- Every row belongs to an anonymous demo session (the `anchored_session` cookie).
-- The app reaches Postgres only from the server with the service role key, so
-- row-level security is on with no policies: the public anon key can read nothing.

create table if not exists businesses (
  id text primary key,
  session_id text not null,
  profile jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists businesses_session_idx on businesses (session_id, created_at);

-- Case studies live in code, so `business_id` is not a foreign key: a session's
-- choices for the HVAC case study point at the code-defined id `hvac`.
create table if not exists workflow_choices (
  session_id text not null,
  business_id text not null,
  workflow text not null,
  choice jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, business_id, workflow)
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  business_id text not null,
  key text not null,
  draft jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'skipped')),
  edited boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  -- A draft is created once per session; later syncs must not duplicate it.
  unique (session_id, key)
);
create index if not exists cards_business_idx on cards (session_id, business_id, created_at);

create table if not exists outbox (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  business_id text not null,
  card_id uuid not null references cards (id) on delete cascade,
  channel text not null check (channel in ('sms', 'email', 'list')),
  recipient text not null,
  body text not null,
  sent_at timestamptz not null default now()
);
create index if not exists outbox_business_idx on outbox (session_id, business_id, sent_at);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  business_id text not null,
  source text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index if not exists events_business_idx on events (session_id, business_id, received_at);

alter table businesses enable row level security;
alter table workflow_choices enable row level security;
alter table cards enable row level security;
alter table outbox enable row level security;
alter table events enable row level security;
