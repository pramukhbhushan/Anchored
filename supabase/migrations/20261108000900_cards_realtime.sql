-- Let signed-in owners receive card inserts and updates through Supabase
-- Realtime. Existing row-level security on cards still decides which rows a
-- browser may receive.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cards'
  ) then
    alter publication supabase_realtime add table public.cards;
  end if;
end
$$;
