-- Step 5 RLS/backfill follow-up, piece 4: migrate date of birth/biological
-- sex out of auth.users metadata (a temporary holding place) into
-- user_profile (their permanent home), now that real per-user rows can exist

alter table user_profile add column date_of_birth date;
alter table user_profile add column biological_sex text
  check (biological_sex in ('female', 'male', 'prefer_not_to_say'));

insert into user_profile (user_id, date_of_birth, biological_sex)
select
  id,
  (raw_user_meta_data->>'date_of_birth')::date,
  raw_user_meta_data->>'biological_sex'
from auth.users
where raw_user_meta_data->>'date_of_birth' is not null
   or raw_user_meta_data->>'biological_sex' is not null
on conflict (user_id) do update
  set date_of_birth = excluded.date_of_birth,
      biological_sex = excluded.biological_sex;
