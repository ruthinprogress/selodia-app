import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { ScrollView } from 'react-native';

import {
  isSpotlightId,
  isUsableRect,
  REACHED_VIA,
  type Rect,
  type SpotlightId,
} from '@/lib/spotlight';

// The spotlight's state machine (Part Six, build item 23 — Tier A).
//
// ONE REQUEST, UP TO TWO STAGES. Part Six describes a single journey: an element
// pulses, the person taps it, and they arrive with the destination highlighted
// and a message anchored below. So a request names what they are LOOKING FOR,
// and this decides what to actually light up right now:
//
//   point  - the element that leads there is on screen, so pulse it.
//   arrive - they are on the destination screen, so highlight the thing itself.
//
// A request whose route is a tab icon has no `point` stage at all, because tab
// icons cannot be spotlighted (UNFLUMP_SPEC.md, Part Six, KNOWN PLATFORM
// CONSTRAINT). It waits instead: Unflump explains the way in words, and if the
// person walks there the destination highlights when it mounts. That waiting
// path is the common one, and it is a feature rather than a consolation - it
// also covers someone who taps the tab a minute later having read the answer.
//
// NOTHING HERE EVER NAVIGATES BY ITSELF. The overlay can forward a tap to the
// element it is covering, which is the person tapping a control they can see.
// Moving someone between screens without a tap is Layer 2, explicitly a later
// fast-follow, and doing it early would turn a hint into a hijack.

type Registration = { measure: () => Promise<Rect | null>; onActivate?: () => void };

type Active = {
  // What the person is looking for.
  final: SpotlightId;
  // Unflump's own words, anchored below the highlight.
  message: string;
  // What is lit up right now: the pointer, the destination, or nothing yet.
  showing: SpotlightId | null;
  stage: 'point' | 'arrive';
};

type SpotlightContextValue = {
  register: (id: SpotlightId, reg: Registration) => () => void;
  show: (target: string, message: string) => void;
  dismiss: () => void;
  active: Active | null;
  measureActive: () => Promise<Rect | null>;
  activateShowing: () => void;
};

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

// A pending request is a promise to highlight something WHEN they get there. It
// should not still be waiting an hour later, attaching itself to a visit that
// had nothing to do with the question - so it expires quietly.
const PENDING_TTL_MS = 3 * 60_000;

export function SpotlightProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef(new Map<SpotlightId, Registration>());
  const [active, setActive] = useState<Active | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiry = useCallback(() => {
    if (expiry.current) {
      clearTimeout(expiry.current);
      expiry.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearExpiry();
    setActive(null);
  }, [clearExpiry]);

  const register = useCallback((id: SpotlightId, reg: Registration) => {
    registry.current.set(id, reg);
    // A destination that has just appeared completes a waiting request. Done
    // here rather than in an effect on the screen so that ANY route to the
    // destination finishes the journey - the pointer tap, a tab press, or the
    // person simply going there of their own accord a minute later.
    setActive((current) =>
      current && current.showing === null && current.final === id
        ? { ...current, showing: id, stage: 'arrive' }
        : current
    );
    return () => {
      registry.current.delete(id);
      // The element that was lit has left the screen. Stop pointing at where it
      // used to be; if it was only the pointer, the request keeps waiting for
      // the destination it leads to.
      setActive((current) => {
        if (!current || current.showing !== id) return current;
        if (current.stage === 'point' && current.final !== id) {
          return { ...current, showing: null, stage: 'arrive' };
        }
        return null;
      });
    };
  }, []);

  const show = useCallback(
    (target: string, message: string) => {
      // Server-side validation already rejects an unknown id; this is the second
      // gate, and it is not redundant - the two packages hold separate lists, so
      // an id the server knows and this build does not must land as nothing
      // happening rather than as a crash or a ring around the origin.
      if (!isSpotlightId(target)) return;

      clearExpiry();
      const pointer = REACHED_VIA[target] ?? target;
      const canPoint = registry.current.has(pointer);
      setActive({
        final: target,
        message,
        showing: canPoint ? pointer : null,
        stage: canPoint && pointer === target ? 'arrive' : canPoint ? 'point' : 'arrive',
      });
      if (!canPoint) {
        expiry.current = setTimeout(() => setActive(null), PENDING_TTL_MS);
      }
    },
    [clearExpiry]
  );

  const measureActive = useCallback(async () => {
    if (!active?.showing) return null;
    const reg = registry.current.get(active.showing);
    if (!reg) return null;
    const rect = await reg.measure();
    return isUsableRect(rect) ? rect : null;
  }, [active]);

  // Hands the tap back to the control the overlay is covering. The person meant
  // to press the thing they were shown; the overlay should not be the reason it
  // does nothing. Targets that pass no handler simply dismiss, leaving the real
  // control visible and tappable underneath.
  const activateShowing = useCallback(() => {
    const reg = active?.showing ? registry.current.get(active.showing) : undefined;
    const onActivate = reg?.onActivate;
    if (active && active.showing !== active.final) {
      // Mid-journey: keep the request alive so the destination still highlights
      // once the tap has taken them there.
      clearExpiry();
      setActive({ ...active, showing: null, stage: 'arrive' });
      expiry.current = setTimeout(() => setActive(null), PENDING_TTL_MS);
    } else {
      dismiss();
    }
    onActivate?.();
  }, [active, clearExpiry, dismiss]);

  useEffect(() => clearExpiry, [clearExpiry]);

  const value = useMemo(
    () => ({ register, show, dismiss, active, measureActive, activateShowing }),
    [register, show, dismiss, active, measureActive, activateShowing]
  );

  return <SpotlightContext.Provider value={value}>{children}</SpotlightContext.Provider>;
}

// The scroller a screen's targets sit inside, supplied by context rather than by
// prop-drilling a ref through OverviewPanel, MeasurementsView and the rest. A
// screen wraps its content once and every target beneath it can bring itself
// into view before being measured - without four components each growing a
// scrollRef prop they otherwise have no use for.
const SpotlightScrollContext = createContext<React.RefObject<ScrollView | null> | null>(null);

export function SpotlightScroll({
  scrollRef,
  children,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  children: React.ReactNode;
}) {
  return (
    <SpotlightScrollContext.Provider value={scrollRef}>{children}</SpotlightScrollContext.Provider>
  );
}

export function useSpotlightScroll() {
  return useContext(SpotlightScrollContext);
}

// Returns null outside a provider rather than throwing. Onboarding renders
// without one, and a missing spotlight must never be the thing that stops
// someone finishing signup.
export function useSpotlight(): SpotlightContextValue | null {
  return useContext(SpotlightContext);
}
