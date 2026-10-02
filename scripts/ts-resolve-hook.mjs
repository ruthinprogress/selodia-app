// LET THE CHECKS IMPORT THE APP'S OWN TYPESCRIPT, EXTENSIONLESS AND ALIASED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-week-add.mjs
//
// Node 24 strips TypeScript types natively, but its resolver still demands an
// explicit extension, and it knows nothing about the mobile app's `@/` alias.
// Two separate reasons a check could not import the code it was checking.
//
// 1. EXTENSIONLESS IMPORTS. The app is written the normal way - `import { x } from
//    './almanac'` - so the moment a module under test gained an extensionless
//    import of its own, every check that imported it died with
//    ERR_MODULE_NOT_FOUND.
//
//    THAT IS WHY THIS EXISTS AND NOT A REWRITE OF THE IMPORTS.
//    `check-week-add.mjs` had 28 passing cases on 1 October and was failing to
//    start by the next morning, because `pending-save.ts` began importing
//    `./almanac`. Nothing in the app was wrong; the check simply stopped running.
//    A check that cannot run cannot fail, and a suite that prints nothing is
//    indistinguishable in a report from a suite that passed - which is the
//    failure mode this codebase keeps paying for.
//
// 2. THE `@/` ALIAS. Everything under mobile/src imports as '@/lib/x', declared in
//    mobile/tsconfig.json and meaningless to Node, which reads '@/lib' as a bare
//    package name. So a check could import a mobile module only if that module
//    happened to use no alias, and almost none do.
//
// THE ROOT IS BAKED IN AT REGISTER TIME. The hook runs as a data: URL, so
// `import.meta.url` inside it is that data URL and every relative path resolves
// against nothing. The absolute file:// URL of mobile/src is interpolated below
// instead.
//
// Extensionless resolution only applies when the plain path does not exist and the
// .ts does, so it can never shadow a real JavaScript module.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const MOBILE_SRC = pathToFileURL(
  path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'mobile', 'src') + path.sep
).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';

  const MOBILE_SRC = ${JSON.stringify(MOBILE_SRC)};

  export async function resolve(specifier, context, next) {
    // The mobile app's own alias, rewritten before anything else: the error Node
    // gives for '@/lib/onboarding-step' is "cannot find PACKAGE '@/lib'", so the
    // extension retry below never fires for it.
    if (specifier.startsWith('@/')) {
      const base = MOBILE_SRC + specifier.slice(2);
      for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
        try {
          const candidate = await next(base + ext, context);
          if (existsSync(fileURLToPath(candidate.url))) return candidate;
        } catch {
          // try the next extension
        }
      }
    }
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
