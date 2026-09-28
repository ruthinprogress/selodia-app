-- AN ALLERGY HAS A KIND, AND ONLY ONE KIND FILTERS FOOD (2026-09-28).
-- Applied via the management API the same day. A contact allergy to nickel was
-- arming a food gate and blocking plain questions about nickel.
alter table public.allergies add column if not exists kind text not null default 'food';
alter table public.allergies drop constraint if exists allergies_kind_check;
alter table public.allergies add constraint allergies_kind_check
  check (kind in ('food', 'contact', 'environmental', 'other'));
update public.allergies set kind = 'contact' where name = 'nickel';
update public.allergies set kind = 'environmental' where name = 'seasonal allergy (hay fever, summer)';
