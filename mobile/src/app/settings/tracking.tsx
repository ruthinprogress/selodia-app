import { MacroChoices } from '@/components/macro-choices';
import { MetricChoices } from '@/components/metric-choices';
import { SectionIntro } from '@/components/section-intro';
import { SettingsPage } from '@/components/settings-page';

// WHAT I TRACK (Ruth, 24 September 2026), its own page rather than a block in
// the hub: six choices plus the two fixed ones is a screenful, and the hub is a
// list of ways out rather than a place to do things.
//
// TWO SECTIONS SINCE 25 SEPTEMBER, because her item 11 put a second list of
// "what I track" in settings - the body measurements - and two settings pages
// with near-identical names would be worse than one page with two headings.
// What somebody tracks is one question whether the answer is a macro or a tape
// measure.
//
// Both lists are shared components: MacroChoices with onboarding, MetricChoices
// with nothing yet, but written to be asked rather than copied.
export default function TrackingSettings() {
  return (
    <SettingsPage
      title="What I track"
      subtitle="Choose what you want to keep an eye on. Nothing here changes what is recorded, only what you see."
    >
      <SectionIntro title="In your food">
        Every entry shows its calories and protein. Add anything else worth watching.
      </SectionIntro>
      <MacroChoices />

      <SectionIntro title="Your measurements">
        These are the rows on your Measurements screen, in this order. Hold one to move it.
      </SectionIntro>
      <MetricChoices />
    </SettingsPage>
  );
}
