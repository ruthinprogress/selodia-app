import { supabase } from '@/lib/supabase';

// The first-time Chat landing chips (Part Five, Chat).
//
// WHAT THEY ARE FOR. Someone arriving from onboarding has just spent a long
// conversation being asked things, and then lands on an empty thread with a
// blank field and no idea what this one is for. The chips replace that cold
// start with four openers they can tap. They are an invitation, not a menu:
// there is no "other", nothing is required, and typing anything at all is
// equally valid and dismisses them.
//
// WHY THESE FOUR, AND IN THIS ORDER. Three name the things the app actually does
// - body, food, movement - and the fourth gives permission to ask what the app
// is for rather than perform competence at it. That one goes last on purpose:
// leading with it would frame the app as a thing to be learned before it can be
// used, when in fact it is a conversation someone can simply start.
//
// The fourth was "How does this work?" until 2026-09-04. "What can I log here?"
// asks the same thing more concretely, and it is the question people actually
// have on a first screen: not how does the machine work, but what am I allowed
// to say to it. ask-unflump carries a matching instruction so the answer names
// everything rather than only the thing the model happens to think of.
//
// THEY ARE SENT AS THE PERSON'S OWN WORDS, not as a command or a mode switch.
// Tapping "Log what I've eaten" posts exactly that sentence into the thread and
// Selodia answers it like any other opening line. Nothing about the chip path is
// special downstream, which is why there is no chip-specific branch anywhere in
// ask-unflump: a tap is a shortcut past typing, not a different kind of message.
export const CHAT_CHIPS = [
  'My body goals',
  "Log what I've eaten",
  'My activity and workouts',
  'What can I log here?',
] as const;

// SHOWN-ONCE, ON THE ACCOUNT. Mirrors hasSeenAlmanacIntro/markAlmanacIntroSeen
// exactly, down to the failure direction — see almanac-intro.ts, and the
// migration, for why this is a column rather than an AsyncStorage key.
//
// Both reads and writes fail SOFT and in the same direction: on any error,
// behave as though the chips have already been used. A first-run on-ramp
// appearing on someone's hundredth visit is a worse wrong answer than one that
// never appears, and neither deserves an error state on a screen someone has
// just opened.
export async function hasSeenChatChips(): Promise<boolean> {
  try {
    // RLS scopes user_profile to the signed-in user, so no explicit filter.
    const { data, error } = await supabase
      .from('user_profile')
      .select('chat_chips_seen_at')
      .maybeSingle();
    if (error) return true;
    return data?.chat_chips_seen_at != null;
  } catch {
    return true;
  }
}

// Best-effort. If the stamp fails the chips appear once more next time, which is
// a far better outcome than an error surfacing on the first tap someone makes.
export async function markChatChipsSeen(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_profile')
      .upsert({ user_id: user.id, chat_chips_seen_at: new Date().toISOString() });
  } catch {
    // Intentionally swallowed — see above.
  }
}
