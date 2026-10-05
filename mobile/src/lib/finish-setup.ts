import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { supabase } from '@/lib/supabase';
import { WELCOME_MESSAGE } from '@/lib/welcome';

// WHAT FINISH DOES, IN ONE PLACE (Ruth, 5 October 2026).
//
// The last question's button says Finish. Three things happen on that tap, and
// they happen here rather than in the screen so that the next screen to become
// the last one inherits them instead of forgetting one.
//
//   1. Setup is marked complete.
//   2. The welcome message is put in Chat, so it is already there when she taps
//      the tab rather than being generated when she does.
//   3. welcome_seen_at is stamped.
//
// THE MESSAGE IS WRITTEN BY THE APP AND NOT BY THE MODEL. Same rule as every
// other statement of fact in this project. A greeting composed on the first turn
// would be different every time, could say anything, and would arrive after a
// wait - when the whole point is that something is already waiting.
//
// AND IT IS WRITTEN ONCE. The stamp is the guard, checked before the write and
// at the write, because Ruth will walk this flow again tomorrow to see it: two
// identical welcomes in one thread is the app forgetting it had said hello.
//
// NOTHING HERE BLOCKS THE SEQUENCE. Every step reports rather than throws, and
// the caller navigates whatever happens. A welcome animation that does not play
// because a write failed would be the worst of both: she has finished setup, and
// the app looks broken at the one moment it is trying to feel finished.

export type FinishOutcome = {
  /** False when the step could not be advanced, which is the one that matters. */
  completed: boolean;
  /** True when this call is what put the greeting in Chat. */
  greeted: boolean;
};

export async function finishSetup(userId: string): Promise<FinishOutcome> {
  let completed = false;
  let greeted = false;

  try {
    await advanceOnboardingStep(supabase, userId, 'complete');
    completed = true;
  } catch (e) {
    console.log('FINISH: could not mark setup complete -', e);
  }

  // HAS SHE BEEN WELCOMED BEFORE? Read first, so a redo replays the sequence
  // without posting a second greeting into a thread that already has one.
  const { data, error } = await supabase
    .from('user_profile')
    .select('welcome_seen_at')
    .eq('user_id', userId)
    .maybeSingle();

  // A FAILED READ DOES NOT WRITE. Behaving as though she has been welcomed is
  // the safe direction: a missing greeting is a gap, a duplicate is the app
  // visibly losing track of itself.
  if (error) {
    console.log('FINISH: could not read welcome_seen_at -', error.message);
    return { completed, greeted };
  }

  const alreadyWelcomed = Boolean((data as { welcome_seen_at?: string | null } | null)?.welcome_seen_at);

  if (!alreadyWelcomed) {
    const { error: messageError } = await supabase.from('chat_messages').insert({
      user_id: userId,
      role: 'assistant',
      content: WELCOME_MESSAGE,
    });
    if (messageError) {
      console.log('FINISH: could not place the welcome message -', messageError.message);
    } else {
      greeted = true;
    }
  }

  // STAMPED EVEN WHEN THE MESSAGE FAILED, deliberately. The stamp means "she has
  // finished setup and been shown the welcome", which is true either way, and
  // retrying the greeting on her next Finish would post it into a conversation
  // that has moved on.
  const { error: stampError } = await supabase
    .from('user_profile')
    .update({ welcome_seen_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (stampError) console.log('FINISH: could not stamp welcome_seen_at -', stampError.message);

  return { completed, greeted };
}

/**
 * SHE HAS OPENED CHAT. Stamped once, and only once.
 *
 * WHAT READS IT: the seed on the Body Manual, which is the one-tap way into Chat
 * after the welcome and should stop appearing the moment it has been used. A
 * pointer to somewhere she has already been is clutter.
 */
export async function markChatOpened(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profile')
    .update({ chat_first_opened_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('chat_first_opened_at', null);
  if (error) console.log('CHAT OPENED: could not stamp it -', error.message);
}
