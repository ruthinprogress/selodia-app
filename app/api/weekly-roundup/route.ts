import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

import { saveAlmanacEntry } from '../../lib/almanac';
import {
  canStateTrajectory,
  MIN_READINGS_FOR_TRAJECTORY,
  weeklyGate,
  WEEKLY_MIN_FULL_DAYS,
} from '../../lib/roundup-rules';
import {
  coerceStatements,
  isValidWeekEnding,
  PORTRAIT_RANGE_LABEL,
  PORTRAIT_WEEKS,
  roundupContent,
  roundupTitle,
  weekDatesEnding,
  weekEndingFor,
  weekEndingMinus,
} from '../../lib/roundup-week';
import { getSupabaseForRequest } from '../../lib/supabase';
import {
  averageOverLoggedDays,
  toDayStates,
  trajectoryPermission,
  weekDelta,
  WEEK_DAYS,
  type DayRow,
  type Reading,
} from '../../lib/weekly-roundup';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

// The Weekly Roundup (Part Nine, rebuilt for Insights slice 3 on 2026-09-16).
//
// WHAT CHANGED AND WHY. The first version read a week of stored DAILY summaries,
// because each weekly roundup was built out of seven daily ones. Ruth dropped the
// daily roundup on 2026-09-12 - Sunday evening only - so `daily_summaries` is
// never written and this reads the week directly instead: the food, the
// movement, the measurements, and what she said about the week in her own words.
//
// IT NOW HAS TWO JOBS, not one.
//   1. The roundup itself: an Almanac entry tagged Roundup, permanent, and the
//      same text posted into the chat thread (Ruth, 2026-09-16: both).
//   2. The living portrait: 2-3 witness statements covering the last six weeks,
//      stored ON the entry so they can never drift from the week that produced
//      them, and read by the top of the Insights tab.
//
// WHETHER A ROUNDUP FIRES AND WHAT THE NUMBERS MAY CLAIM IS STILL CODE. The gate
// of 5 full days out of 7, missing days excluded rather than zeroed, a direction
// only on three readings or more: all unchanged, all in roundup-rules.ts and
// weekly-roundup.ts, and none of it delegated to the model. The language over a
// week of someone's life is the model's, because that is what it is for.
//
// THE PHONE NAMES THE WEEK, because "Sunday evening" is local and this function
// runs in UTC. It is validated here rather than trusted: a week that has not
// finished is refused.
//
// ONE ROUNDUP PER WEEK. The entry carries its week, so a second call for the same
// week returns the one already written rather than paying for it twice - which
// matters because the phone calls this on launch.

export const maxDuration = 60;

// How much of the week's conversation is handed over as context. The daily
// summaries used to do this job. Her own words are better material anyway; the
// cap is there so a heavy week cannot blow the context window.
const MAX_CHAT_LINES = 120;
const MAX_CHAT_CHARS = 300;

// The question a thin week gets instead of a roundup. A constant because it is
// also how the route recognises that this week has already been asked.
const ASK_HOW_ITS_GOING =
  'How have you been finding the logging this week? No wrong answer. I just want to know how it has actually felt.';

type RoundupRow = { id: string; content: unknown; created_at: string };

function statementsOf(row: RoundupRow): string[] {
  const c = row.content;
  if (c == null || typeof c !== 'object' || Array.isArray(c)) return [];
  return coerceStatements((c as Record<string, unknown>).__statements);
}

