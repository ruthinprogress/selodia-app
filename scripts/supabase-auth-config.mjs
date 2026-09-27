// Apply Selodía's auth configuration to the hosted Supabase project.
//
// WHAT THIS EXISTS FOR. The password-reset flow shipped on 27 September and
// CANNOT WORK until the app's own URL is on the project's redirect allow-list:
// Supabase refuses to redirect anywhere it has not been told about, so the link
// in the email opens a browser error instead of the app. The email template is
// the second half - by default it is Supabase's stock English, which is not the
// voice anything else in this app is written in.
//
// WHY IT IS A SCRIPT AND NOT SOMETHING I JUST DID. Both settings live in the
// project's auth CONFIG, which is reachable only through the Management API,
// and that API takes a personal access token (sbp_...) rather than the service
// role key. The service role key in .env.local is powerful over DATA and has no
// authority over configuration at all - that separation is deliberate and it is
// the right way round. There is no such token in this repository, in the
// environment, or in the Supabase CLI's credential store, and `supabase login`
// opens a browser for a human to approve. So this is the one piece of the
// Supabase work that genuinely could not be done without Ruth.
//
// HOW TO RUN IT
//
//   1. https://supabase.com/dashboard/account/tokens  ->  Generate new token
//   2. Name it something like "selodia-config", copy it
//   3. In the project folder:
//
//        SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/supabase-auth-config.mjs
//
// It prints what it is about to change, changes it, and reads the config back
// to prove it landed. It is safe to run twice.
//
// THE TOKEN IS NEVER STORED OR PRINTED by this script. Revoke it afterwards if
// preferred; it is thirty seconds to make another.

const PROJECT_REF = 'jwyzpkxcaxdnjkykoahn';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('\n  SUPABASE_ACCESS_TOKEN is not set. See the comment at the top of this file.\n');
  process.exit(1);
}

// THE REDIRECT ALLOW-LIST.
//
// Two entries, and the second is not optional. The first is the real app. The
// second is the development build, which resolves a different scheme entirely -
// without it the reset works for testers and not for Ruth, which is the worst
// way round for something she has to verify herself.
const REDIRECTS = [
  'selodia://onboarding/reset-password',
  'exp://**/--/onboarding/reset-password',
];

// THE EMAIL, IN HER VOICE.
//
// Three deliberate things. It never says "click here" - the link says what it
// does. It gives the expiry BEFORE she hits it rather than after. And the last
// line matters most: somebody who did NOT ask for this needs telling
// immediately that nothing has happened, not left wondering what has been done
// to their account.
const SUBJECT = 'Your Selodía password';
const BODY = `<p>Someone asked to reset the password on your Selodía account.</p>
<p>If that was you, this link will open Selodía and let you choose a new one.</p>
<p><a href="{{ .ConfirmationURL }}">Choose a new password</a></p>
<p>The link works for one hour, and only once.</p>
<p>If it was not you, you can ignore this. Nothing has changed and your account is fine.</p>
<p>Ruth<br>Selodía</p>`;

async function call(method, body) {
  const res = await fetch(API, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    // Never echo the token, and never echo a whole config back into a log.
    throw new Error(`${method} ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

const before = await call('GET');
const existing = String(before.uri_allow_list ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ADDED TO, NEVER REPLACED. Whatever is already on that list is there for a
// reason somebody had - the Google sign-in redirects among them - and a config
// script that quietly drops an entry breaks sign-in for everybody.
const merged = [...new Set([...existing, ...REDIRECTS])];

console.log('\n  REDIRECT ALLOW-LIST');
for (const u of merged) {
  console.log(`    ${existing.includes(u) ? 'kept ' : 'ADDED'}  ${u}`);
}
console.log('\n  RESET EMAIL');
console.log(`    subject: ${SUBJECT}`);
console.log(`    body:    ${BODY.split('\n').length} lines, in her voice\n`);

await call('PATCH', {
  uri_allow_list: merged.join(','),
  mailer_subjects_recovery: SUBJECT,
  mailer_templates_recovery_content: BODY,
});

// READ BACK, because "the request returned 200" is not the same as "the setting
// is what I meant". This app has been bitten by that difference more than once.
const after = await call('GET');
const now = String(after.uri_allow_list ?? '');
const missing = REDIRECTS.filter((u) => !now.includes(u));
const subjectOk = after.mailer_subjects_recovery === SUBJECT;
const bodyOk = String(after.mailer_templates_recovery_content ?? '').includes('Choose a new password');

console.log('  VERIFIED BY READING IT BACK');
console.log(`    redirects present: ${missing.length === 0 ? 'yes' : 'NO - missing ' + missing.join(', ')}`);
console.log(`    subject set:       ${subjectOk ? 'yes' : 'NO'}`);
console.log(`    body set:          ${bodyOk ? 'yes' : 'NO'}`);

const good = missing.length === 0 && subjectOk && bodyOk;
console.log(`\n  ${good ? 'Done. The password reset can work now - test it on your phone.' : 'SOMETHING DID NOT LAND. Nothing else has changed; tell Claude what it printed.'}\n`);
process.exit(good ? 0 : 1);
