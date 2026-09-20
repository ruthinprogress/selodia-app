# -*- coding: utf-8 -*-
"""Turn the two brand SVGs into a TypeScript module.

Read at build time rather than at request time: a serverless function has no
dependable working directory, and a report that renders without its own
letterhead because a path resolved differently in production is exactly the
kind of failure that only shows up on somebody else's machine.
"""
import io
import re

OUT = "app/lib/brand/marks.ts"


def parts(path):
    s = io.open(path, encoding="utf-8").read()
    view = re.search(r'viewBox="([^"]+)"', s).group(1)
    # Everything inside the root <svg>, with the <style> block (and its
    # breathing animation) dropped - a printed document does not animate.
    inner = s[s.index(">", s.index("<svg")) + 1:s.rindex("</svg>")]
    inner = re.sub(r"<style>.*?</style>", "", inner, flags=re.S)
    inner = re.sub(r"\s+", " ", inner).strip()
    return view, inner


mark_view, mark_inner = parts("app/lib/brand/mark.svg")
lock_view, lock_inner = parts("app/lib/brand/lockup.svg")

ts = u'''// The real marks, from Branding & Assets/Logo Asset Pack v2.0, generated into
// TypeScript so they are bundled rather than read from disk at request time.
// Regenerate with scripts/make-brand.py when the asset pack changes.
//
// WHY THE REAL FILES AND NOT A DRAWN APPROXIMATION. This document is handed to
// a consultant. A wordmark redrawn by hand is the one thing on the page that
// would say "assembled in a hurry", and the pack exists precisely so nobody has
// to redraw it. Both are fully outlined - no font is needed to render them.

/** The seed mark alone, in terracotta. Used small in the header and huge and faint behind the page. */
export const MARK_VIEWBOX = '%s';
export const MARK_INNER = `%s`;

/** The horizontal lockup - mark and wordmark - in charcoal. */
export const LOCKUP_VIEWBOX = '%s';
export const LOCKUP_INNER = `%s`;
''' % (mark_view, mark_inner, lock_view, lock_inner)

io.open(OUT, "w", encoding="utf-8", newline="").write(ts)
print("written", OUT, len(ts), "chars")
