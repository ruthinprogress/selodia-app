-- Choices can be changed in Settings (2026-09-19). UK GDPR Article 7(3):
-- withdrawing consent must be as easy as giving it. A change there is a new
-- row, like every other, so the history of what was agreed survives.
alter table public.consent_records drop constraint consent_records_source_check;
alter table public.consent_records add constraint consent_records_source_check
  check (source in ('onboarding', 'reconfirm', 'settings'));
