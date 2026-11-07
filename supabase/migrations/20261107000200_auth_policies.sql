-- =============================================================================
-- Row-level security for signed-in users
-- =============================================================================
-- With accounts on, `session_id` holds the Supabase user id. These policies let
-- the `authenticated` role (guests included) read and write only its own rows.
-- The server still uses the service role, which bypasses them; they are defense
-- in depth if the anon key and a user's token ever reach Postgres directly.
-- The `anon` role keeps no policies, so it still reaches nothing.

-- Postgres has no `create policy if not exists`, so drop first to make the file safe to rerun.
-- `(select auth.uid())` runs once per statement instead of once per row.

-- `for all` covers select, insert, update and delete: `using` filters the rows a
-- statement can see or change, and `with check` refuses a write that would hand a
-- row to someone else.

drop policy if exists businesses_own_rows on businesses;
create policy businesses_own_rows on businesses
  for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);

drop policy if exists workflow_choices_own_rows on workflow_choices;
create policy workflow_choices_own_rows on workflow_choices
  for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);

drop policy if exists cards_own_rows on cards;
create policy cards_own_rows on cards
  for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);

drop policy if exists outbox_own_rows on outbox;
create policy outbox_own_rows on outbox
  for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);

drop policy if exists events_own_rows on events;
create policy events_own_rows on events
  for all to authenticated
  using (session_id = (select auth.uid())::text)
  with check (session_id = (select auth.uid())::text);

-- A policy only narrows what a grant allows. Supabase grants these by default;
-- granting them here keeps the policies working in a project that turned that off.
grant select, insert, update, delete on businesses, workflow_choices, cards, outbox, events to authenticated;
