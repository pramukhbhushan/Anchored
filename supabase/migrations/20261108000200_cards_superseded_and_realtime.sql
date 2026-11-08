-- =============================================================================
-- Replaced drafts and a live card feed
-- =============================================================================
-- 1. A card may be `superseded`: a newer draft to the same customer replaced it
--    before the owner decided, so the owner never approves two in a row.
-- 2. `cards` joins the Realtime publication, so a new card reaches the owner's
--    screen without a refresh. Row-level security still decides who sees a row.

-- ---------- 1. superseded cards ----------
alter table cards drop constraint if exists cards_status_check;
alter table cards add constraint cards_status_check check (status in ('pending', 'approved', 'skipped', 'superseded'));

-- ---------- 2. Realtime ----------
-- Supabase creates `supabase_realtime`; a plain Postgres has none, and adding a table twice is an error.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cards') then
    alter publication supabase_realtime add table cards;
  end if;
end;
$$;
