// Protein-quality flagging (UNFLUMP_SPEC.md, Part Eight). The per-source
// classification is captured deterministically at log time (protein_source, per
// Part Two principle 13); the rules over it are fixed, not model-invented:
// collagen is always incomplete, plant proteins are incomplete (worth a
// complementary pairing), animal proteins need no flag. This module holds the
// day-level rule — pure and testable, in the interpretation-layer mould. The
// per-item flags (collagen "incomplete", plant "pair it") render with the
// itemised breakdown card (build item 13); this is the day-level nudge.

export type ProteinSource = 'animal' | 'plant' | 'collagen';

// Incomplete sources per Part Eight: collagen and plant. Animal is complete.
const INCOMPLETE_SOURCES: ProteinSource[] = ['plant', 'collagen'];
// A day reads as mostly-incomplete when MORE than half its protein comes from
// incomplete sources.
const INCOMPLETE_DAY_THRESHOLD = 0.5;
// Small buffer on the target, since plant protein is absorbed a little less
// efficiently (Part Eight's "100-105g rather than 95g").
const PROTEIN_BUFFER_FACTOR = 1.1;
// Below this there's too little protein logged so far to say anything meaningful.
const MIN_DAY_PROTEIN_G = 20;

export type ProteinQualityNudge = {
  incompleteShare: number; // 0-1, share of the day's protein from incomplete sources
  bufferedTarget: number | null; // rounded buffered target, when a base target is known
  message: string;
};

// Given a day's protein grouped by source (grams; a null source is protein whose
// source wasn't classified and counts only toward the total), decide whether the
// day-level nudge fires. Returns null when there's nothing to say — enough
// complete protein, or too little logged.
export function dayLevelProteinNudge(
  proteinBySource: { source: ProteinSource | null; grams: number }[],
  baseTargetG: number | null
): ProteinQualityNudge | null {
  const pos = (g: number) => (g > 0 ? g : 0);
  const total = proteinBySource.reduce((s, r) => s + pos(r.grams), 0);
  if (total < MIN_DAY_PROTEIN_G) return null;

  const incomplete = proteinBySource
    .filter((r) => r.source != null && INCOMPLETE_SOURCES.includes(r.source))
    .reduce((s, r) => s + pos(r.grams), 0);
  const incompleteShare = incomplete / total;
  if (incompleteShare <= INCOMPLETE_DAY_THRESHOLD) return null;

  const bufferedTarget =
    baseTargetG != null && baseTargetG > 0 ? Math.round(baseTargetG * PROTEIN_BUFFER_FACTOR) : null;
  const targetClause =
    bufferedTarget != null
      ? ` Plant protein is absorbed a little less efficiently, so nudging your target up a touch today — around ${bufferedTarget}g rather than ${Math.round(baseTargetG!)}g — covers the difference.`
      : '';
  const message =
    `Most of today's protein so far is from incomplete sources (collagen or plant). Pairing a complementary source — a grain alongside the legumes, or a little dairy — rounds out the amino acids.${targetClause}`;

  return { incompleteShare, bufferedTarget, message };
}
