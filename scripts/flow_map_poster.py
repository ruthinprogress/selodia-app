# THE FLOW MAP: every screen in Selodia, grouped the way the app is grouped,
# with the real navigation drawn on it.
#
# Ruth, 22 September 2026, on what the Claude Build chat is missing: "a full
# screens snapshot document". This is the picture half of it.
#
# Bands are the five tabs plus onboarding. Inside a band, the leftmost screen is
# where you arrive and everything to its right is reached from it; a line is
# drawn from the entry screen to each child. Onboarding is the one genuinely
# linear run, so it gets arrows between consecutive steps instead.
#
# Anything the poster cannot know - which screens carry data that looks like
# Ruth's real health record rather than the demo account's - is listed in
# flow-map-notes.md alongside, not guessed at here.

import io
import json
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "flow-map-shots")

THUMB_W = 230
GAP_X = 34
GAP_Y = 86
CAPTION_H = 46
PAD = 60
BAND_HEAD = 104

INK = (26, 28, 32)
MUTED = (120, 126, 136)
PAPER = (247, 245, 242)
CARD = (255, 255, 255)
LINE = (196, 190, 182)
ACCENT = (140, 92, 118)

F_TITLE = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 54)
F_SUB = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 26)
F_BAND = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 34)
F_BANDSUB = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22)
F_CAP = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 19)
F_PATH = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 17)

# ---- the bands, DERIVED from the shoot manifest ------------------------
#
# See scratchpad note: the hand-typed version went stale in five days. A band is
# chosen by the route's first segment, a caption by its last, and anything the
# rules below do not recognise lands in "Elsewhere" rather than being dropped -
# a screen silently missing from the map is the exact failure this is fixing.

with io.open(os.path.join(SHOTS, "manifest.json"), encoding="utf-8") as fh:
    MANIFEST = json.load(fh)

# Order matters: the first matching prefix wins, and this is the order the
# bands appear down the page.
BAND_RULES = [
    ("/onboarding", "Onboarding", "Seen once, in order.", True),
    ("/today", "Today", "The Health Flower. Each petal opens its own dimension.", False),
    ("/log", "Log", "Where everything is written down and read back.", False),
    ("/plans", "Plans", "What she is intentionally following.", False),
    ("/almanac", "Almanac", "What the app has noticed.", False),
    ("/settings", "Settings", "Reached from the gear, not the tab bar.", False),
]

# Captions the last URL segment would get wrong.
CAPTIONS = {
    "/": "Chat",
    "/today": "Today",
    "/log": "Log",
    "/settings": "Settings",
    "/health-data": "Health data",
    "/log/water-history": "Hydration history",
    "/log/feeling": "How you felt",
    "/settings/data": "Your data",
    "/settings/beta-feedback": "Beta feedback",
    "/onboarding/first-log": "First log",
    "/onboarding/health-context": "Health context",
    "/onboarding/reset-password": "Reset password",
}

# Onboarding is the one genuinely linear run, and alphabetical order is not the
# order a person walks it. This is the sequence from the router's own flow.
ONBOARDING_ORDER = [
    "/onboarding/intro",
    "/onboarding/consent",
    "/onboarding/account",
    # The seven-screen tap spine, 28 September 2026. Goals is screen 1 and was
    # a chat screen until tonight.
    "/onboarding/goals",
    "/onboarding/skill",
    "/onboarding/life-stage",
    "/onboarding/activities",
    "/onboarding/steer-around",
    "/onboarding/guidance",
    "/onboarding/first-draft",
    # STILL ROUTES, NO LONGER IN THE CHAIN. The conversational steps the spine
    # replaced. They are drawn after it because that is where they now sit:
    # reachable, and not walked through. Two of them collected height and
    # activity level, which the activities screen now asks for directly.
    "/onboarding/health-context",
    "/onboarding/nutrition",
    "/onboarding/activity",
    "/onboarding/equipment",
    "/onboarding/technical",
    "/onboarding/first-log",
    "/onboarding/reset-password",
]


def caption_of(route):
    if route in CAPTIONS:
        return CAPTIONS[route]
    tail = route.rstrip("/").rsplit("/", 1)[-1]
    return tail.replace("-", " ").capitalize() or "Chat"


def stem_of(route):
    return route.lstrip("/").replace("/", "-") or "chat"


def depth_then_name(route):
    # Parents before children inside a band, so the leftmost screen really is
    # the one everything else is reached from.
    return (route.count("/"), route)


shot = set(MANIFEST["done"])
routes = [r for r in MANIFEST["routes"] if stem_of(r) in shot]

BANDS = []
claimed = set()

# Chat is its own band and is the root route, which no prefix rule can match.
if "/" in routes:
    BANDS.append(("Chat", "The first tab. It never unmounts.", False,
                  [(stem_of("/"), caption_of("/"), "/")]))
    claimed.add("/")

for prefix, title, note, chain in BAND_RULES:
    members = [r for r in routes if r == prefix or r.startswith(prefix + "/")]
    if not members:
        continue
    claimed.update(members)
    if chain:
        rank = {r: i for i, r in enumerate(ONBOARDING_ORDER)}
        members.sort(key=lambda r: (rank.get(r, len(rank)), r))
    else:
        members.sort(key=depth_then_name)
    BANDS.append((title, note, chain,
                  [(stem_of(r), caption_of(r), r) for r in members]))

