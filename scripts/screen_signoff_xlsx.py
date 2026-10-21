# EVERY SCREEN, FOR PRE-BETA SIGN-OFF.
#
#   python scripts/screen_signoff_xlsx.py
#
# Ruth, 21 October 2026: "let's make a list of all the screens in an excel and
# then I will go through each one and we can sign each one off, one at a time so
# we can be sure nothing was missed for final pre-beta round review."
#
# BUILT FROM THE ROUTER TREE, NOT FROM MEMORY. The screens below are checked
# against mobile/src/app every run: a route with no row here, or a row naming a
# route that no longer exists, stops the script. That is the whole point of a
# sign-off list - one missing screen is one nobody looked at.
#
# IT ALSO LISTS WHAT IS NOT A ROUTE. The Plans segments, the Now folds and the
# flower's dimension detail are screens to a person and files to nobody, so they
# are listed by hand and marked as such.

import os
import sys

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "mobile", "src", "app")
OUT = r"H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia - Screen Sign-off.xlsx"

# (area, screen, how you get there, route file or None when it is not a route)
SCREENS = [
    ("Tabs", "Chat", "The first tab. Opens on launch.", "(tabs)/index.tsx"),
    ("Tabs", "Log", "Second tab. A list of everything that can be recorded.", "(tabs)/log/index.tsx"),
    ("Tabs", "Now", "Middle tab. Today, and the three folds.", "(tabs)/now/index.tsx"),
    ("Tabs", "Plans", "Fourth tab.", "(tabs)/plans.tsx"),
    ("Tabs", "Me", "Fifth tab.", "(tabs)/me.tsx"),

    ("Plans", "Week", "Plans > Week segment.", None),
    ("Plans", "Sessions", "Plans > Sessions segment.", None),
    ("Plans", "Skills", "Plans > Skills segment.", None),
    ("Plans", "Rules", "Plans > Rules segment.", None),
    ("Plans", "What you are working towards", "Plans, above the segments. Shows on every segment.", None),

    ("Now", "Now overview", "Now tab. Greeting, Food/Body/Movement, approach, water.", None),
    ("Now", "Last week", "Now > Last week fold. Written by the Sunday roundup.", None),
    ("Now", "Coming up", "Now > Coming up fold. The diary.", None),
    ("Now", "What's protecting you", "Now > the flower fold.", None),
    ("Now", "A single dimension", "Now > tap a petal or a label on the flower.", "(tabs)/now/[dimension].tsx"),

    ("Log", "Food and drink", "Log > Food and drink.", "(tabs)/log/food-history.tsx"),
    ("Log", "Hydration", "Log > Hydration.", "(tabs)/log/water-history.tsx"),
    ("Log", "Sleep", "Log > Sleep.", "(tabs)/log/sleep.tsx"),
    ("Log", "How you felt", "Log > How you felt.", "(tabs)/log/feeling.tsx"),
    ("Log", "Cycle", "Log > Cycle.", "(tabs)/log/cycle.tsx"),
    ("Log", "A cycle day", "Log > Cycle > tap a day.", "(tabs)/log/cycle-day.tsx"),
    ("Log", "Body measurements", "Log > Body measurements.", "(tabs)/log/measurements.tsx"),
    ("Log", "Movement", "Log > Movement.", "(tabs)/log/activity-history.tsx"),

    ("Standalone", "Goal", "From the goal block on Plans, and from Settings.", "goal.tsx"),
    ("Standalone", "Health data", "From onboarding, and from Settings.", "health-data.tsx"),
    ("Standalone", "Look back", "From a weekly roundup.", "look-back.tsx"),

    ("Settings", "Settings", "The three seeds, top right of every screen.", "settings/index.tsx"),
    ("Settings", "Profile", "Settings > Profile.", "settings/profile.tsx"),
    ("Settings", "Activity level", "Settings > Activity level.", "settings/activity-level.tsx"),
    ("Settings", "Notifications", "Settings > Notifications.", "settings/notifications.tsx"),
    ("Settings", "Devices", "Settings > Devices.", "settings/devices.tsx"),
    ("Settings", "Tracking", "Settings > Tracking.", "settings/tracking.tsx"),
    ("Settings", "Body manual", "Settings > Body manual.", "settings/body-manual.tsx"),
    ("Settings", "Almanac", "Settings > Almanac.", "settings/almanac.tsx"),
    ("Settings", "Build a report", "Settings, and the links on Now and the log screens.", "settings/report.tsx"),
    ("Settings", "Your data", "Settings > Data.", "settings/data.tsx"),
    ("Settings", "Privacy", "Settings > Privacy.", "settings/privacy.tsx"),
    ("Settings", "About", "Settings > About.", "settings/about.tsx"),
    ("Settings", "Support", "Settings > Support.", "settings/support.tsx"),
    ("Settings", "Feedback", "Settings > Feedback.", "settings/feedback.tsx"),
    ("Settings", "Beta feedback", "Settings > Beta feedback. Beta testers only.", "settings/beta-feedback.tsx"),

    ("Onboarding", "Welcome", "First launch.", "onboarding/welcome.tsx"),
    ("Onboarding", "Intro", "Onboarding, after Welcome.", "onboarding/intro.tsx"),
    ("Onboarding", "Account", "Onboarding. Sign up or sign in.", "onboarding/account.tsx"),
    ("Onboarding", "Reset password", "From Account.", "onboarding/reset-password.tsx"),
    ("Onboarding", "Consent", "Onboarding.", "onboarding/consent.tsx"),
    ("Onboarding", "Life stage", "Onboarding.", "onboarding/life-stage.tsx"),
    ("Onboarding", "Goals", "Onboarding.", "onboarding/goals.tsx"),
    ("Onboarding", "Health context", "Onboarding.", "onboarding/health-context.tsx"),
    ("Onboarding", "Medication", "Onboarding.", "onboarding/medication.tsx"),
    ("Onboarding", "Allergies", "Onboarding.", "onboarding/allergies.tsx"),
    ("Onboarding", "Steer around", "Onboarding.", "onboarding/steer-around.tsx"),
    ("Onboarding", "Activity", "Onboarding.", "onboarding/activity.tsx"),
    ("Onboarding", "Activities", "Onboarding.", "onboarding/activities.tsx"),
    ("Onboarding", "Activity level", "Onboarding.", "onboarding/activity-level.tsx"),
    ("Onboarding", "Days", "Onboarding.", "onboarding/days.tsx"),
    ("Onboarding", "Equipment", "Onboarding.", "onboarding/equipment.tsx"),
    ("Onboarding", "Skill", "Onboarding.", "onboarding/skill.tsx"),
    ("Onboarding", "Nutrition", "Onboarding.", "onboarding/nutrition.tsx"),
    ("Onboarding", "Guidance", "Onboarding.", "onboarding/guidance.tsx"),
    ("Onboarding", "Technical", "Onboarding.", "onboarding/technical.tsx"),
    ("Onboarding", "First log", "Onboarding, the last step.", "onboarding/first-log.tsx"),
]

