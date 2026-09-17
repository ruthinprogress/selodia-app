import { SegmentedTabs } from '@/components/segmented-tabs';

export type LogView = 'food' | 'activity' | 'measurements';

// The Log tab's three views (UI brief, Part 1, 2026-09-17). Same control as the
// Almanac's, from segmented-tabs.tsx: "Measurements" is the longest label in the
// app's navigation, so this is where a strip that sizes itself wrongly shows up
// first.
const TABS: { id: LogView; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'activity', label: 'Activity' },
  { id: 'measurements', label: 'Measurements' },
];

export function LogTabs({ value, onChange }: { value: LogView; onChange: (v: LogView) => void }) {
  return <SegmentedTabs items={TABS} value={value} onChange={onChange} />;
}
