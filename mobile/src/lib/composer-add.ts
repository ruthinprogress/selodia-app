// The composer "+" options (build item 10b).
//
// SOURCE-based, never type-based. The sheet deliberately does not ask WHAT the
// person is photographing — a scale readout, a plate of food and a treadmill
// display all arrive the same way, and the image is classified afterwards.
// Asking someone to categorise their own photo would reintroduce the closed
// menu the free-text philosophy exists to reject.
//
// Kept as data rather than inline in the component so the list is testable
// without rendering.

export type AddSource = 'camera' | 'library' | 'file';

// "CHOOSE A FILE" ARRIVED ON 2026-09-20, with expo-document-picker, and it
// arrived for a reason: "I wanted to upload the consultant letter with the mri
// results ... this is something selodia needs to be able to do to help ppl."
// A letter from a hospital is very often a PDF in an email, never a photograph.
//
// IT IS STILL A DEAD CONTROL ON A BUILD WITHOUT THE NATIVE MODULE, and an
// over-the-air update cannot add native code - so the option is asked for at
// the moment the sheet is drawn rather than listed unconditionally. Principle 8
// holds either way: the control appears only where it works.
export function addOptions(canOpenFiles: boolean): { source: AddSource; label: string }[] {
  const options: { source: AddSource; label: string }[] = [
    { source: 'camera', label: 'Take a photo' },
    { source: 'library', label: 'Gallery' },
  ];
  if (canOpenFiles) options.push({ source: 'file', label: 'Choose a file' });
  return options;
}
