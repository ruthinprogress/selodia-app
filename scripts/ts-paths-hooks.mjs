// Let a script import the app's own TypeScript modules.
//
// Node strips types happily, but the app's files import each other without a
// file extension - './reply-prompt', not './reply-prompt.ts' - because a bundler
// resolves that and Node does not. So a script can import one app file and then
// fall over on the first import INSIDE it.
//
// This hook adds the extension Node is missing, and only that: a relative
// specifier with no extension whose .ts or .tsx file exists on disk. Anything
// else is passed straight through untouched, so it cannot quietly change how a
// package resolves.

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
    const from = context.parentURL ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
    for (const ext of ['.ts', '.tsx']) {
      if (from && existsSync(from + ext)) {
        return next(pathToFileURL(from + ext).href, context);
      }
    }
  }
  return next(specifier, context);
}
