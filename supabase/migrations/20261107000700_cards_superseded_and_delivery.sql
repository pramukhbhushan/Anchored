-- =============================================================================
-- Replaced drafts, Telegram delivery, and a live card feed
-- =============================================================================
-- 1. A card may be `superseded`: a newer draft to the same customer replaced it
--    before the owner decided, so the owner never approves two in a row.
-- 2. The outbox takes Telegram replies, with the customer's chat and whether
--    Telegram took the message.
-- 3. `cards` joins the Realtime publication, so a new card reaches the owner's
--    screen without a refresh. Row-level security still decides who sees a row.

-- ---------- 1. superseded cards ----------
alter table cards drop constraint if exists cards_status_check;
alter table cards add constraint cards_status_check check (status in ('pending', 'approved', 'skipped', 'superseded'));

-- ---------- 2. Telegram in the outbox ----------
alter table outbox drop constraint if exists outbox_channel_check;
alter table outbox add constraint outbox_channel_check check (channel in ('sms', 'email', 'list', 'telegram'));
alter table outbox add column if not exists contact text;
alter table outbox add column if not exists delivered_at timestamptz;
alter table outbox add column if not exists delivery_error text;

-- The delivery job reads Telegram rows that are due and not yet taken or refused.
create index if not exists outbox_undelivered_idx on outbox (sent_at)
  where channel = 'telegram' and delivered_at is null and delivery_error is null;

-- ---------- 3. Realtime ----------
-- Supabase creates `supabase_realtime`; a plain Postgres has none, and adding a table twice is an error.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cards') then
    alter publication supabase_realtime add table cards;
  end if;
end;
$$;
