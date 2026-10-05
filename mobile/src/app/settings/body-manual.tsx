import { BodyManual } from '@/components/body-manual';
import { SettingsPage } from '@/components/settings-page';
import { BODY_MANUAL_HEADING, BODY_MANUAL_NOTE } from '@/lib/body-manual';

// THE BODY MANUAL, ON ITS OWN (Ruth, 4 October 2026: "Body Manual lives in More,
// not Profile").
//
// It was a section at the bottom of the profile screen, under her name and date
// of birth. Those are the few facts the app needs ABOUT her; the Manual is
// everything she has told it about her body, which is a different and much larger
// thing - and putting it under a heading about personal details is why the
// training switch read as "useless hidden away in profile settings".
//
// IT USES SettingsPage, which it should have done from the first version
// (5 October 2026). Her report: "Needs title font in the agreed large format and
// font as Plans etc. It all sits too low so cant access bottom of the
// cards/options."
//
// Both halves of that were one mistake - a page hand-rolled from a ScrollView
// instead of the shell every other settings page uses. The shell carries the
// serif display title, the back chevron, the sprig, the safe-area inset and the
// bottom padding that makes the last card reachable. Writing a page without it
// means re-deciding all five, and I got the last two wrong by not deciding them
// at all.

export default function BodyManualScreen() {
  return (
    <SettingsPage title={BODY_MANUAL_HEADING} subtitle={BODY_MANUAL_NOTE}>
      {/* The page owns the title and the note, so the component does not draw
          its own section heading underneath them. */}
      <BodyManual heading={false} />
    </SettingsPage>
  );
}
