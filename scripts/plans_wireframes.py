# THE DECIDED PLANS SCREEN, DRAWN BESIDE THE ONE THAT EXISTS.
#
# Ruth asked for the proposal shown as simple wireframes laid onto the new flow
# map. By the time the map was composed she had decided the structure herself,
# so this draws HER decision rather than a proposal: the real Plans screenshot
# from the 28 September shoot on the left, and the four segments beside it.
#
# DELIBERATELY NOT PRETTY. A wireframe that looks finished gets argued with as
# if it were a design. Grey boxes, real words, nothing else - the words are from
# her session brief and her own prototype, and they are the part that matters.
#
#   python scripts/plans_wireframes.py

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "flow-map-shots")
OUT = os.path.join(HERE, "plans-wireframes.png")

W, H = 300, 650          # one phone, at flow-map proportions
GAP, PAD, HEAD = 40, 56, 200
INK, MUTED, PAPER = (26, 28, 32), (122, 128, 138), (247, 245, 242)
CARD, LINE, ACCENT = (255, 255, 255), (198, 192, 184), (140, 92, 118)
WIRE, WIRE_ON = (232, 229, 224), (206, 216, 203)

F_T = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 40)
F_S = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 21)
F_CAP = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 19)
F_H = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 17)
F_B = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 14)
F_TAB = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 12)
F_N = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 15)

SEGMENTS = ["WEEK", "SESSIONS", "SKILLS", "RULES"]

# Each panel: (active segment, [(kind, left, right)]). kind drives the drawing.
#   head  - a section label
#   row   - a line with something on the right
#   card  - a taller block
#   note  - muted explanatory text, no box
PANELS = {
    "WEEK": [
        ("head", "YOUR WEEK", ""),
        ("row", "Ballet", "1x/week"),
        ("row", "Rocket yoga", "1x/week"),
        ("row", "Running", "~5k/week"),
        ("row", "Walking", "Daily"),
        ("row", "Gym", "1x/week"),
        ("row", "Park / calisthenics", "When possible"),
        ("note", "A row opens its session. Nothing here is", ""),
        ("note", "marked done, missed or behind.", ""),
    ],
    "SESSIONS": [
        ("head", "SESSIONS", ""),
        ("card", "Gym", "Posterior chain, upper body"),
        ("card", "Park", "Pullups, bar work"),
        ("note", "The session is the thing you edit.", ""),
        ("note", "Week points at it. One Tuesday, not two.", ""),
        ("note", "", ""),
        ("note", "Exercises tick as you do them, inside", ""),
        ("note", "the session and nowhere else.", ""),
    ],
    "SKILLS": [
        ("head", "NOW", ""),
        ("row", "Pullup volume", "NOW"),
        ("row", "Wall handstand hold", "NOW"),
        ("head", "NEXT", ""),
        ("row", "High pullups", "NEXT"),
        ("note", "Needs: 5 strict pullups first", ""),
        ("head", "GOAL", ""),
        ("row", "Muscle up", "GOAL"),
        ("note", "No timeframes. Each rung links to the", ""),
        ("note", "session that trains it.", ""),
    ],
    "RULES": [
        ("card", "Why these exist", "The context note, in her words"),
        ("head", "NEVER", ""),
        ("row", "Heavy deadlifts or loaded squats", ""),
        ("row", "Hip thrusts at load", ""),
        ("head", "ALWAYS OK", ""),
        ("row", "Glute max and hamstring focus", ""),
        ("row", "Upper body, pull and push", ""),
        ("note", "A hard exclusion in generation, not only", ""),
        ("note", "a line in the prompt.", ""),
    ],
}


