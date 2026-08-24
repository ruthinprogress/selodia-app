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

export const ADD_OPTIONS: { source: AddSource; label: string }[] = [
  { source: 'camera', label: 'Take a photo' },
  { source: 'library', label: 'Choose from library' },
  { source: 'file', label: 'Choose a file' },
];
