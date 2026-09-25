// WHICH ROW IS OPEN, ANYWHERE IN THE APP.
//
// Ruth, 25 September 2026, item 2: "Tapping elsewhere or scrolling closes an
// open swipe."
//
// A MODULE-LEVEL STORE RATHER THAN A PROVIDER, on purpose. A provider is a
// thing every list has to remember to wrap itself in, and a list that forgets
// gets rows that all open at once with no error anywhere - which is the same
// shape as the More mark being in four places: a rule that only applies where
// somebody remembered to apply it. Here a row opening closes every other row in
// the app by existing, with nothing to wire up.
//
// One open row at a time is the whole state. It is not worth a library, and a
// library would not know when the app was backgrounded.

type Listener = (openId: string | null) => void;

let openId: string | null = null;
const listeners = new Set<Listener>();

/** Say this row is open. Every other row hears it and closes. */
export function setOpenSwipe(id: string | null): void {
  if (openId === id) return;
  openId = id;
  for (const l of listeners) l(openId);
}

/** Close whatever is open. For a scroll handler, or a tap on the page. */
export function closeOpenSwipe(): void {
  setOpenSwipe(null);
}

/** True when nothing is open, so a caller can skip work. */
export function anySwipeOpen(): boolean {
  return openId !== null;
}

export function subscribeOpenSwipe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
