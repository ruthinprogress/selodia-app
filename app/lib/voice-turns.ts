// Pure helpers for the voice adapter (app/v1/chat/completions/route.ts).
//
// Kept here rather than in the route because a route file may only export its
// handlers, and these decide whether a spoken turn is new, so they are worth
// testing on their own: scripts/probe-voice-turns.mjs.

/**
 * Text reduced to its words, for comparing what was written with what was
 * spoken. ElevenLabs' record of a reply can differ from ours in punctuation and
 * spacing, and carries the holding line in front when one was said. Found on
 * 2026-09-12: "behind my knee." and "behind my knee, like..." were the same
 * words to a person and different strings to the old prefix check.
 */
export function words(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// How much of a reply's opening has to be found in what was spoken. An
// interrupted reply is recorded only as far as it got, so this is the opening,
// not the whole - long enough that two different replies do not share it.
export const HEARD_MATCH_CHARS = 40;

/**
 * Did ElevenLabs actually deliver this reply? Every request it sends carries the
 * conversation as it happened, so a reply that was spoken, or begun before she
 * interrupted it, is among `spokenReplies`. A reply it dropped because she
 * carried on talking is not.
 */
export function wasHeard(reply: string, spokenReplies: string[]): boolean {
  const opening = words(reply).slice(0, HEARD_MATCH_CHARS);
  if (!opening) return false;
  return spokenReplies.some((spoken) => words(spoken).includes(opening));
}

/**
 * The system tools ElevenLabs offered on a request, by name. They arrive in the
 * OpenAI `tools` array. A tool it did not offer is never called, so a change on
 * the agent cannot become a call to something that is not there.
 */
export function offeredTools(tools: unknown): Set<string> {
  const names = new Set<string>();
  if (!Array.isArray(tools)) return names;
  for (const t of tools) {
    const o = (t ?? {}) as { name?: unknown; function?: { name?: unknown } };
    const name = o.function?.name ?? o.name;
    if (typeof name === 'string' && name.length > 0) names.add(name);
  }
  return names;
}
