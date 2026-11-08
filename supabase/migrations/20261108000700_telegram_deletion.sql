-- Retain the original sent message audit when its owner removes it from Telegram.
alter table public.outbox
  add column deletion_state text check (deletion_state in ('deleting', 'deleted', 'failed')),
  add column deletion_note text;
