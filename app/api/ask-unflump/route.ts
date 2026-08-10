import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, conversationHistory } = await request.json();
  console.log('CHAT REQUEST RECEIVED:', message);

  await supabase.from('chat_messages').insert({ user_id: user.id, role: 'user', content: message });

  const { data: contextRows } = await supabase
    .from('user_context')
    .select('*')
    .order('category', { ascending: true });

  const contextText = contextRows && contextRows.length > 0
    ? contextRows.map((c) => c.category + ': ' + c.content).join('\n')
    : 'No stored context yet.';

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentFood } = await supabase
    .from('food_logs')
    .select('*')
    .gte('happened_at', sevenDaysAgo.toISOString())
    .order('happened_at', { ascending: false });

  const { data: recentActivity } = await supabase
    .from('activity_logs')
    .select('*')
    .gte('happened_at', sevenDaysAgo.toISOString())
    .order('happened_at', { ascending: false });

  const { data: recentMeasurements } = await supabase
    .from('body_measurements')
    .select('*')
    .gte('measured_at', sevenDaysAgo.toISOString())
    .order('measured_at', { ascending: false });

  const foodSummary = recentFood && recentFood.length > 0
    ? recentFood.map((f) => f.happened_at.slice(0, 10) + ': ' + f.raw_text + ' (' + f.kcal + 'kcal, ' + f.protein_g + 'g protein)').join('\n')
    : 'No food logged in the last 7 days.';

  const activitySummary = recentActivity && recentActivity.length > 0
    ? recentActivity.map((a) => a.happened_at.slice(0, 10) + ': ' + a.activity_type + ' (' + a.duration_min + ' min, ' + a.kcal_burned + ' kcal)').join('\n')
    : 'No activity logged in the last 7 days.';

  const measurementSummary = recentMeasurements && recentMeasurements.length > 0
    ? recentMeasurements.map((m) => m.measured_at.slice(0, 10) + ': weight ' + m.weight_kg + 'kg, body fat ' + m.body_fat_pct + '%').join('\n')
    : 'No body measurements in the last 7 days.';

  const systemContext = 'You are a calm, grounded companion inside a food/fitness tracking app called Unflump. You are NOT a coach, a cheerleader, or a report generator. Your tone is steady and validating, not peppy or upbeat - closer to a thoughtful friend who listens carefully than someone hyping the person up. Avoid exclamation marks, emojis, and enthusiastic language ("Ouch!", "amazing!", "love that"). Speak plainly and warmly instead. Never use bullet points, headers, or long structured breakdowns unless specifically asked for a list. One or two short paragraphs is usually enough. When relevant, naturally reference their recent logged activity or data and ask if anything needs adjusting - that instinct is good, just deliver it calmly rather than energetically.\n\nHere is what you know about this person (their stored context, facts, goals, diagnoses, preferences):\n' + contextText + '\n\nHere is their food log from the last 7 days:\n' + foodSummary + '\n\nHere is their activity log from the last 7 days:\n' + activitySummary + '\n\nHere are their body measurements from the last 7 days:\n' + measurementSummary + '\n\nUse this information naturally in your replies, the way a friend who already knows your situation would - dont just recite it back. If in the course of the conversation the person shares something worth remembering long-term (a new goal, a diagnosis, a preference, a frustration), mention at the END of your reply, on its own new line, exactly in this format: [REMEMBER: category | content] - for example [REMEMBER: diagnosis | PCOS diagnosed July 2026] - only do this for genuinely durable facts, not passing comments, and only once per new fact.';

  const messages = [
    ...(conversationHistory || []),
    { role: 'user', content: message },
  ];

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemContext,
      messages: messages,
    });
  } catch (err: any) {
    console.log('ANTHROPIC API ERROR:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const replyText = response.content[0].type === 'text' ? response.content[0].text : '';

  const rememberMatch = replyText.match(/\[REMEMBER: (.+?) \| (.+?)\]/);
  let cleanReply = replyText;
  let savedContext = null;

  if (rememberMatch) {
    const category = rememberMatch[1].trim();
    const content = rememberMatch[2].trim();
    cleanReply = replyText.replace(rememberMatch[0], '').trim();

    const { data: existingCategory } = await supabase
      .from('user_context')
      .select('*')
      .eq('category', category)
      .limit(1);

    if (existingCategory && existingCategory.length > 0) {
      await supabase.from('user_context').insert({ user_id: user.id, category, content });
      savedContext = { category, content, autoSaved: true };
    } else {
      savedContext = { category, content, autoSaved: false };
    }
  }

  await supabase
    .from('chat_messages')
    .insert({ user_id: user.id, role: 'assistant', content: cleanReply });

  return NextResponse.json({
    reply: cleanReply,
    savedContext: savedContext,
  });
}