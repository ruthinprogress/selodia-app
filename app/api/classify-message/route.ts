import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Routine, high-volume classification - stays on the fast/cost-efficient
// model used by the other parse-* routes, unlike onboarding-chat's
// safety-critical classification which uses a stronger model.
const MODEL = 'claude-haiku-4-5-20251001';
const CLASSIFY_TOOL_NAME = 'classify_intent';

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message } = await request.json();

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 100,
      system:
        'Classify what the person is telling Unflump, a food/fitness tracking companion app. "food" if they are describing something they ate or drank. "activity" if they are describing physical activity or exercise they did. "question" for anything else - a question, a comment, checking in, or general conversation.',
      messages: [{ role: 'user', content: message }],
      tools: [
        {
          name: CLASSIFY_TOOL_NAME,
          description: 'Classify the intent of the message',
          input_schema: {
            type: 'object',
            properties: {
              intent: { type: 'string', enum: ['food', 'activity', 'question'] },
            },
            required: ['intent'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
    });
  } catch (err) {
    console.log('CLASSIFY ERROR:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'Model did not return a classification' }, { status: 500 });
  }

  const { intent } = toolUse.input as { intent: 'food' | 'activity' | 'question' };
  return NextResponse.json({ intent });
}
