// THE PROMPT, MEASURED RATHER THAN ESTIMATED.
//
// Ruth, 27 September 2026, item 10: "Show me the full system prompt as the
// model actually receives it, with its length in tokens."
//
// Token counts come from Anthropic's own counter, because a character estimate
// would be an answer she could not act on. It also dumps the assembled static
// prompt to a file so it can be read as one document rather than as fragments
// scattered across three files and a 2,700-line route.

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = 'C:/Users/ruthi/unflump-app';
const OUT = process.argv[2] ?? path.join(ROOT, 'scripts', 'audit-out');
fs.mkdirSync(OUT, { recursive: true });

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/** Pull a `const NAME = \`...\`` template literal out of TypeScript source. */
function literal(src, name) {
  const m = new RegExp(`(?:export )?const ${name} = \``).exec(src);
  if (!m) return null;
  let j = m.index + m[0].length;
  const out = [];
  while (j < src.length) {
    if (src[j] === '\\') {
      out.push(src.slice(j, j + 2));
      j += 2;
    } else if (src[j] === '`') break;
    else out.push(src[j++]);
  }
  return out.join('');
}

const files = {
  route: fs.readFileSync(path.join(ROOT, 'app/api/ask-selodia/route.ts'), 'utf8'),
  safety: fs.readFileSync(path.join(ROOT, 'app/lib/safety-classification.ts'), 'utf8'),
  structure: fs.readFileSync(path.join(ROOT, 'app/lib/app-structure.ts'), 'utf8'),
};

const WANT = [
  ['GENERAL_CONDUCT', 'route', 'every turn, cached'],
  ['CAPABILITIES', 'route', 'every turn, cached'],
  ['APP_STRUCTURE_PROMPT_BLOCK', 'structure', 'typed turns'],
  ['VOICE_CONDUCT_BLOCK', 'structure', 'spoken turns'],
  ['SAFETY_PROMPT_BLOCK', 'safety', 'every turn, uncached'],
];

async function count(text) {
  const res = await anthropic.messages.countTokens({
    model: 'claude-sonnet-5',
    system: text,
    messages: [{ role: 'user', content: 'x' }],
  });
  // The 'x' message and envelope cost a handful; close enough to ignore, and
  // subtracting a guess would be worse than saying so.
  return res.input_tokens;
}

console.log('\n  THE SYSTEM PROMPT, IN TOKENS\n');
const parts = [];
let total = 0;
for (const [name, file, when] of WANT) {
  const text = literal(files[file], name);
  if (!text) {
    console.log(`  ${name.padEnd(30)} NOT FOUND`);
    continue;
  }
  const n = await count(text);
  total += n;
  parts.push({ name, when, tokens: n, chars: text.length, text });
  console.log(`  ${name.padEnd(30)} ${String(n).padStart(6)} tokens  ${String(text.length).padStart(7)} chars   (${when})`);
}
console.log(`  ${'—'.repeat(30)} ${String(total).padStart(6)}\n`);

// THE TOOL. The reply is a FIELD on this, not assistant text - so its schema is
// part of what shapes every answer, and it is sent on every turn.
const toolFields = [...files.route.matchAll(/^ {4}(\w+): \{\n {6}type:/gm)].map((m) => m[1]);
const toolSrc = files.route.slice(
  files.route.indexOf('function buildClassifyTool'),
  files.route.indexOf('function buildClassifyTool') + 40000
);
const descriptions = [...toolSrc.matchAll(/description:\s*\n?\s*(['"`])/g)].length;
console.log(`  THE CLASSIFY TOOL: ${toolFields.length} fields, ${descriptions} descriptions`);
console.log(`  ${toolFields.join(', ')}\n`);

fs.writeFileSync(
  path.join(OUT, 'system-prompt.txt'),
  parts.map((p) => `${'='.repeat(70)}\n${p.name}  (${p.when}, ${p.tokens} tokens)\n${'='.repeat(70)}\n\n${p.text}\n`).join('\n')
);
console.log(`  written to ${path.join(OUT, 'system-prompt.txt')}\n`);
