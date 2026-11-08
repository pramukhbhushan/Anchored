-- One code-validated owner per customer conversation. Models may write card
-- words, but they cannot bypass the allowed transition table in the app.
create table public.conversation_states (
  session_id text not null,
  business_id text not null references public.businesses(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  owner text not null check (owner in ('frontdesk', 'followup', 'books', 'closed')),
  updated_at timestamptz not null,
  primary key (session_id, business_id, contact_id)
);

alter table public.conversation_states enable row level security;
create policy conversation_states_owner on public.conversation_states for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);
