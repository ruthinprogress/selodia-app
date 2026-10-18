import * as FileSystem from 'expo-file-system';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { lastScreen } from '@/lib/last-screen';
import { supabase } from '@/lib/supabase';

// REPORTING SOMETHING WRONG, FROM WHEREVER IT WENT WRONG.
//
// Ruth, 18 October 2026, after the app sent her to an edit screen that does not
// exist and she had to go hunting for the report form:
//
//   "I think while its in Beta there should be a quick tap way for users to
//    report. Tap on icon takes screenshot automatically of where they are which
//    is stored with their notes and saved to the bug list which needs reviewing
//    daily at this stage."
//
// WHAT THIS IS AND IS NOT, because the scope was cut deliberately and the cut
// should be legible to whoever reads this next. The automatic capture needs
// react-native-view-shot, which is a native module: it cannot ship over the air
// and would need a whole new store build to land. Everything else here can go
// out today the ordinary way, and does. The capture rides the next native build.
//
// So this is ONE TAP TO THE FORM, with the picture offered rather than taken -
// which is what the beta feedback flow already settled on, for a reason worth
// keeping: "Android's own screenshot is one button press and already in her
// library". Two taps that work now beat one tap that needs a release.
//
// WHY IT IS NOT MERGED WITH beta_feedback. They look like duplicates and are
// not. beta_feedback is how a tester is FINDING it - feelings, an answer to a
// question the app asked, a feature vote. This is a BUG. Putting them in one
// table would mean a bug list that has to be filtered before it can be read
// daily, which is the thing most likely to stop it being read daily.

/** Everything the phone knows without being asked. Listed, never summarised. */
export type ReportContext = {
  screen: string | null;
  updateId: string | null;
  runtimeVersion: string | null;
  channel: string | null;
  platform: string;
  osVersion: string;
};

/**
 * What is attached, so it can be SHOWN rather than described.
 *
 * settings/feedback.tsx established this and it is not decoration: "An app that
 * quietly collects things in the background while asking for help is the
 * opposite of what this product is for, and the list is short enough to print."
 */
export function reportContext(): ReportContext {
  const { updateId, runtimeVersion, channel, isEmbeddedLaunch } = Updates;
  return {
    // WHERE SHE CAME FROM, not where she is - except that with a button on
    // every screen those are now usually the same thing, which is most of the
    // point of putting it there.
    screen: lastScreen(),
    updateId: isEmbeddedLaunch ? null : (updateId ?? null),
    runtimeVersion: runtimeVersion ?? null,
    channel: channel ?? null,
    platform: Platform.OS,
    osVersion: String(Platform.Version),
  };
}

/**
 * Upload a picture to the private bucket, returning its path.
 *
 * UNDER THEIR OWN USER ID, because the bucket's policy checks the first path
 * segment against auth.uid() rather than trusting the client to choose
 * somewhere sensible. A screenshot of this app is a picture of somebody's own
 * health record, so the bucket is private and nothing here ever produces a
 * public URL.
 *
 * Lifted out of beta-feedback.ts, where it worked against the wrong table: a
 * bug is the report that most needs a picture, and it was the one kind that
 * could not carry one.
 */
export async function uploadReportScreenshot(
  userId: string,
  uri: string
): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${userId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('beta-feedback')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      console.log('REPORT SCREENSHOT UPLOAD FAILED:', error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.log('REPORT SCREENSHOT READ FAILED:', err instanceof Error ? err.message : err);
    return null;
  }
}

export type ReportResult =
  | { ok: true; screenshotLost: boolean }
  | { ok: false; reason: string };

/**
 * File a bug.
 *
 * THE PICTURE NEVER COSTS THE REPORT. If the upload fails the row is still
 * written and the caller is told the picture was lost, so somebody who has just
 * described a problem is never told the whole thing failed because an image did
 * not go up. They wrote the useful part.
 */
export async function reportBug(input: {
  message: string;
  screenshotUri?: string | null;
  /** The screen it was sent from, when the caller knows better than lastScreen. */
  screen?: string | null;
}): Promise<ReportResult> {
  const text = input.message.trim();
  if (!text) return { ok: false, reason: 'nothing written' };

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, reason: 'not signed in' };

  let screenshotPath: string | null = null;
  let screenshotLost = false;
  if (input.screenshotUri) {
    screenshotPath = await uploadReportScreenshot(userId, input.screenshotUri);
    screenshotLost = screenshotPath === null;
  }

  const ctx = reportContext();
  const { error } = await supabase.from('feedback_reports').insert({
    user_id: userId,
    message: text,
    screenshot_path: screenshotPath,
    screen: input.screen ?? ctx.screen,
    update_id: ctx.updateId,
    runtime_version: ctx.runtimeVersion,
    channel: ctx.channel,
    platform: ctx.platform,
    os_version: ctx.osVersion,
    // NO NATIVE MODULE FOR THIS. expo-application would give the binary's own
    // version and is not in the build; adding a native dependency to collect a
    // version string would need a whole new binary to ship a feedback form.
    // runtimeVersion is what identifies the binary that matters here.
    app_version: ctx.runtimeVersion,
  });

  if (error) {
    console.log('BUG REPORT SEND FAILED:', error.message);
    return { ok: false, reason: error.message };
  }
  return { ok: true, screenshotLost };
}
