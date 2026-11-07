-- =============================================================================
-- Chat: onboarding by conversation, and each business's ongoing chat
-- =============================================================================
-- `intake_drafts` holds an onboarding chat's facts so far; `chat_messages` holds
-- the messages of every thread, onboarding and business alike. As in the init
-- migration, only the server reaches these tables, so RLS is on with no policies.

create table if not exists intake_drafts (
  id text primary key,
  session_id text not null,
  draft jsonb not null,
  -- Set once the owner confirms and the business exists. Not a foreign key, like `workflow_choices`.
  business_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intake_drafts_session_idx on intake_drafts (session_id, updated_at);

create table if not exists chat_messages (
  -- An identity id orders messages: one insert stores an owner message and its reply with the same `now()`.
  id bigint generated always as identity primary key,
  session_id text not null,
  thread_kind text not null check (thread_kind in ('intake', 'business')),
  -- An intake id or a business id. Case studies are read-only in chat, so their ids never appear here.
  thread_id text not null,
  role text not null check (role in ('anchored', 'owner')),
  body text not null,
  -- What a business chat reply changed in the profile, for the chat to show under the reply.
  changes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on chat_messages (session_id, thread_kind, thread_id, id);

alter table intake_drafts enable row level security;
alter table chat_messages enable row level security;
