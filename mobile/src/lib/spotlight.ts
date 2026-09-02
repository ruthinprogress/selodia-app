// The client half of the spotlight registry (Part Six, build item 23 — Tier A).
//
// Pairs with app/lib/spotlight-targets.ts, which is the server half and the
// canonical id list. This file adds the two things only the app knows: where
// each element lives, and — when the element sits behind a tap the person can
// actually be shown — which element leads to it.
//
// WHY reachedVia EXISTS. Part Six describes one journey: the element pulses, the
// person taps it, and they land on the destination with the relevant section
// highlighted and a message anchored below. That journey only survives when the
// thing that leads somewhere is itself pointable. `settings.export` lives on a
// screen nobody is on, but the Settings link that opens it sits at the top of
// Chat — so the link pulses, the tap navigates, and the export highlights on
// arrival. Two stages of one request, not two requests.
//
// WHERE THERE IS NO reachedVia, the route to the target is a tab icon, and tab
// icons cannot be spotlighted (SELODIA_SPEC.md, Part Six, KNOWN PLATFORM
// CONSTRAINT). Those targets are NOT dropped: the request stays pending, Unflump
// explains the way in words as it does today, and if the person walks there
// themselves the destination still highlights when it appears. That is the whole
// of Phase B standing on its own, and it is the more common path of the two.

export const SPOTLIGHT_IDS = [
  'chat.settings',
  'chat.add',
  'chat.composer',
  'body.overview',
  'body.food',
  'body.measurements',
  'body.activity',
  'overview.stats',
  'overview.calories',
  'overview.protein',
  'overview.water',
  'food.entries',
  'measurements.week',
  'measurements.export',
  'almanac.categories',
  'almanac.entries',
  'settings.export',
  'settings.delete',
] as const;

export type SpotlightId = (typeof SPOTLIGHT_IDS)[number];

export function isSpotlightId(v: unknown): v is SpotlightId {
  return typeof v === 'string' && (SPOTLIGHT_IDS as readonly string[]).includes(v);
}

// Only ids whose route is an in-screen tap appear here. Everything else is
// reached across a tab and therefore has no pointable step - see the header.
export const REACHED_VIA: Partial<Record<SpotlightId, SpotlightId>> = {
  'settings.export': 'chat.settings',
  'settings.delete': 'chat.settings',
};

// How far below (or above) the highlighted element the anchored message sits.
export const ANCHOR_GAP = 12;

// Breathing room around the element inside the cut-out, so the ring sits outside
// what it is pointing at rather than on top of it.
export const HOLE_PADDING = 8;

export type Rect = { x: number; y: number; width: number; height: number };

// Whether a measured rect is usable. A target that has unmounted, or that has
// been laid out at zero size, measures as a degenerate rect - pointing at it
// would put a glowing ring around nothing.
export function isUsableRect(r: Rect | null): r is Rect {
  return !!r && r.width > 1 && r.height > 1 && Number.isFinite(r.x) && Number.isFinite(r.y);
}

// The message goes below the element when there is room, above when there is
// not. Returning the decision rather than a style keeps it testable without a
// renderer, which matters here because the overlay itself cannot be unit-tested.
export function anchorBelow(rect: Rect, windowHeight: number, messageHeight: number): boolean {
  return rect.y + rect.height + ANCHOR_GAP + messageHeight <= windowHeight;
}