function themeOf(row: RoundupRow): string | null {
  const c = row.content;
  if (c == null || typeof c !== 'object' || Array.isArray(c)) return null;
  const t = (c as Record<string, unknown>).__theme;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseForRequest(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // A call with no body is fine: the server falls back to its own clock.
  }

  const now = new Date();
  const weekEnding = isValidWeekEnding(body.weekEnding, now)
    ? (body.weekEnding as string)
    : weekEndingFor(now);

  const dates = weekDatesEnding(weekEnding);
  const windowStart = `${dates[0]}T00:00:00.000Z`;
  // Exclusive end: the Sunday's own entries belong to the week.
  const windowEnd = `${weekEnding}T23:59:59.999Z`;

  // ALREADY DONE? The phone asks on every launch, so this is the common path,
  // and it must cost one cheap query rather than a model call.
  const { data: existing } = await supabase
    .from('almanac_entries')
    .select('id, content, created_at')
    .eq('kind', 'roundup')
    .eq('content->>__weekEnding', weekEnding)
    .limit(1);
  if (existing && existing.length > 0) {
    const row = existing[0] as RoundupRow;
    return NextResponse.json({
      action: 'already_done',
      weekEnding,
      entryId: row.id,
      statements: statementsOf(row),
    });
  }

  const portraitFrom = weekEndingMinus(weekEnding, PORTRAIT_WEEKS);

  const [
    { data: food },
    { data: activity },
    { data: measurements },
    { data: noticed },
    { data: priorRoundups },
    { data: chat },
    { data: context },
  ] = await Promise.all([
    supabase
      .from('food_logs')
      .select('happened_at, kcal, protein_g')
      .gte('happened_at', windowStart)
      .lte('happened_at', windowEnd),
    supabase
      .from('activity_logs')
      .select('happened_at, activity_type, duration_min, intensity')
      .gte('happened_at', windowStart)
      .lte('happened_at', windowEnd)
      .order('happened_at', { ascending: true }),
    supabase
      .from('body_measurements')
      .select('measured_at, weight_kg')
      .gte('measured_at', windowStart)
      .lte('measured_at', windowEnd)
      .order('measured_at', { ascending: true }),
    // This week's symptoms, notes and insights: what the app already noticed and
    // she already agreed to keep. The roundup should not rediscover them.
    supabase
      .from('almanac_entries')
      .select('kind, title, content, created_at')
      .in('kind', ['symptom', 'note', 'insight'])
      .eq('status', 'active')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: true }),
    // The last six weeks of roundups, for continuity in the portrait: the
    // statements describe six weeks, not one, so the previous ones are context.
    supabase
      .from('almanac_entries')
      .select('id, content, created_at')
      .eq('kind', 'roundup')
      .gte('content->>__weekEnding', portraitFrom)
      .order('created_at', { ascending: true }),
    supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: true })
      .limit(MAX_CHAT_LINES),
    supabase.from('user_context').select('category, content'),
  ]);

  // Bucket the week's food by calendar day. A day is "full" on food alone, per
  // the spec's definition - measurements and activity are not naturally daily,
  // and holding them to that standard would mark ordinary days as failures.
  const byDate = new Map<string, { kcal: number; protein: number; count: number }>();
  for (const f of food ?? []) {
    const d = String(f.happened_at ?? '').slice(0, 10);
    if (!d) continue;
    const cur = byDate.get(d) ?? { kcal: 0, protein: 0, count: 0 };
    cur.kcal += f.kcal ?? 0;
    cur.protein += f.protein_g ?? 0;
    cur.count += 1;
    byDate.set(d, cur);
  }

  const days: DayRow[] = dates.map((date) => {
    const d = byDate.get(date);
    return {
      date,
      kcal: d ? d.kcal : null,
      proteinG: d ? d.protein : null,
      hasFood: (d?.count ?? 0) > 0,
    };
  });

  const gate = weeklyGate(toDayStates(days));

  // A WEEK WITH NOTHING IN IT GETS NOTHING, SILENTLY. Part Nine says exactly
  // this about an empty day, and the same reasoning holds for a week: there is
  // nothing to witness. It also protects the person this would be worst for -
  // somebody who installed the app on Friday and opens it on Sunday evening,
  // who would otherwise be asked how their logging went before they had any.
  const emptyWeek =
    (food ?? []).length === 0 &&
    (activity ?? []).length === 0 &&
    (measurements ?? []).length === 0 &&
    (noticed ?? []).length === 0 &&
    (chat ?? []).length === 0;
  if (emptyWeek) {
    return NextResponse.json({ action: 'silent', weekEnding, fullDays: gate.fullDays });
  }

  // BELOW THE THRESHOLD there is no attempt at a roundup, and no entry: an
  // Almanac record of a week nobody logged would be a permanent note about a
  // gap. The spec asks instead how logging has been going - and the branch on
  // THAT answer (ordinary friction versus something more concerning) belongs to
  // the safety classifier in ask-selodia, not here. This only asks the question.
  if (gate.kind === 'ask_how_its_going') {
    // ASKED ONCE PER WEEK, not once per launch. A full roundup is its own record
    // that the week is done; a thin week writes no entry, so without this the
    // phone's launch check would ask the same question every time the app
    // opened until Sunday came round again.
    const { data: alreadyAsked } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('role', 'assistant')
      .eq('content', ASK_HOW_ITS_GOING)
      .gte('created_at', windowStart)
      .limit(1);
    if (alreadyAsked && alreadyAsked.length > 0) {
      return NextResponse.json({ action: 'already_asked', weekEnding, fullDays: gate.fullDays });
    }

    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: ASK_HOW_ITS_GOING,
      source: 'chat',
    });
    return NextResponse.json({
      action: 'ask_how_its_going',
      weekEnding,
      fullDays: gate.fullDays,
      roundup: ASK_HOW_ITS_GOING,
    });
  }

  const avgKcal = averageOverLoggedDays(days, (d) => d.kcal);
  const avgProtein = averageOverLoggedDays(days, (d) => d.proteinG);

  const readings: Reading[] = (measurements ?? [])
    .map((m) => ({ date: String(m.measured_at ?? '').slice(0, 10), value: Number(m.weight_kg) }))
    .filter((r) => r.date && Number.isFinite(r.value));
  const delta = weekDelta(readings);
  const trajectory = trajectoryPermission(
    delta,
    gate.fullDays,
    MIN_READINGS_FOR_TRAJECTORY,
    WEEKLY_MIN_FULL_DAYS
  );

  // Belt and braces: the permission above is derived independently of
  // canStateTrajectory, so this asserts the two agree rather than trusting that
  // they will stay in step if either is edited later.
  const codeSaysMayState = canStateTrajectory(delta?.readingCount ?? 0, gate.fullDays);
  const mayStateTrajectory = trajectory.kind === 'may_state' && codeSaysMayState;

  const fig = (label: string, f: { value: number; confidence: string | null } | null, unit: string) =>
    f
      ? `${label}: ${f.value}${unit}${f.confidence ? ` (${f.confidence})` : ''}`
      : `${label}: not enough logged to say`;

  const movement =
    (activity ?? [])
      .map(
        (a) =>
          `${String(a.happened_at ?? '').slice(0, 10)}: ${a.activity_type ?? 'movement'}${
            a.duration_min ? `, ${a.duration_min} min` : ''
          }${a.intensity ? `, ${a.intensity}` : ''}`
      )
      .join('\n') || '(nothing logged)';

  const kept =
    (noticed ?? [])
      .map((n) => `${String(n.created_at ?? '').slice(0, 10)} [${n.kind}] ${n.title}`)
      .join('\n') || '(nothing kept this week)';

  const said =
    (chat ?? [])
      .filter((m) => m.role === 'user')
      .map((m) => `${String(m.created_at ?? '').slice(0, 10)}: ${String(m.content ?? '').slice(0, MAX_CHAT_CHARS)}`)
      .join('\n') || '(nothing said in chat this week)';

  const previous =
    (priorRoundups ?? [])
      .map((r) => {
        const row = r as RoundupRow;
        const theme = themeOf(row);
        const st = statementsOf(row);
        return `${String(row.created_at ?? '').slice(0, 10)}${theme ? ` theme: ${theme}` : ''}${
          st.length ? `\n  previously said: ${st.join(' | ')}` : ''
        }`;
      })
      .join('\n') || '(no earlier roundups - this is the first)';

  const weekText = [
    `Week of ${dates[0]} to ${dates[WEEK_DAYS - 1]}. ${gate.fullDays} of ${WEEK_DAYS} days had food logged.`,
    '',
    'GROUNDING DATA. Each figure already carries its own confidence note where one applies. Use those notes next to the number they belong to, never as a disclaimer at the top.',
    fig('Average daily calories across logged days', avgKcal, ' kcal'),
    fig('Average daily protein across logged days', avgProtein, 'g'),
    // THE COUNT, STATED. "Fewer than two readings" was read by the model as "one
    // reading" in two of six roundups on 2026-09-16, when there were none at
    // all. A number cannot be rounded into a claim about her week.
    delta
      ? `Weight: ${delta.first.value}kg on ${delta.first.date} to ${delta.last.value}kg on ${delta.last.date} (${delta.change >= 0 ? '+' : ''}${delta.change}kg across ${delta.readingCount} readings)`
      : `Weight: ${readings.length === 0 ? 'NO readings were logged at all this week' : 'exactly ONE reading was logged this week, which is a position rather than a change'}. Say that plainly if you mention it, and never state or imply a different number.`,
    '',
    mayStateTrajectory
      ? 'TRAJECTORY: you may describe a direction this week. Stay tentative - it is one week.'
      : `TRAJECTORY: you may NOT state a direction. Say so plainly and briefly - ${
          trajectory.kind === 'say_not_enough_data' ? trajectory.reason : 'the data does not support one'
        }. Do not omit the subject and do not hedge into a direction anyway.`,
    '',
    `MOVEMENT THIS WEEK:\n${movement}`,
    '',
    `WHAT SHE AGREED TO KEEP THIS WEEK (already in her Almanac):\n${kept}`,
    '',
    `WHAT SHE SAID THIS WEEK, in her own words:\n${said}`,
    '',
    `STANDING CONTEXT:\n${(context ?? []).map((c) => `${c.category}: ${c.content}`).join('\n') || '(none)'}`,
    '',
    `EARLIER ROUNDUPS IN ${PORTRAIT_RANGE_LABEL.toUpperCase()}:\n${previous}`,
  ].join('\n');

  const system = `You are Selodía, closing out someone's week with them. Steady and validating, never peppy - no exclamation marks, no emojis, no cheerleading.

This is NOT a data report. They can already see the numbers. Your job is to interpret the week WITH its context woven in, drawing on what they actually said and did.

ORDER for the roundup, and keep to it:
1. A brief warm opening.
2. The grounding data - the week's totals and any movement. Put each confidence note NEXT TO the number it belongs to, never as a blanket disclaimer.
3. Interpretation, woven in - what the week's own record says about why it went as it did.
4. One thematic observation drawn across the week, not a restatement of a single day.
5. Trajectory - obey the TRAJECTORY instruction above exactly. If you may not state one, say so briefly and honestly rather than skipping it.
6. A closing checkpoint in genuinely open phrasing, never a directive.

EVERY WORD OF THIS IS SAID TO HER, NEVER ABOUT HER. Address her directly, as "you". Never write in the third person - not "she logged", not "her knee", not "she asked twice this week". On 2026-09-16 a statement came out as "She's asked twice this week why a protein target isn't showing", which reads as a case note written by somebody else about a patient. This is her own week, handed back to her.

THE WITNESS STATEMENTS are a different thing from the roundup, and the rules are stricter. Two or three short lines for the top of her Almanac, covering ${PORTRAIT_RANGE_LABEL} rather than this week alone, drawing on the earlier roundups above as well as this one. They witness, they do not grade: "You've moved your body four times a week for six weeks", "Your energy and your sleep track together more than anything else". Never congratulate, never score, never compare her to a target, never use "good", "well done", "on track" or "behind". Each must be true of what is actually recorded above - if six weeks of evidence does not exist yet, write one or two statements about what does, or none at all. Never invent a number, a streak or a pattern to fill the space.

Never moralise a food. Never use "bad", "good", "cheat", "guilty", "junk" or "clean" about anything they ate. Never praise restriction, and never frame a lower number as better. A missing day is not a failure and is never described as one.

Do not invent numbers. If a figure above says there is not enough logged to say, say that instead of estimating.`;

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: weekText }],
      tools: [
        {
          name: 'weekly_roundup',
          description: "The week's roundup, in your voice, and the witness statements for her Almanac.",
          input_schema: {
            type: 'object',
            properties: {
              reply: { type: 'string', description: 'The roundup itself, in your own voice.' },
              theme: {
                type: 'string',
                description:
                  'The single thematic observation drawn across the week, in a few words, for tracking themes over time.',
              },
              statements: {
                type: 'array',
                items: { type: 'string' },
                description: `Two or three witness statements covering ${PORTRAIT_RANGE_LABEL}. Observational, never congratulatory. Fewer is correct when the evidence is thin; never invent one.`,
              },
            },
            required: ['reply', 'statements'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'weekly_roundup' },
    });
  } catch (err) {
    console.log('WEEKLY ROUNDUP MODEL ERROR:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No roundup returned' }, { status: 500 });
  }
  const result = toolUse.input as { reply?: unknown; theme?: unknown; statements?: unknown };
  const reply = typeof result.reply === 'string' ? result.reply.trim() : '';
  if (!reply) {
    return NextResponse.json({ error: 'No roundup returned' }, { status: 500 });
  }
  const statements = coerceStatements(result.statements);

  // The entry first, the chat message second. If the write fails, the roundup is
  // still said - it is a reflection, not a receipt - but nothing claims it was
  // kept, and the response says plainly that it was not (the storage-honesty
  // rule).
  const entry = await saveAlmanacEntry(supabase, user.id, {
    kind: 'roundup',
    title: roundupTitle(weekEnding),
    content: roundupContent({
      reply,
      weekEnding,
      theme: typeof result.theme === 'string' ? result.theme : null,
      statements,
    }),
  });

  // LOST THE RACE, AND THAT IS FINE. The check at the top of this route cannot
  // be atomic, and on 2026-09-16 six simultaneous asks all passed it and wrote
  // six roundups. A unique index now refuses the second write, so a failed save
  // here might mean the week already has its roundup - in which case this turn
  // says nothing and posts nothing, rather than putting a second copy of the
  // week into her chat.
  if (!entry) {
    const { data: raced } = await supabase
      .from('almanac_entries')
      .select('id, content, created_at')
      .eq('kind', 'roundup')
      .eq('content->>__weekEnding', weekEnding)
      .limit(1);
    if (raced && raced.length > 0) {
      const row = raced[0] as RoundupRow;
      console.log('WEEKLY ROUNDUP: another request wrote this week first', weekEnding);
      return NextResponse.json({
        action: 'already_done',
        weekEnding,
        entryId: row.id,
        statements: statementsOf(row),
      });
    }
    console.log('WEEKLY ROUNDUP: the Almanac entry did not save for week', weekEnding);
  }

  // Persisted into the thread like any other turn, so it is there next week and
  // the model can see what it already said (Ruth, 2026-09-16: Almanac and chat).
  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: reply,
    source: 'chat',
  });

  return NextResponse.json({
    action: 'full_roundup',
    weekEnding,
    fullDays: gate.fullDays,
    roundup: reply,
    theme: typeof result.theme === 'string' ? result.theme.trim() || null : null,
    statements,
    entryId: entry?.id ?? null,
    saved: entry !== null,
  });
}
