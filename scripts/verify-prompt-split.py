# Did the reorder lose any of the prompt?
#
# The first attempt at this tried to find where each template literal ended by
# scanning for an unescaped backtick, and stopped 30,000 characters early
# because the prose contains one. Comparing whole LINES as a multiset needs no
# parsing at all and cannot be fooled the same way: a line of prompt text is a
# line of prompt text wherever it has been moved to.
#
# Code lines legitimately differ, so only lines that look like prose are
# compared - long, not starting with a comment or a brace.

import io
from collections import Counter

BEFORE = r"C:\Users\ruthi\AppData\Local\Temp\claude\C--Users-ruthi-unflump-app\32005c44-1c08-4f10-8a48-2d02e8f5d12a\scratchpad\route-before-split.ts"
AFTER = r"C:\Users\ruthi\unflump-app\app\api\ask-selodia\route.ts"

REWORDS = [
    ("using TODAY SO FAR above so the suggestion", "using TODAY SO FAR so the suggestion"),
    ("If there is no calorie target above,", "If there is no calorie target in this prompt,"),
    ("or from the logged data above.", "or from their logged data in this prompt."),
    ("Their logged history above is still yours to draw on", "Their logged history is still yours to draw on"),
]


def prose_lines(path):
    text = io.open(path, encoding="utf-8").read()
    for old, new in REWORDS:
        text = text.replace(old, new)
    out = Counter()
    for raw in text.split("\n"):
        line = raw.rstrip()
        stripped = line.strip()
        if len(stripped) < 60:
            continue
        if stripped.startswith(("//", "*", "/*")):
            continue
        # Code lines in this file are indented; prompt prose sits at column 0
        # inside the template literals.
        if line.startswith(" "):
            continue
        out[stripped] += 1
    return out


b = prose_lines(BEFORE)
a = prose_lines(AFTER)

lost = b - a
gained = a - b

print(f"  prose lines before : {sum(b.values())}")
print(f"  prose lines after  : {sum(a.values())}\n")

if not lost and not gained:
    print("  IDENTICAL as a multiset. Every line of the prompt survived the cut;\n"
          "  only its position changed.\n")
else:
    for line, n in lost.items():
        print(f"  LOST   x{n}: {line[:130]}\n")
    for line, n in gained.items():
        print(f"  GAINED x{n}: {line[:130]}\n")
    raise SystemExit(1)
