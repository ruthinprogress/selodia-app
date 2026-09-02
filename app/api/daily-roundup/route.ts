import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { getSupabaseForRequest } from '../../lib/supabase';
import { eveningAction, type DayLogState } from '../../lib/roundup-rules';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

// The Daily Roundup (Part Nine).
//
// "A psychological anchor, not just a data summary" - it exists to intervene at
// the moment restriction risk is highest, which is why it interprets the day
// WITH its context woven in rather than reporting numbers at it. "Over target"
// alone is the sentence this feature exists to avoid.
//
// WHAT IS DETERMINISTIC HERE, and what is not: whether a roundup fires at all
// is code (roundup-rules.ts), because that decision must not drift. The day's
// context extraction and its interpretation are the model's, because they are
// language over a day of conversation - the thing it is genuinely for.
//
// It is stored, not transient: the next morning reads it back when a body
// measurement arrives, and the weekly roundup builds on a week of these rather
// than reprocessing raw chat.

export async function POST(req: NextRequest) {
  const supabase = getSupabaseForRequest(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const iso = startOfDay.toISOString();
  const dateKey = new Date(startOfDay.getTime() - startOfDay.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  const [
    { data: food },
    { data: activity },
    { data: measurements },
    { data: turns },
    { data: context },
  ] = await Promise.all([
    supabase.from('food_logs').select('raw_text, kcal, protein_g').gte('happened_at', iso),
    supabase.from('activity_logs').select('activity_type, duration_min, intensity').gte('happened_at', iso),
    supabase.from('body_measurements').select('weight_kg, body_fat_pct, muscle_kg').gte('measured_at', iso),
    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('source', 'chat')
      .gte('created_at', iso)
      .order('created_at', { ascending: true }),
    supabase.from('user_context').select('category, content'),
  ]);

  const foodRows = food ?? [];
  const state: DayLogState = {
    hasFood: foodRows.length > 0,
    hasAnything:
      foodRows.length > 0 ||
      (activity ?? []).length > 0 ||
      (measurements ?? []).length > 0 ||
      (turns ?? []).length > 0,
  };

  const action = eveningAction(state);
  // A day with nothing in it gets nothing. Forcing a roundup over an empty day
  // would be hollow, and hollow is worse than quiet.
  if (action !== 'offer_roundup') {
    return NextResponse.json({ action, roundup: null });
  }

  const kcal = foodRows.reduce((s, f) => s + (f.kcal ?? 0), 0);
  const protein = foodRows.reduce((s, f) => s + (f.protein_g ?? 0), 0);

  const dayText = [
    `Food logged: ${foodRows.map((f) => f.raw_text).filter(Boolean).join('; ') || 'none'}`,
    `Totals: ${Math.round(kcal)} kcal, ${Math.round(protein)}g protein`,
    `Activity: ${(activity ?? []).map((a) => `${a.activity_type ?? 'activity'}${a.duration_min ? ` ${Math.round(a.duration_min)}min` : ''}${a.intensity ? ` (${a.intensity})` : ''}`).join('; ') || 'none logged'}`,
    `What they said today:\n${(turns ?? []).map((t) => `${t.role}: ${t.content}`).join('\n') || '(nothing)'}`,
    `Standing context:\n${(context ?? []).map((c) => `${c.category}: ${c.content}`).join('\n') || '(none)'}`,
  ].join('\n\n');

  const system = `You are Selodía, closing out someone's day with them. Steady and validating, never peppy - no exclamation marks, no emojis, no "amazing". One or two short paragraphs, no bullet points, no headers.

This is NOT a data report. The numbers are already in the app and they can see them. Your job is to interpret the day WITH its context woven in - "over target, and here's why that's fine given what today actually was" - never a bare "over target". If something in what they said today explains the day's shape (a stressful trip, a birthday dinner, a bad night's sleep, eating out), that is the point of the whole message.

Never moralise a food. Never use "bad", "good", "cheat", "guilty", "junk" or "clean" about anything they ate. Never praise them for restriction and never suggest compensating tomorrow for today.

Also return, separately from the reply:
- context: one or two plain sentences recording what today actually WAS, for your own reference later. Facts and circumstances, not interpretation.
- mediatingFactor: the single thing from today that would explain a higher reading on the scale tomorrow - a salty meal out, a hard session, a late dinner, alcohol - or leave it empty if there genuinely isn't one. Be strict: most days have none.

Close with genuinely open phrasing, never a directive.`;

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: dayText }],
      tools: [
        {
          name: 'daily_roundup',
          description: "The day's roundup, plus what to remember about the day.",
          input_schema: {
            type: 'object',
            properties: {
              reply: { type: 'string', description: 'What you say, in your own voice.' },
              context: { type: 'string', description: "One or two plain sentences on what today was." },
              mediatingFactor: {
                type: 'string',
                description:
                  'The one thing that would explain a higher reading tomorrow, or empty when there is none. Most days have none.',
              },
            },
            required: ['reply', 'context'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'daily_roundup' },
    });
  } catch (err) {
    console.log('DAILY ROUNDUP MODEL ERROR:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No roundup returned' }, { status: 500 });
  }
  const result = toolUse.input as { reply: string; context: string; mediatingFactor?: string };
  const mediating = result.mediatingFactor?.trim() || null;

  // Upserted on (user_id, summary_date): a day is closed out once, and
  // re-running corrects that day rather than stacking duplicates.
  const { error: saveError } = await supabase.from('daily_summaries').upsert(
    {
      user_id: user.id,
      summary_date: dateKey,
      context: result.context,
      interpretation: result.reply,
      mediating_factor: mediating,
    },
    { onConflict: 'user_id,summary_date' }
  );
  if (saveError) console.log('DAILY SUMMARY SAVE FAILED:', saveError.message);

  // Persisted into the thread like any other turn, so it is there tomorrow and
  // the model can see what it already said.
  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: result.reply,
    source: 'chat',
  });

  return NextResponse.json({ action, roundup: result.reply });
}
