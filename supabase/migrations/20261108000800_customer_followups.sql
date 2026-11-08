-- Owner-recorded timers contain facts only. They create approval cards, never automatic sends.
create table public.customer_followups (
  session_id text not null,
  business_id text not null references public.businesses(id) on delete cascade,
  id text not null,
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  primary key (session_id, business_id, id)
);
alter table public.customer_followups enable row level security;
create policy customer_followups_owner on public.customer_followups for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);
