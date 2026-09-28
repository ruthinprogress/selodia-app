// WHERE SHE WAS WHEN SOMETHING WENT WRONG.
//
// The single most useful field on a bug report and the one nobody types. By the
// time the feedback screen is open she has navigated away from whatever annoyed
// her, so "current screen" is always the feedback screen and always useless.
//
// The More mark records the route it was pressed FROM, which is the last screen
// she was actually looking at. A module-level variable rather than state or a
// store: it is one string, it does not need to survive a restart, and anything
// heavier would be machinery for a breadcrumb.

let last: string | null = null;

/** Called by the More mark, with the route it was pressed from. */
export function rememberScreen(pathname: string | null | undefined): void {
  if (!pathname) return;
  // Settings routes are where she goes to REPORT, not where the problem was.
  // Recording them would overwrite the only thing worth knowing.
  if (pathname.startsWith('/settings')) return;
  last = pathname;
}

/** The last screen she was on before opening Settings, if it is known. */
export function lastScreen(): string | null {
  return last;
}
