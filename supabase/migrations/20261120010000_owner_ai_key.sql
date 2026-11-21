-- =============================================================================
-- Owner AI keys
-- =============================================================================
-- An owner's own AI key is a fifth connection kind, `ai`. The key sits in the
-- encrypted `secret` column like a Twilio auth token; `settings` holds only the
-- provider, the optional model and the key's last four characters. Postgres
-- named the inline check from `20261108000000_connectors.sql` after its column.

alter table connections drop constraint if exists connections_kind_check;
alter table connections add constraint connections_kind_check
  check (kind in ('texting', 'email-out', 'email-in', 'stripe', 'ai'));
