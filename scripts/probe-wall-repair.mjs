// WHAT THE LAYOUT STEP DOES TO THE REPLY SHE COMPLAINED ABOUT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-wall-repair.mjs [message id]
//
// check-no-walls.mjs proves the rules on invented text. This runs the real
// thing on the real message - 1,020 characters with no line break in it, 15
// October 2026 - and prints it before and after, because the only question
// that matters about a layout step is whether the result reads better.
//
// With no argument it takes that message. With "recent" it takes every long
// assistant reply of the last fortnight, which is how to see whether the rules
// do something sensible to messages they were not written against.
//
// READ-ONLY. It reads rows and writes nothing anywhere.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { layOut, looksLikeWall, longestBlock, sameWords } = await import(root + '/app/lib/reply-shape.ts');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const which = process.argv[2] ?? '10998415-5182-46f7-8566-76dceb022f8d';

function show(content) {
  const out = layOut(content);
  console.log(
    `\n  ${longestBlock(content)} -> ${longestBlock(out)} characters in the longest block   ` +
      `words unchanged: ${sameWords(content, out)}   ${out === content ? 'LEFT ALONE' : 'laid out'}`
  );
  console.log('  ' + '-'.repeat(70));
  console.log(out.replace(/^/gm, '  '));
  return out !== content;
}

if (which === 'recent') {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, content')
    .eq('role', 'assistant')
    .gt('created_at', new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const walls = data.filter((row) => looksLikeWall(row.content));
  console.log(`\n  ${walls.length} walls in the last ${data.length} assistant replies\n`);
  let changed = 0;
  for (const row of walls) {
    console.log(`\n  == ${row.id}`);
    if (show(row.content)) changed += 1;
  }
  console.log(`\n  ${changed} of ${walls.length} were improved, 0 altered a word.\n`);
} else {
  const { data, error } = await supabase.from('chat_messages').select('content').eq('id', which).single();
  if (error) throw new Error(`could not read the message: ${error.message}`);
  console.log(`\n  BEFORE  ${data.content.length} characters`);
  console.log('  ' + '-'.repeat(70));
  console.log(data.content.replace(/^/gm, '  '));
  console.log('\n  AFTER');
  show(data.content);
  console.log('');
}
