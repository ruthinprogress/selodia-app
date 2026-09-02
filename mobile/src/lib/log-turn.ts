import { supabase } from '@/lib/supabase';

// Writing a photo-log's acknowledgment into the thread.
//
// THE BUG THIS FIXES IS OLDER THAN THE FEATURE THAT EXPOSED IT. Logging by photo
// has never written anything to `chat_messages`: `acknowledge-log` composes a
// message and returns it, the Chat screen puts it in local state, and it is gone
// on the next reload. So a week of photographed meals left a thread that looked
// like nothing had happened — and anything reading history back (the roundups,
// the model's own context window) never saw them either. Found 2026-09-01 while
// building the food and activity quick-log bars, which need exactly the same
// thing and would otherwise have copied the hole.
//
// AN ASSISTANT TURN WITH NO USER TURN, deliberately. There is no utterance to
// record: the person took a photo, they did not say anything. Inventing "Added a
// photo" as their words would be putting a sentence in their mouth to make the
// thread look tidy. An unprompted assistant turn is already an established shape
// here — the daily roundup writes one the same way — so the thread reads
// honestly: something happened, and Selodia said what it was.
//
// Best-effort, and silent on failure. The log itself succeeded long before this
// runs; a thread entry that fails to write must never present as a failed log.

export async function persistLogTurn(
  content: string,
  foodLogId?: string | null
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content,
      // 'chat' rather than a new source value: this belongs to the ordinary
      // thread and must be read back by everything that reads the thread. A
      // separate source would hide it from exactly the readers it exists for.
      source: 'chat',
      // Carries the itemised breakdown through a reload, the same way the text
      // path's turn does — without it, a photographed meal renders its table
      // once and never again.
      food_log_id: foodLogId ?? null,
    });
  } catch {
    // Intentionally swallowed — see above.
  }
}
