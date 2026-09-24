import { MacroChoices } from '@/components/macro-choices';
import { SettingsPage } from '@/components/settings-page';

// WHAT I TRACK (Ruth, 24 September 2026), its own page rather than a block in
// the hub: six choices plus the two fixed ones is a screenful, and the hub is a
// list of ways out rather than a place to do things.
//
// The list itself is MacroChoices, shared with onboarding, so the two cannot
// drift apart.
export default function TrackingSettings() {
  return (
    <SettingsPage
      title="What I track"
      subtitle="Every food entry shows its calories and protein. Add anything else you want to keep an eye on."
      footer="Nothing here changes what is recorded, only what you see."
    >
      <MacroChoices />
    </SettingsPage>
  );
}
