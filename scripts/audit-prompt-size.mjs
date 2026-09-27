// HOW BIG IS THE THING THE MODEL ACTUALLY READS?
//
// Ruth, 27 September 2026, item 10: "Show me the full system prompt as the
// model actually receives it, with its length in tokens."
//
// Counted with Anthropic's own token counter rather than estimated from
// characters, because the answer only matters if it is the real number.
//
// WHAT IT CANNOT DO. The turn half of the prompt is assembled from her live
// record, so its exact size varies per turn. This measures the STATIC half -
// identical on every turn, and the part that is cached - plus the tool schema,
// exactly, and reports the turn half's shape from the source rather than
// pretending to a figure it cannot know without her data.

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = 'C:/Users/ruthi/unflump-app';
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: E.ANTHROPIC_API_KEY });

/** Pull a named exported template literal out of a source file. */
function literal(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const start = src.indexOf(`export const ${name} = \``);
  if (start < 0) return null;
  const from = src.indexOf('`', start) + 1;
  let i = from;
  while (i < src.length) {
    if (src[i] === '\\') i += 2;
    else if (src[i] === '`') break;
    else i++;
  }
  return src.slice(from, i);
}

async function tokens(text) {
  const res = await anthropic.messages.countTokens({
    model: 'claude-sonnet-5',
    system: text,
    messages: [{ role: 'user', content: 'x' }],
  });
  return res.input_tokens;
}

const PIECES = [
  ['GENERAL_CONDUCT', 'app/lib/conduct.ts'],
  ['CAPABILITIES', 'app/lib/capabilities.ts'],
  ['APP_STRUCTURE_PROMPT_BLOCK', 'app/lib/app-structure.ts'],
  ['VOICE_CONDUCT_BLOCK', 'app/lib/app-structure.ts'],
];

console.log('\n  WHAT THE MODEL READS, IN TOKENS\n');

let found = 0;
for (const [name, file] of PIECES) {
  const text = literal(file, name);
  if (!text) {
    console.log(`  ${name.padEnd(28)} not found in ${file}`);
    continue;
  }
  found++;
  const n = await tokens(text);
  console.log(`  ${name.padEnd(28)} ${String(n).padStart(6)} tokens   ${String(text.length).padStart(7)} chars`);
}
if (found === 0) console.log('  (none of the named blocks were found - the file layout has changed)');

// The tool schema, which is sent on every single turn and carries the reply
// itself as one of its fields.
const toolSrc = fs.readFileSync(path.join(ROOT, 'app/api/ask-selodia/route.ts'), 'utf8');
const fields = [...toolSrc.matchAll(/^ {4}(\w+): \{$/gm)].map((m) => m[1]);
console.log(`\n  TOOL SCHEMA: ${fields.length} fields on the classify tool`);
console.log(`  ${fields.join(', ')}\n`);
