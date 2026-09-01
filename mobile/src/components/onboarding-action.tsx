import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Where onboarding's forward action lives (Part Seven).
//
// WHY IT MOVED. The Continue button used to sit directly above each screen's
// message box, one gap away from Send. On device that turned into real
// mis-taps — people meant to send an answer and skipped the step instead,
// worst with the keyboard up, when the two controls are closest together and the
// thumb is already down there. Skipping a step by accident is a bad failure: the
// person does not know what they missed, and steps 6 and 10 in particular carry
// the conversation rather than a form.
//
// So the action moved to the header, where the progress counter already lives.
// That pairs it with the thing it actually relates to — "step 4 of 10 …
// Continue" — and puts a screen's width between it and Send.
//
// WHY A CONTEXT RATHER THAN PROPS. The header renders once, in the onboarding
// layout, ABOVE the Stack, deliberately so it persists across the push-chain
// instead of animating in and out with each step. Every screen's "can I go on
// yet?" condition is different and local — messages.length > 0 here, a `done`
// flag there, a step machine somewhere else — and so is each destination. A
// context lets each screen keep owning both and simply hand the header the
// answer, rather than the header learning nine special cases it would then have
// to be kept in step with.
//
// The action is REGISTERED, not declared once: a screen re-registers whenever
// its own condition changes, and clears on unmount so a stale Continue can never
// outlive the screen that meant it.

export type OnboardingAction = {
  label: string;
  onPress: () => void;
  // False while the screen is not ready to move on. The button stays visible and
  // dimmed rather than disappearing — a control that vanishes and returns draws
  // more attention than one that waits, and its absence reads as "there is no
  // way forward" rather than "not yet".
  enabled: boolean;
  // An optional second, quieter action beside the primary one. first-log needs
  // it ("Skip for now" alongside Continue), and offering a skip only after
  // someone hesitates would be a skip that was hoping not to be taken
  // (Part Two, principle 4).
  secondary?: { label: string; onPress: () => void };
};

type ContextValue = {
  action: OnboardingAction | null;
  setAction: (action: OnboardingAction | null) => void;
};

const OnboardingActionContext = createContext<ContextValue | null>(null);

export function OnboardingActionProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<OnboardingAction | null>(null);
  const value = useMemo(() => ({ action, setAction }), [action]);
  return (
    <OnboardingActionContext.Provider value={value}>{children}</OnboardingActionContext.Provider>
  );
}

export function useOnboardingActionSlot(): OnboardingAction | null {
  return useContext(OnboardingActionContext)?.action ?? null;
}

// Called by each onboarding screen. Everything is passed by value rather than by
// callback identity, so a screen does not have to memoise its handlers to avoid
// a re-registration loop — the dependency list below is the primitive fields,
// and the functions ride along.
export function useOnboardingAction(action: OnboardingAction | null) {
  const ctx = useContext(OnboardingActionContext);
  const setAction = ctx?.setAction;

  const label = action?.label;
  const enabled = action?.enabled;
  const secondaryLabel = action?.secondary?.label;

  // Held in a ref-free closure: the effect re-runs when the VISIBLE state
  // changes, and reads the current handlers at fire time through the object it
  // was given. Re-registering on every render would reset the header's state on
  // every keystroke.
  const onPress = action?.onPress;
  const secondaryPress = action?.secondary?.onPress;

  const register = useCallback(() => {
    if (!setAction) return;
    if (!label || enabled === undefined || !onPress) {
      setAction(null);
      return;
    }
    setAction({
      label,
      enabled,
      onPress,
      secondary:
        secondaryLabel && secondaryPress
          ? { label: secondaryLabel, onPress: secondaryPress }
          : undefined,
    });
    // onPress/secondaryPress are intentionally outside the dependency list: they
    // are recreated on every render of a screen that holds any state, and
    // including them would re-register continuously. What must trigger a
    // re-register is what the header DISPLAYS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAction, label, enabled, secondaryLabel]);

  useEffect(() => {
    register();
    return () => setAction?.(null);
  }, [register, setAction]);
}
