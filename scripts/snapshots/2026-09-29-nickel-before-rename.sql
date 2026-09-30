-- SNAPSHOT before the overnight run of 29/30 September 2026 renamed the
-- section and put the card into second person.
--
-- Taken because the overnight protocol says to snapshot before changing her
-- data, and because a rename and a voice change are both easy to get subtly
-- wrong in a way nobody notices for weeks.
--
-- ONE ROW was affected. Paste this to put it back exactly as it was.

update almanac_entries
   set title    = 'Nickel',
       category = 'Skincare and allergies',
       content  = '{
         "why": "Contact with nickel jewellery brings a rash up on her neck. Found out 28 September 2026 after a necklace was left on overnight by accident.",
         "detail": "Rash on neck from leaving necklace on overnight - suspected nickel reaction",
         "status": "Active",
         "section": "Skincare and allergies"
       }'::jsonb
 where id = '9ea70830-2035-4ea3-bf10-08ea87033280';

-- Verify:
--   select title, category, content->>'section', content->>'why'
--     from almanac_entries where id = '9ea70830-2035-4ea3-bf10-08ea87033280';
