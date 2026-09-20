import { router } from 'expo-router';

import { AccountDeletion } from '@/components/account-deletion';
import { DataExport } from '@/components/data-export';
import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { SpotlightTarget } from '@/components/spotlight-target';

// DATA AND EXPORT (2026-09-20). Both halves of Part Five's requirement, in the
// order they were always in: the copy first, the deletion after it. Somebody
// about to erase everything passes the offer of a copy on the way.
export default function DataScreen() {
  return (
    <SettingsPage
      title="Data and export"
      subtitle="Your data belongs to you. Take a copy, or remove it entirely."
      footer="Your data. Your choice. Always."
    >
      {/* THE REPORT COMES FIRST, because it is the one somebody is usually
          looking for: a document to take to a clinician. The export below it is
          the legal right of access - everything, in machine form - and the two
          are easy to confuse until they are described side by side. */}
      <SettingsGroup title="A report to share">
        <SettingsRow
          first
          icon="document-text-outline"
          label="Build a report"
          detail="Choose what to include, then save it as a PDF"
          onPress={() => router.push('/settings/report')}
        />
      </SettingsGroup>

      <SpotlightTarget id="settings.export">
        <DataExport />
      </SpotlightTarget>
      <SpotlightTarget id="settings.delete">
        <AccountDeletion />
      </SpotlightTarget>
    </SettingsPage>
  );
}
