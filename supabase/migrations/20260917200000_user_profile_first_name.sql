-- What she would like to be called.
--
-- The Today screen greets by name (UI brief, 2026-09-17), and the account held
-- no name at all: the first version read one off the email address, which is a
-- guess about somebody's name made from an account handle. Asked for once, at
-- sign-up, and optional - a greeting with no name is better than a wrong one.
alter table user_profile add column if not exists first_name text;

comment on column user_profile.first_name is
  'What the person would like to be called. Optional; the greeting omits the name when it is null.';
