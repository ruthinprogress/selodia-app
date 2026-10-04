import { Fragment } from 'react';

import { Toggle } from '@/components/toggle';
import {
  MODE_LABEL,
  MODE_ORDER,
  toggleHint,
  withToggle,
  type BodyMode,
} from '@/lib/body-mode';

// THE FOUR SWITCHES, ONCE (4 October 2026).
//
// Ruth asked for the same control in setup, on Today and in the Body Manual, and
// for it to write ONE record. The record was solved first - user_profile.body_mode
// - and the control was still two hand-written copies of four <Toggle> blocks,
// one on Today and one about to be written for setup.
//
// THAT IS THE SHAPE OF EVERY DRIFT THIS WEEK. Two protein targets came from one
// sum called from five places with a defaulted argument. Eleven Body Manual rows
// ignored a redo because the fix was written inside one of them. "Get stronger"
// kept setting a surplus on one screen after being removed from the model. None of
// those were hard problems; they were one behaviour expressed twice.
//
// So this knows nothing about where it is. It holds no state, reads nothing, saves
// nothing: it is handed a mode and gives back the next one. Today saves on the tap
// because Today has no Continue; setup saves on Continue because it does. That is
// the only difference between the two screens, and it is the one that belongs to
// them rather than to the switches.

export function BodyModeToggles({
  mode,
  onChange,
  disabled,
}: {
  mode: BodyMode;
  /** The whole next mode, with the exclusivity rule already applied. */
  onChange: (next: BodyMode) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {MODE_ORDER.map((key) => {
        // THE RULE LIVES IN THE LIBRARY, not in the dimming. A disabled control
        // is a courtesy; withToggle enforces the same thing on the data, because
        // the data is what the figures are read from.
        const hint = toggleHint(mode, key);
        return (
          <Fragment key={key}>
            <Toggle
              checked={mode[key]}
              disabled={disabled === true || hint != null}
              hint={hint ?? undefined}
              onToggle={() => onChange(withToggle(mode, key, !mode[key]))}
              label={MODE_LABEL[key]}
            />
          </Fragment>
        );
      })}
    </>
  );
}
