import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

import {
  canStateTrajectory,
  MIN_READINGS_FOR_TRAJECTORY,
  weeklyGate,
  WEEKLY_MIN_FULL_DAYS,
} from '../../lib/roundup-rules';
import { getSupabaseForRequest } from '../../lib/supabase';
import {
  averageOverLoggedDays,
  toDayStates,
  trajectoryPermission,
  weekDates,
  weekDelta,
  WEEK_DAYS,
  type DayRow,
  type Reading,
} from '../../lib/weekly-roundup';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

// The Weekly Roundup (Part Nine, build item 20).
//
// Mirrors the daily route's split, for the same reason: whether a roundup fires
// and what the numbers are allowed to claim is CODE, because those decisions
// must not drift between runs; the language over a week of someone's life is the
// model's, because that is the thing it is genuinely for.
//
// BUILT ON STORED DAILY SUMMARIES, not on raw chat. The daily route persists a
// context and interpretation per day precisely so this can read a week of them
// rather than reprocessing seven days of conversation - which would be slower,
// more expensive, and would re-derive interpretations that were already made
// with that day's context in front of them.
//
// DELIBERATELY NOT IN THIS ROUTE, and each for its own reason:
//   - "Then & Now" is build item 16, a separate unbuilt item whose siblings need
//     the discuss-card capture path. The spec mentions it in this section, but
//     folding it in here would quietly build half of a different item.
//   - Sunday chaining ("chained directly onto Sunday's Daily Roundup close-out")
//     needs the daily roundup to fire on a schedule, which needs push
//     notifications working on a device. Those are inert until the pending
//     native build, so this route is callable but the automatic trigger is not
//     yet provable end to end.
//   - Whoosh personalisation needs 2-3 observed events per person; nobody has
//     that history yet, so there is nothing to build against.
//   - The minimised weekly measurements table already exists, in the
//     Measurements segment, which is where the spec puts it.

export async function POST(req: NextRequest) {
  const supabase = getSupabaseForRequest(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dates = weekDates(new Date());
  const windowStart = new Date(`${dates[0]}T00:00:00.000Z`).toISOString();

  const [{ data: food }, { data: measurements }, { data: summaries }, { data: context }] =
    await Promise.all([
      supabase.from('food_logs').select('happened_at, kcal, protein_g').gte('happened_at', windowStart),
      supabase
        .from('body_measurements')
        .select('measured_at, weight_kg')
        .gte('measured_at', windowStart)
        .order('measured_at', { ascending: true }),
      supabase
        .from('daily_summaries')
        .select('summary_date, context, interpretation')
        .gte('summary_date', dates[0])
        .order('summary_date', { ascending: true }),
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

  // BELOW THE THRESHOLD there is no attempt at a roundup. The spec asks instead
  // how logging has been going - and the branch on THAT answer (ordinary
  // friction versus something more concerning) belongs to the safety classifier
  // in ask-unflump, not here. This only asks the question.
  if (gate.kind === 'ask_how_its_going') {
    const question =
      'How have you been finding the logging this week? No wrong answer — I just want to know how it has actually felt.';
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: question,
      source: 'chat',
    });
    return NextResponse.json({
      action: 'ask_how_its_going',
      fullDays: gate.fullDays,
      roundup: question,
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

  const weekText = [
    `Week of ${dates[0]} to ${dates[WEEK_DAYS - 1]}. ${gate.fullDays} of ${WEEK_DAYS} days had food logged.`,
    '',
    'GROUNDING DATA — each figure already carries its own confidence note where one applies. Use those notes next to the number they belong to, never as a disclaimer at the top.',
    fig('Average daily calories across logged days', avgKcal, ' kcal'),
    fig('Average daily protein across logged days', avgProtein, 'g'),
    delta
      ? `Weight: ${delta.first.value}kg on ${delta.first.date} to ${delta.last.value}kg on ${delta.last.date} (${delta.change >= 0 ? '+' : ''}${delta.change}kg across ${delta.readingCount} readings)`
      : 'Weight: fewer than two readings this week, so there is no movement to describe',
    '',
    mayStateTrajectory
      ? 'TRAJECTORY: you may describe a direction this week. Stay tentative - it is one week.'
      : `TRAJECTORY: you may NOT state a direction. Say so plainly and briefly - ${
          trajectory.kind === 'say_not_enough_data' ? trajectory.reason : 'the data does not support one'
        }. Do not omit the subject and do not hedge into a direction anyway.`,
    '',
    `THIS WEEK'S DAILY SUMMARIES (your own notes, in order):\n${
      (summaries ?? [])
        .map((s) => `${s.summary_date}: ${s.context ?? ''}${s.interpretation ? ` — ${s.interpretation}` : ''}`)
        .join('\n') || '(none stored)'
    }`,
    '',
    `STANDING CONTEXT:\n${(context ?? []).map((c) => `${c.category}: ${c.content}`).join('\n') || '(none)'}`,
  ].join('\n');

  const system = `You are Unflump, closing out someone's week with them. Steady and validating, never peppy - no exclamation marks, no emojis, no cheerleading.

This is NOT a data report. They can already see the numbers. Your job is to interpret the week WITH its context woven in, drawing on your own daily notes above.

ORDER, and keep to it:
1. A brief warm opening.
2. The grounding data - the week's totals and any movement. Put each confidence note NEXT TO the number it belongs to, never as a blanket disclaimer.
3. Interpretation, woven in - what the daily notes actually say about why the week went as it did.
4. One thematic observation drawn across the week, not a restatement of a single day.
5. Trajectory - obey the TRAJECTORY instruction above exactly. If you may not state one, say so briefly and honestly rather than skipping it.
6. A closing checkpoint in genuinely open phrasing, never a directive.

Never moralise a food. Never use "bad", "good", "cheat", "guilty", "junk" or "clean" about anything they ate. Never praise restriction, and never frame a lower number as better. A missing day is not a failure and is never described as one.

Do not invent numbers. If a figure above says there is not enough logged to say, say that instead of estimating.`;

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: weekText }],
      tools: [
        {
          name: 'weekly_roundup',
          description: "The week's roundup, in Unflump's voice.",
          input_schema: {
            type: 'object',
            properties: {
              reply: { type: 'string', description: 'What Unflump says, in its own voice.' },
              theme: {
                type: 'string',
                description:
                  'The single thematic observation drawn across the week, in a few words, for reference later.',
              },
            },
            required: ['reply'],
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
  const result = toolUse.input as { reply: string; theme?: string };

  // Persisted into the thread like any other turn, so it is there next week and
  // the model can see what it already said.
  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: result.reply,
    source: 'chat',
  });

  return NextResponse.json({
    action: 'full_roundup',
    fullDays: gate.fullDays,
    roundup: result.reply,
    theme: result.theme?.trim() || null,
  });
}
