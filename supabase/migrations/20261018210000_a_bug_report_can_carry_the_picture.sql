-- A BUG REPORT CAN CARRY THE PICTURE.
--
-- Ruth, 18 October 2026, after chat sent her to an edit screen that does not
-- exist and she had to report it the long way round:
--
--   "I think while its in Beta there should be a quick tap way for users to
--    report. Tap on icon takes screenshot automatically of where they are which
--    is stored with their notes and saved to the bug list which needs reviewing
--    daily at this stage."
--
-- WHAT WAS ALREADY TRUE, which is most of it. Two separate flows exist and they
-- are NOT duplicates, though they look like it from the outside:
--
--   feedback_reports   "Something not right?" - a BUG. Carries which update,
--                      which platform, which OS, which screen, automatically.
--                      No screenshot.
--   beta_feedback      How a tester is finding it: feelings, an answer to a
--                      question the app asked, feature votes. HAS a screenshot,
--                      uploaded to the private beta-feedback bucket.
--
-- So the picture already works, against the wrong table. A bug is the report
-- that most needs one - "it did the thing wrong again" from an update nobody
-- can identify is the exact case the context fields were added for, and a
-- picture answers it in one glance.
--
-- THE BUCKET IS NOT NEW AND IS ALREADY PRIVATE. Its path rule checks the first
-- segment against auth.uid(), and lib/beta-feedback.ts says why in as many
-- words: "A screenshot of this app is a picture of somebody's own health
-- record, so the bucket is private and nothing here ever produces a public
-- URL." That reasoning is unchanged and this column stores a PATH into it,
-- never a URL.

alter table public.feedback_reports
  -- Path inside the private beta-feedback bucket, as '<user id>/<millis>.jpg'.
  -- Null is the normal case: a report without a picture is still a report, and
  -- the send must never fail because an upload did.
  add column if not exists screenshot_path text;

comment on column public.feedback_reports.screenshot_path is
  'Path into the PRIVATE beta-feedback bucket, never a URL. Null when none was attached or the upload failed - a report is never lost because its picture was. A screenshot of this app is a picture of somebody''s health record: it is served only through a short-lived signed URL, and deleted with the report.';

-- REVIEWED DAILY, WHICH NEEDS AN ORDER TO READ THEM IN. Ruth: the bug list
-- "needs reviewing daily at this stage". `status` already exists and already
-- defaults to new; this is the index that makes "what came in since yesterday"
-- one cheap query rather than a scan.
create index if not exists feedback_reports_to_review
  on public.feedback_reports (status, created_at desc);
