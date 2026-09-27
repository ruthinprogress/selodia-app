// How big the rebuilt reply prompt is, against the 16,000 tokens it replaces.
// Counted with Anthropic's own counter, same as the audit.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

import { replyPrompt, REPLY_PROMPT_PARTS } from '../app/lib/reply-prompt.ts';

const env = {};
for (const line of fs.readFileSync('C:/Users/ruthi/unflump-app/.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const count = async (text) =>
  (
    await anthropic.messages.countTokens({
      model: 'claude-sonnet-5',
      system: text,
      messages: [{ role: 'user', content: 'x' }],
    })
  ).input_tokens;

console.log('\n  THE REBUILT REPLY PROMPT\n');
for (const [name, text] of Object.entries(REPLY_PROMPT_PARTS)) {
  console.log(`  ${name.padEnd(22)} ${String(await count(text)).padStart(5)} tokens`);
}
console.log('');
console.log(`  typed turn            ${String(await count(replyPrompt())).padStart(5)} tokens`);
console.log(`  spoken turn           ${String(await count(replyPrompt({ voice: true }))).padStart(5)} tokens`);
console.log(`  weekly roundup        ${String(await count(replyPrompt({ roundup: true }))).padStart(5)} tokens`);
console.log('\n  it replaces GENERAL_CONDUCT + CAPABILITIES at 12,593 tokens.\n');
