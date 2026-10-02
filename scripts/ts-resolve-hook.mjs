// LET THE CHECKS IMPORT THE APP'S OWN TYPESCRIPT, EXTENSIONLESS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-week-add.mjs
//
// Node 24 strips TypeScript types natively, but its resolver still demands an
// explicit extension. The app is written the normal way - `import { x } from
// './almanac'` - so the moment a module under test gained an extensionless
// import of its own, every check that imported it died with ERR_MODULE_NOT_FOUND.
//
// THAT IS WHY THIS EXISTS AND NOT A REWRITE OF THE IMPORTS. `check-week-add.mjs`
// had 28 passing cases on 1 October and was failing to start by this morning,
// because `pending-save.ts` began importing `./almanac`. Nothing in the app was
// wrong; the check simply stopped running. A check that cannot run cannot fail,
// and a suite that prints nothing is indistinguishable in a report from a suite
// that passed - which is the failure mode this codebase keeps paying for.
//
// It resolves `./x` to `./x.ts` only when the extensionless path does not exist
// and the .ts file does, so it can never shadow a real JavaScript module.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';

  export async function resolve(specifier, context, next) {
    try {
      return await next(specifier, context);
    } catch (err) {
      if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw err;
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        try {
          const candidate = await next(specifier + ext, context);
          if (existsSync(fileURLToPath(candidate.url))) return candidate;
        } catch {
          // try the next extension
        }
      }
      throw err;
    }
  }
`),
  pathToFileURL('./')
);