# Layout files are not screens.
IGNORE = {"_layout.tsx"}


def routes_on_disk():
    found = set()
    for base, _dirs, files in os.walk(APP):
        for f in files:
            if not f.endswith(".tsx") or f in IGNORE:
                continue
            rel = os.path.relpath(os.path.join(base, f), APP).replace(os.sep, "/")
            found.add(rel)
    return found


def main():
    on_disk = routes_on_disk()
    listed = {s[3] for s in SCREENS if s[3]}

    missing = sorted(on_disk - listed)
    phantom = sorted(listed - on_disk)
    if missing or phantom:
        if missing:
            print("ROUTES WITH NO ROW IN THE SIGN-OFF LIST:")
            for m in missing:
                print("  ", m)
        if phantom:
            print("ROWS NAMING A ROUTE THAT NO LONGER EXISTS:")
            for p in phantom:
                print("  ", p)
        print("\nAdd or remove rows in this script, then run it again.")
        sys.exit(1)

    # WHAT IS ALREADY SIGNED OFF SURVIVES A REGENERATION. The whole value of
    # this sheet is the ticks she has put in it, and a script that wipes them
    # every time it runs is a script nobody dares run.
    kept = {}
    if os.path.exists(OUT):
        old = load_workbook(OUT)
        if "Screens" in old.sheetnames:
            sheet = old["Screens"]
            for row in sheet.iter_rows(min_row=5, values_only=True):
                if row and row[1]:
                    kept[(row[0], row[1])] = (row[3], row[4], row[5])

    wb = Workbook()
    ws = wb.active
    ws.title = "Screens"

    ws["A1"] = "Selodia - every screen, for pre-beta sign-off"
    ws["A1"].font = Font(bold=True, size=13)
    ws["A2"] = (
        "Checked against the Expo Router tree every time this is rebuilt, so a new screen cannot "
        "quietly miss the list. Signed off means ready to show. Regenerate with "
        "python scripts/screen_signoff_xlsx.py - it keeps whatever is already ticked."
    )
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells("A2:F2")
    ws.row_dimensions[2].height = 32

    headers = ["Area", "Screen", "How you get there", "Signed off", "Date", "What still needs doing"]
    fill = PatternFill("solid", fgColor="E9D6C2")
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=4, column=i, value=h)
        c.font = Font(bold=True)
        c.fill = fill

    r = 5
    for area, screen, how, _route in SCREENS:
        ws.cell(row=r, column=1, value=area)
        ws.cell(row=r, column=2, value=screen)
        ws.cell(row=r, column=3, value=how).alignment = Alignment(wrap_text=True, vertical="top")
        prev = kept.get((area, screen))
        if prev:
            for col, val in zip((4, 5, 6), prev):
                if val:
                    ws.cell(row=r, column=col, value=val)
        r += 1

    for i, w in enumerate([15, 32, 50, 12, 14, 46], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A5"

    wb.save(OUT)
    print("wrote", OUT)
    print(len(SCREENS), "screens,", len(on_disk), "routes on disk, all accounted for")


if __name__ == "__main__":
    main()
