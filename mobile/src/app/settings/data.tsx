import { View } from 'react-native';

import { AccountDeletion } from '@/components/account-deletion';
import { ConsentChoices } from '@/components/consent-choices';
import { DataExport } from '@/components/data-export';
import { SettingsPage } from '@/components/settings-page';
import { SpotlightTarget } from '@/components/spotlight-target';
import { Spacing } from '@/constants/theme';

// YOUR DATA (Ruth, 7 October 2026). Was "Data and export", and the rename came
// with a reshuffle that is really one decision: this page is the three things
// she can DO about her own record, and nothing else.
//
//   Take a copy.
//   Say what it may be used for.
//   Have it all removed.
//
// THE REPORT LEFT, AND THAT IS THE POINT OF THE RENAME. It used to sit at the
// top of this page under "A report to share", on the reasoning that it was what
// people were usually looking for. That reasoning was the argument against
// keeping it here: a document to take to a clinician is not an exercise of a
// data right, and the thing people are usually looking for should not be two
// taps inside the page about deleting everything. It is its own row in More now.
//
// THE CONSENTS ARRIVED from Privacy, because what her data may be used for is a
// thing she DOES about her data. Privacy keeps the policy, the voice choice and
// a pointer here, so the old path still works.
//
// DELETION LAST, AND SET APART. The order has always been copy-before-delete, so
// somebody about to erase everything passes the offer of a copy on the way. What
// is new is the space: it sits below a clear gap rather than stacked against the
// consents, because it is a different weight of decision from a toggle.
//
// ITS CONFIRMATION WAS ALREADY RIGHT AND IS UNCHANGED. One deliberate second
// tap, with the consequences stated in full first, and no typed phrase - see
// account-deletion.tsx on why making somebody transcribe "DELETE" is theatre
// that reads as distrust.
export default function DataScreen() {
  return (
    <SettingsPage
      title="Your data"
      subtitle="Your data belongs to you. Take a copy, say how it may be used, or remove it entirely."
      footer="Your data. Your choice. Always."
    >
      <SpotlightTarget id="settings.export">
        <DataExport />
      </SpotlightTarget>

      <ConsentChoices />

      {/* The gap that makes deletion a separate decision rather than the last
          item on a list of toggles. */}
      <View style={{ height: Spacing.four }} />
      <SpotlightTarget id="settings.delete">
        <AccountDeletion />
      </SpotlightTarget>
    </SettingsPage>
  );
}
