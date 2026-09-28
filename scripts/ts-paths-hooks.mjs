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

// The mobile app's own alias, from mobile/tsconfig.json: "@/*" -> "./src/*".
// Node knows nothing about a bundler's path mapping, so a script importing any
// mobile file falls over on the first `@/lib/...` inside it.
const MOBILE_SRC = 'C:/Users/ruthi/unflump-app/mobile/src/';

function withExtension(path) {
  if (/\.[a-z]+$/i.test(path)) return existsSync(path) ? path : null;
  for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
    if (existsSync(path + ext)) return path + ext;
  }
  // A directory import resolves to its index, as a bundler would.
  for (const ext of ['.ts', '.tsx']) {
    if (existsSync(`${path}/index${ext}`)) return `${path}/index${ext}`;
  }
  return null;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const resolved = withExtension(MOBILE_SRC + specifier.slice(2));
    if (resolved) return next(pathToFileURL(resolved).href, context);
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const from = context.parentURL ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
    if (from && !/\.[a-z]+$/i.test(specifier)) {
      const resolved = withExtension(from);
      if (resolved) return next(pathToFileURL(resolved).href, context);
    }
  }

  return next(specifier, context);
}
