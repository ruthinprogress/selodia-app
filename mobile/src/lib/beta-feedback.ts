import * as FileSystem from 'expo-file-system';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { lastScreen } from '@/lib/last-screen';
import { supabase } from '@/lib/supabase';

// BETA FEEDBACK: sending one, and reading her own back.
//
// Ruth's item 6, a wave-one blocker. The design constraint that shapes everything
// here is hers: "Nothing is required to press Send beta feedback."
//
// So a submission with a single tapped feeling and no words is complete and
// valid. That is the whole point - the cheapest possible way to say "this
// annoyed me" at the moment it happened, from one tap away from wherever it
// happened. A form that asks for a description first is a form that collects
// nothing from somebody holding a toddler.

/** The feelings, in her order. `other` opens a free-text box. */
export const FEELINGS = [
  { id: 'angry', label: 'Angry' },
  { id: 'upset', label: 'Upset' },
  { id: 'bored', label: 'Bored' },
  { id: 'triggered', label: 'Triggered' },
  { id: 'lost_confidence', label: 'Lost confidence' },
  { id: 'confused', label: 'Confused' },
  { id: 'pleased', label: 'Pleased' },
  { id: 'surprised', label: 'Surprised' },
  { id: 'other', label: 'Something else' },
] as const;

export type FeelingId = (typeof FEELINGS)[number]['id'];

export type BetaFeedbackRow = {
  id: string;
  created_at: string;
  message: string | null;
  screenshot_path: string | null;
  feelings: string[];
  feeling_other: string | null;
  question: string | null;
  status: 'sent' | 'read' | 'fixed';
};

/** What the tester is told each status means. Three words, not a triage vocabulary. */
export const STATUS_LABEL: Record<BetaFeedbackRow['status'], string> = {
  sent: 'Sent',
  read: 'Read',
  fixed: 'Fixed',
};

/**
 * Upload a screenshot to the private bucket, returning its path.
 *
 * UNDER HER OWN USER ID, because the storage policy requires it: the bucket's
 * rules check the first path segment against auth.uid() rather than trusting the
 * client to choose somewhere sensible. A screenshot of this app is a picture of
 * somebody's own health record, so the bucket is private and nothing here ever
 * produces a public URL.
 */
async function uploadScreenshot(userId: string, uri: string): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${userId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('beta-feedback')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      console.log('BETA FEEDBACK SCREENSHOT UPLOAD FAILED:', error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.log('BETA FEEDBACK SCREENSHOT READ FAILED:', err instanceof Error ? err.message : err);
    return null;
  }
}

export type SendResult =
  | { ok: true; screenshotLost: boolean }
  | { ok: false; reason: string };

/**
 * Send one piece of feedback.
 *
 * A FAILED SCREENSHOT DOES NOT FAIL THE SUBMISSION. What she typed and tapped is
 * the part that matters, and losing it because an image upload timed out would
 * be the worst possible trade. The caller is told the picture did not make it, so
 * it can say so rather than pretending.
 */
export async function sendBetaFeedback(input: {
  message?: string;
  feelings: FeelingId[];
  feelingOther?: string;
  screenshotUri?: string | null;
  /** Set when the app asked something, so the answer is never read out of context. */
  question?: string | null;
}): Promise<SendResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, reason: 'not signed in' };

  let screenshotPath: string | null = null;
  let screenshotLost = false;
  if (input.screenshotUri) {
    screenshotPath = await uploadScreenshot(userId, input.screenshotUri);
    screenshotLost = screenshotPath === null;
  }

  const { updateId, runtimeVersion, isEmbeddedLaunch } = Updates;

  const { error } = await supabase.from('beta_feedback').insert({
    user_id: userId,
    message: input.message?.trim() || null,
    screenshot_path: screenshotPath,
    feelings: input.feelings,
    feeling_other: input.feelingOther?.trim() || null,
    question: input.question ?? null,
    // ATTACHED, NEVER ASKED FOR. See lib/last-screen.ts for why the screen is
    // the one she came FROM rather than the one she is on.
    screen: lastScreen(),
    app_version: runtimeVersion ?? null,
    update_id: isEmbeddedLaunch ? null : (updateId ?? null),
    device: `${Platform.OS} ${String(Platform.Version)}`,
    platform: Platform.OS,
    os_version: String(Platform.Version),
  });

  if (error) {
    console.log('BETA FEEDBACK SEND FAILED:', error.message);
    return { ok: false, reason: error.message };
  }
  return { ok: true, screenshotLost };
}

/** Her own submissions, newest first. */
export async function myBetaFeedback(): Promise<BetaFeedbackRow[]> {
  const { data, error } = await supabase
    .from('beta_feedback')
    .select('id, created_at, message, screenshot_path, feelings, feeling_other, question, status')
    .order('created_at', { ascending: false });
  if (error) {
    console.log('BETA FEEDBACK HISTORY FAILED:', error.message);
    return [];
  }
  return (data ?? []) as BetaFeedbackRow[];
}

/**
 * A one-line summary of a submission, for the history list.
 *
 * WHY A SUBMISSION WITH NO WORDS STILL READS AS SOMETHING. "Nothing is required"
 * means a row can be a single tapped feeling, and a history row showing an empty
 * line for it would make her own feedback look lost.
 */
export function summarise(row: BetaFeedbackRow): string {
  if (row.message && row.message.trim()) return row.message.trim();
  const named = row.feelings
    .map((f) => FEELINGS.find((x) => x.id === f)?.label ?? f)
    .filter((l) => l !== 'Something else');
  if (row.feeling_other?.trim()) named.push(row.feeling_other.trim());
  if (named.length > 0) return named.join(', ');
  if (row.screenshot_path) return 'A screenshot';
  return 'Sent with nothing written';
}