leftover = sorted(r for r in routes if r not in claimed)
if leftover:
    BANDS.append(("Elsewhere", "Reached from inside another screen.", False,
                  [(stem_of(r), caption_of(r), r) for r in leftover]))

MISSING = [r for r in MANIFEST["routes"] if stem_of(r) not in shot]
TOTAL = sum(len(b[3]) for b in BANDS)
assert TOTAL == len(routes), (TOTAL, len(routes))
print(f"{TOTAL} screens in {len(BANDS)} bands"
      + (f", {len(MISSING)} NOT SHOT: {MISSING}" if MISSING else ""))

PER_ROW = 5

# ---- measure ------------------------------------------------------------
probe = Image.open(os.path.join(SHOTS, "chat.png"))
THUMB_H = round(THUMB_W * probe.height / probe.width)
CELL_H = THUMB_H + CAPTION_H + GAP_Y

width = PAD * 2 + PER_ROW * THUMB_W + (PER_ROW - 1) * GAP_X

band_rows = []
for _, _, _, screens in BANDS:
    band_rows.append((len(screens) + PER_ROW - 1) // PER_ROW)

height = PAD + 180 + sum(BAND_HEAD + r * CELL_H for r in band_rows) + PAD

img = Image.new("RGB", (width, height), PAPER)
d = ImageDraw.Draw(img)

# ---- title --------------------------------------------------------------
d.text((PAD, PAD), "Selodia · every screen", font=F_TITLE, fill=INK)
d.text((PAD, PAD + 72), "Captured 28 September 2026 from the demo account, at phone size (390 x 844). Routes derived from the router tree.",
       font=F_SUB, fill=MUTED)
d.text((PAD, PAD + 106), "A line means you can get there from the screen on the left of the band.",
       font=F_SUB, fill=MUTED)

y = PAD + 180
placed = {}

for (title, note, chain, screens), rows in zip(BANDS, band_rows):
    d.line([(PAD, y + 8), (width - PAD, y + 8)], fill=LINE, width=2)
    d.text((PAD, y + 26), title, font=F_BAND, fill=ACCENT)
    d.text((PAD, y + 66), note, font=F_BANDSUB, fill=MUTED)
    top = y + BAND_HEAD

    boxes = []
    for i, (stem, caption, route) in enumerate(screens):
        col, row = i % PER_ROW, i // PER_ROW
        x = PAD + col * (THUMB_W + GAP_X)
        ty = top + row * CELL_H
        boxes.append((x, ty))

    # lines first, so the cards sit on top of them
    if chain:
        for i in range(len(screens) - 1):
            (x0, y0), (x1, y1) = boxes[i], boxes[i + 1]
            if y0 == y1:
                a = (x0 + THUMB_W, y0 + THUMB_H // 2)
                b = (x1, y1 + THUMB_H // 2)
                d.line([a, b], fill=ACCENT, width=3)
                d.polygon([(b[0], b[1]), (b[0] - 12, b[1] - 7), (b[0] - 12, b[1] + 7)], fill=ACCENT)
            else:
                d.line([(x0 + THUMB_W // 2, y0 + THUMB_H + CAPTION_H + 6),
                        (x0 + THUMB_W // 2, y1 - 22),
                        (x1 + THUMB_W // 2, y1 - 22),
                        (x1 + THUMB_W // 2, y1)], fill=ACCENT, width=3)
    elif len(screens) > 1:
        hx, hy = boxes[0]
        anchor = (hx + THUMB_W // 2, hy + THUMB_H + CAPTION_H + 6)
        for (bx, by) in boxes[1:]:
            d.line([anchor, (bx + THUMB_W // 2, by - 22), (bx + THUMB_W // 2, by)],
                   fill=LINE, width=2)

    for (stem, caption, route), (x, ty) in zip(screens, boxes):
        path = os.path.join(SHOTS, stem + ".png")
        d.rectangle([x - 5, ty - 5, x + THUMB_W + 5, ty + THUMB_H + CAPTION_H + 5],
                    fill=CARD, outline=LINE, width=2)
        if os.path.exists(path):
            thumb = Image.open(path).convert("RGB").resize((THUMB_W, THUMB_H), Image.LANCZOS)
            img.paste(thumb, (x, ty))
        else:
            d.rectangle([x, ty, x + THUMB_W, ty + THUMB_H], fill=(238, 235, 231))
            d.text((x + 12, ty + 12), "missing", font=F_CAP, fill=MUTED)
        d.text((x + 4, ty + THUMB_H + 10), caption, font=F_CAP, fill=INK)
        d.text((x + 4, ty + THUMB_H + 30), route, font=F_PATH, fill=MUTED)
        placed[stem] = (x, ty)

    y = top + rows * CELL_H

out = os.path.join(HERE, "selodia-flow-map.png")
img.save(out, optimize=True)
print(out, img.size, f"{os.path.getsize(out) / 1e6:.1f} MB")
