import { SegmentedTabs } from '@/components/segmented-tabs';
import type { AlmanacTab } from '@/lib/insights';

// The Almanac's three views: Insights, Movement and Me (build spec, Part Ten).
//
// A switch across the top of the one Almanac screen, NOT three more bottom tabs:
// the app has four destinations, and these are three views of one of them.
//
// The control itself is segmented-tabs.tsx, shared with the Log tab since
// 2026-09-17. Five rebuilds of this strip - "Insigh", "Moveme", "M" - are
// recorded there, in the component that now has to be right once.
const TABS: { id: AlmanacTab; label: string }[] = [
  { id: 'insights', label: 'Insights' },
  { id: 'movement', label: 'Movement' },
  { id: 'me', label: 'Me' },
];

export function AlmanacTabs({
  value,
  onChange,
}: {
  value: AlmanacTab;
  onChange: (tab: AlmanacTab) => void;
}) {
  return <SegmentedTabs items={TABS} value={value} onChange={onChange} />;
}
