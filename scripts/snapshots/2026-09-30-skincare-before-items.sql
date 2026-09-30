-- SNAPSHOT before the Evening Skincare Routine card was converted into items.
--
-- Ruth approved the conversion on 30 September 2026. Taken because the
-- conversion moves her `detail` line into history and adds an `items` array,
-- and because "delete nothing" only means something if there is a way back.
--
-- This is the card EXACTLY as it stood. Paste it to restore.

update almanac_entries
   set content = '{
  "why": "Trying to keep skin looking bright and even with age, especially given freckles",
  "detail": "Retinol 1% nightly, vitamin C rotated 3-4 nights a week",
  "status": "Active",
  "history": [
    {"date": "", "reason": null, "status": "Active"},
    {"date": "2026-09-29", "reason": "Alternating Vitamin C (Ascorbyl Glucoside) and Retinol at night to address fine lines around the eyes, under-eye laxity, enlarged pores, and freckle merging; Niacinamide added in the morning for skin barrier support, redness/inflammation (rosacea-type redness on cheeks) and pore appearance.", "status": "Active"},
    {"date": "2026-09-29", "reason": null, "status": "Paused"},
    {"date": "2026-09-29", "reason": null, "status": "Active"}
  ],
  "section": "Skincare"
}'::jsonb
 where id = 'a4e5180c-c749-4c40-aa76-1a32cc725538';

-- Verify:
--   select jsonb_pretty(content) from almanac_entries
--     where id = 'a4e5180c-c749-4c40-aa76-1a32cc725538';
--
-- Expect after restore: no "items" key, "detail" present, 4 history entries.
