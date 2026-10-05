import { router } from 'expo-router';

import { ActivityLevelChoices } from '@/components/activity-level-choices';
import { SettingsPage } from '@/components/settings-page';
import { ACTIVITY_SCREEN } from '@/lib/body-mode';

// HOW ACTIVE ARE YOU, reached from More and from the Body Manual's own row.
//
// The question itself is a component now, shared with setup step 3 - see
// components/activity-level-choices.tsx. This is the door, not the room.

export default function ActivityLevelScreen() {
  return (
    <SettingsPage title={ACTIVITY_SCREEN.question} subtitle={ACTIVITY_SCREEN.subtitle}>
      <ActivityLevelChoices onChosen={() => router.back()} />
    </SettingsPage>
  );
}
