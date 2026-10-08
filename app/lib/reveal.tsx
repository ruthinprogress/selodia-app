'use client';

import { useEffect } from 'react';

// THE ONLY CLIENT JAVASCRIPT ON THIS PAGE, and it is about thirty lines.
//
// Ruth, 8 October 2026: "threads draw in once as they scroll into view and
// circles fade in gently. Use CSS where possible, with a tiny
// IntersectionObserver only if needed. No libraries."
//
// WHY IT IS NEEDED AT ALL. The CSS-only way to do this is `animation-timeline:
// view()`, which is real and still not in every browser this audience uses. A
// homepage whose diagrams never appear because the trigger is unsupported is a
// worse outcome than thirty lines of script.
//
// ──────────────────────────────────────────────────────────────────────────
// IT FAILS OPEN, AND THE FIRST VERSION DID NOT.
//
// The first version left the hiding to CSS: an un-revealed section had its
// diagrams at opacity 0 and its threads undrawn, waiting for a class. I wrote a
// comment next to it saying the page would still be complete if the script
// never ran. That was simply untrue, and testing it is what showed it: six of
// the eight sections sat invisible, because the class never arrived.
//
// So the FIRST THING THIS DOES is add `js-reveal` to the document element, and
// every rule in the stylesheet that hides anything is behind that class. No
// script, no class, nothing hidden: the page is complete and static. Hiding is
// something only a working animator is allowed to do, and it has to prove it is
// working before it is allowed to do it.
//
// THE SECOND GUARD is a deadline. If the observer has not reported on something
// within eight seconds of load, it is revealed anyway. That covers the cases
// the first guard cannot: an observer that exists but never fires because the
// tab is not painting, a layout where a section never crosses the threshold,
// and anything else nobody has thought of. A diagram that appears without
// animating is a small loss. A diagram nobody ever sees is the whole thing.
// ──────────────────────────────────────────────────────────────────────────
//
// ONCE, THEN UNOBSERVED. A thread that redraws every time it scrolls past is a
// fidget, not a flourish.
//
// REDUCED MOTION IS HANDLED IN CSS, not here, because the media query is the
// authoritative answer and a script that re-asked it could disagree with the
// stylesheet.

const DEADLINE_MS = 8000;

export function Reveal() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll('[data-reveal]'));
    if (targets.length === 0) return;

    const show = (el: Element) => el.classList.add('is-in');

    // No IntersectionObserver: show everything and never hide anything.
    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach(show);
      return;
    }

    // ONLY NOW is the stylesheet allowed to hide an un-revealed section.
    const root = document.documentElement;
    root.classList.add('js-reveal');

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          io.unobserve(entry.target);
        }
      },
      // A little before it reaches the bottom of the screen, so the draw has
      // started by the time she is looking at it rather than after.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
    );

    targets.forEach((el) => io.observe(el));

    // The deadline. Anything the observer has not spoken for by now is shown.
    const deadline = window.setTimeout(() => {
      targets.forEach(show);
      io.disconnect();
    }, DEADLINE_MS);

    return () => {
      window.clearTimeout(deadline);
      io.disconnect();
      // Leaving `js-reveal` on a page with no observer would hide everything
      // that had not been revealed yet, which is the exact failure this file
      // exists to prevent.
      root.classList.remove('js-reveal');
    };
  }, []);

  return null;
}
