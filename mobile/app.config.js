// The dev variant, so debugging never costs you the real app.
//
// THE PROBLEM THIS SOLVES. Android identifies an app by its package name, so a
// build with `app.selodia` REPLACES any other build with `app.selodia`. Once the
// store version is installed, putting a debuggable build on the same phone means
// uninstalling the real one - and then putting the real one back afterwards. That
// is a choice nobody should have to make mid-bug, and it is exactly the kind of
// friction that stops a problem being investigated at all.
//
// HOW IT WORKS, and the important part is what it is NOT. This is not a second
// copy of the project. `app.json` remains the single source of truth and is read
// first; this file receives it as `config` and overrides three fields when the
// APP_VARIANT env var says "development". One codebase, one config, two builds -
// so they cannot drift, and there is nothing to keep in sync.
//
// THREE FIELDS CHANGE, AND EACH FOR ITS OWN REASON:
//   - `android.package`: what makes Android treat them as separate apps at all.
//   - `name`: what appears under the icon. Without this you get two identical
//     "Selodía" icons and no way to tell which is which - the same confusion the
//     package rename caused on 2026-09-10, when the old and new builds were both
//     called Selodía until the old one was uninstalled first.
//   - `scheme`: deep links are claimed per-scheme, and two installed apps both
//     answering `selodia://` is ambiguous. The dev build answers
//     `selodiadev://` instead.
//
// WHAT DELIBERATELY DOES NOT CHANGE: `owner`, `slug` and `extra.eas.projectId`.
// Those identify the EAS PROJECT, not the app, and both variants belong to the
// same project - that is what lets one `eas update` reach whichever build is on a
// given channel. Changing them would fork the project, which is the opposite of
// the intent.
//
// A DEV BUILD NEEDS ITS OWN FCM CREDENTIALS, because push credentials are bound
// to a package name. Until those exist for `app.selodia.dev`, everything works on
// the dev variant except notifications.

const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => {
  if (!IS_DEV) return config;

  return {
    ...config,
    name: 'Selodía (dev)',
    scheme: 'selodiadev',
    android: {
      ...config.android,
      package: 'app.selodia.dev',
    },
  };
};
