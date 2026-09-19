import { AccountDeletion } from '@/components/account-deletion';
import { DataExport } from '@/components/data-export';
import { SettingsPage } from '@/components/settings-page';
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
      <SpotlightTarget id="settings.export">
        <DataExport />
      </SpotlightTarget>
      <SpotlightTarget id="settings.delete">
        <AccountDeletion />
      </SpotlightTarget>
    </SettingsPage>
  );
}
