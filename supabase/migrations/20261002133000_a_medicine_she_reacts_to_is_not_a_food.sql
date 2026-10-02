-- A MEDICINE SHE REACTS TO IS NOT A FOOD RESTRICTION.
--
-- Ruth, 2 October 2026, item 5: allergies are grouped by KIND - "on your plate"
-- (the only kind that arms the food filter), "skin and air", "medicines you
-- react to" (e.g. penicillin), "movements to leave out of sessions", and
-- "other". Nickel and hay fever must not appear under "your plate".
--
-- WHY THE KIND HAS TO EXIST RATHER THAN BEING A LABEL. The food filter acts on
-- kind 'food' and on kind 'other', because 'other' is the honest unknown and in
-- a food app the conservative reading of an unexplained allergy is that it is
-- edible. Penicillin arriving as 'other' would therefore arm the food filter
-- against the word "penicillin" in a meal suggestion - harmless in itself, and
-- the same mechanism that blocked two plain questions about nickel in September
-- when nickel defaulted to food.
--
-- SO 'medicine' IS DECLARED, AND filtersFood RETURNS FALSE FOR IT. It is still
-- read and still shown to the model, because what she reacts to matters; it just
-- does not restrict what she may eat.
--
-- IT IS NOT MEDICAL ADVICE AND NOTHING ACTS ON IT. The app records that she
-- reacts to something and never comments on doses, interactions or alternatives -
-- the same rule as the Medications card.

alter table allergies drop constraint if exists allergies_kind_check;
alter table allergies
  add constraint allergies_kind_check
  check (kind = any (array['food'::text, 'contact'::text, 'environmental'::text, 'medicine'::text, 'other'::text]));

comment on column allergies.kind is
  'Routing, not her word for her own body. food and other arm the food filter (other because an unexplained allergy in a food app is conservatively edible). contact, environmental and medicine do not. See app/lib/allergies.ts filtersFood.';
