// THE THANK YOU, WHEN SOMEBODY'S MOVEMENT GETS DRAWN.
//
//   node scripts/thank-the-requesters.mjs "<movement name>"
//   node scripts/thank-the-requesters.mjs "<movement name>" --dry-run
//
// Ruth, 18 October 2026: "When the users illustration lands, they should get a
// notification, nice little touch to thank them for contributing to Selodia...
// Infact it could actually be a thank you note that also tells them it's there."
//
// WHAT MAKES THIS WORTH SENDING. Somebody asked for a movement the app could
// not show them. They got words, which is a complete answer but not the best
// one. Weeks later it is drawn, and it appears in their plan on its own because
// the card looks up what exists every time it opens. Without this note they
// would never know their asking is what caused it.
//
// THE FIRST PUSH THIS APP HAS EVER SENT. push_tokens has been written by the
// phone since September and read by nothing. Checked before building on it: one
// live token, seen the same morning - the table was silently empty for weeks
// once before, which is exactly the kind of thing to verify rather than assume.
//
// ONE PERSON IS THANKED ONCE PER MOVEMENT, however many of their plans it was
// in, and thanked_at records it so a re-upload cannot thank them twice.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const movement = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!movement) {
  console.log('\n  usage: node scripts/thank-the-requesters.mjs "<movement name>" [--dry-run]\n');
  process.exit(1);
}

/**
 * THE WORDING, AND WHY IT IS THIS SHORT.
 *
 * It is a thank you first and a notice second, which is the order Ruth asked
 * for. It never says the app was lacking something - the written version was a
 * real answer at the time, and calling it a gap now would reframe what they
 * already had as broken.
 *
 * Her voice rules: short plain sentences, no em dashes.
 */
function note(name) {
  return {
    title: 'Your movement has been drawn',
    body:
      `You asked for ${name}. It is illustrated now, and it is already in your plan. ` +
      `Thank you for helping Selodia grow.`,
  };
}

const { data: people, error } = await supabase.rpc('requesters_to_thank', {
  movement_name: movement,
});
if (error) {
  console.log(`\n  could not look up who asked: ${error.message}\n`);
  process.exit(1);
}
if (!people || people.length === 0) {
  console.log(`\n  nobody to thank for "${movement}"\n`);
  process.exit(0);
}

const name = people[0].name ?? movement;
const { title, body } = note(name);

const { data: tokens, error: tokenError } = await supabase
  .from('push_tokens')
  .select('user_id, token')
  .in('user_id', people.map((p) => p.user_id));
if (tokenError) {
  console.log(`\n  could not read push tokens: ${tokenError.message}\n`);
  process.exit(1);
}

console.log(`\n  "${name}" was asked for by ${people.length} person(s), ${tokens?.length ?? 0} device(s)`);
console.log(`  ${title}`);
console.log(`  ${body}\n`);

if (!tokens || tokens.length === 0) {
  // NOT AN ERROR. Somebody can ask for a movement and never have turned
  // notifications on, and that is their choice rather than a fault.
  console.log('  no devices to send to - marking them thanked anyway so it is not retried\n');
}

if (dryRun) {
  console.log('  DRY RUN - nothing sent, nothing marked\n');
  process.exit(0);
}

if (tokens && tokens.length > 0) {
  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    sound: 'default',
    // So the app can open the right place if it ever handles taps.
    data: { kind: 'movement-illustrated', movement: name },
  }));

  const res = await fetch(EXPO_PUSH, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok) {
    console.log(`  SEND FAILED  HTTP ${res.status} ${JSON.stringify(result)?.slice(0, 300)}\n`);
    process.exit(1);
  }

  // Expo answers per message; a bad token fails on its own without taking the
  // others with it, so the failures are reported rather than thrown.
  const tickets = result?.data ?? [];
  const bad = tickets.filter((t) => t.status !== 'ok');
  console.log(`  sent ${tickets.length - bad.length} of ${tickets.length}`);
  for (const t of bad) console.log(`    not delivered: ${t.message ?? JSON.stringify(t)}`);
}

const { data: marked, error: markError } = await supabase.rpc('mark_requesters_thanked', {
  movement_name: movement,
});
if (markError) {
  console.log(`  note: could not mark them thanked (${markError.message})`);
} else {
  console.log(`  ${marked} marked as thanked\n`);
}