def panel(d, x, y, active):
    d.rounded_rectangle([x, y, x + W, y + H], 10, fill=CARD, outline=LINE, width=2)

    # The goals block, identical on every segment because it sits above them.
    gy = y + 18
    d.text((x + 16, gy), "WHAT YOU'RE WORKING TOWARDS", font=F_TAB, fill=ACCENT)
    for i, line in enumerate(["Hold muscle, lose fat slowly", "Get a muscle up"]):
        d.rounded_rectangle([x + 14, gy + 22 + i * 26, x + W - 14, gy + 42 + i * 26], 4, fill=WIRE)
        d.text((x + 22, gy + 25 + i * 26), line, font=F_B, fill=INK)

    # The segmented control.
    sy = gy + 82
    sw = (W - 28) // len(SEGMENTS)
    for i, seg in enumerate(SEGMENTS):
        on = seg == active
        sx = x + 14 + i * sw
        d.rounded_rectangle([sx, sy, sx + sw - 4, sy + 26], 5,
                            fill=WIRE_ON if on else WIRE)
        tw = d.textlength(seg, font=F_TAB)
        d.text((sx + (sw - 4 - tw) / 2, sy + 7), seg, font=F_TAB,
               fill=INK if on else MUTED)

    # The body.
    by = sy + 42
    for kind, left, right in PANELS[active]:
        if by > y + H - 24:
            break
        if kind == "head":
            d.text((x + 16, by), left, font=F_TAB, fill=ACCENT)
            by += 24
        elif kind == "row":
            d.rounded_rectangle([x + 14, by, x + W - 14, by + 30], 4, fill=WIRE)
            d.text((x + 22, by + 8), left, font=F_B, fill=INK)
            if right:
                tw = d.textlength(right, font=F_B)
                d.text((x + W - 22 - tw, by + 8), right, font=F_B, fill=MUTED)
            by += 36
        elif kind == "card":
            d.rounded_rectangle([x + 14, by, x + W - 14, by + 54], 6, fill=WIRE)
            d.text((x + 22, by + 10), left, font=F_H, fill=INK)
            d.text((x + 22, by + 32), right, font=F_B, fill=MUTED)
            by += 62
        else:
            if left:
                d.text((x + 16, by), left, font=F_B, fill=MUTED)
            by += 19

    d.text((x, y + H + 12), active.title(), font=F_CAP, fill=INK)


# ---- compose -------------------------------------------------------------
cols = 1 + len(SEGMENTS)
width = PAD * 2 + cols * W + (cols - 1) * GAP
height = PAD + HEAD + H + 120 + PAD

img = Image.new("RGB", (width, height), PAPER)
d = ImageDraw.Draw(img)

d.text((PAD, PAD), "Plans, as decided", font=F_T, fill=INK)
d.text((PAD, PAD + 56),
       "Left: the Plans tab as it is today, from the 28 September flow map. Right: the four segments from Ruth's session brief.",
       font=F_S, fill=MUTED)
d.text((PAD, PAD + 88),
       "Wireframes on purpose. The words are the part that matters; none of the layout is a design decision yet.",
       font=F_S, fill=MUTED)

y = PAD + HEAD

# The real screenshot, so the before and after sit at the same size.
shot = Image.open(os.path.join(SHOTS, "plans.png"))
shot = shot.resize((W, round(W * shot.height / shot.width)), Image.LANCZOS)
shot = shot.crop((0, 0, W, min(H, shot.height)))
img.paste(shot, (PAD, y))
d.rounded_rectangle([PAD, y, PAD + W, y + H], 10, outline=LINE, width=2)
d.text((PAD, y + H + 12), "Today", font=F_CAP, fill=INK)
d.text((PAD, y + H + 36), "The movement library and saved", font=F_N, fill=MUTED)
d.text((PAD, y + H + 56), "plans. No goals, no week, no", font=F_N, fill=MUTED)
d.text((PAD, y + H + 76), "skills, no rules.", font=F_N, fill=MUTED)

for i, seg in enumerate(SEGMENTS):
    panel(d, PAD + (i + 1) * (W + GAP), y, seg)

d.text((PAD, y + H + 108),
       "Goals sit above the control and show on every segment. Food targets stay on Today; supplements and skincare stay in Almanac > Me.",
       font=F_S, fill=MUTED)

img.save(OUT)
print(f"{OUT} ({img.width} x {img.height})")
