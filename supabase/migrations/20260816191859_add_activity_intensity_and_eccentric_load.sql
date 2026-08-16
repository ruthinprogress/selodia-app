-- Log-time activity classification (build items 27 + 33): intensity for the
-- Activity tag (light/moderate/intense), and eccentric_load as the real semantic
-- signal the DOMS flag reads, retiring the keyword stopgap in
-- measurement-interpretation.ts. Both nullable: older rows and any parse that
-- can't determine a value stay null (the DOMS flag simply doesn't fire then).
alter table activity_logs add column intensity text
  check (intensity in ('light', 'moderate', 'intense'));
alter table activity_logs add column eccentric_load text
  check (eccentric_load in ('none', 'low', 'moderate', 'high'));
