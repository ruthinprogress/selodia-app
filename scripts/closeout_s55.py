"""Append Session 55 to both sheets of the close-out workbook."""

import sys
from copy import copy

import openpyxl

BOOK = r"H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia-Session-Closeouts.xlsx"

CHECKLIST = [
    ("Per-reading delete restored on Measurements", "Done", "2026-09-26",
     "Four options built and shown as working screens, not drawings. She chose a mark per line plus a swipe on the day, then reversed it the same evening after living with it - see item 7 below."),
    ('Link wording: "Ask about or change this"', "Done", "2026-09-26",
     'Hers. "Edit" promises a form with fields and there is no form for a measurement anywhere in the app - the conversation is the only thing that writes one. "Change" promises only that it can be changed, which is true.'),
    ("Segmented control: selected panel drew square", "Done", "2026-09-26",
     "FOUR ATTEMPTS. The radius was never the fault: the panel had no background until selected, so Android built its drawable at selection without the corner radius. Any number would have been square. There is now one selected shape that only translates."),
    ("I verified a native bug on the web preview, three times", "Unresolved - process", "2026-09-26",
     "Clean pills on localhost, brick on her phone, and I reported it fixed twice. Then blamed her font scale, then blamed the update not landing, sending her to reopen the app for something that could not change. Written into DECISION_PATTERNS and into memory."),
    ("Thigh measurement acknowledged but never logged", "Done", "2026-09-26",
     "The classifier's intent list has no value for a waist or a thigh, and defined 'measurement' as a weight, body fat or muscle mass - so 'none' was the obedient answer, and 'none' runs no writer. The writer had handled thighs correctly all along. Guard now in code, not the prompt."),
    ("Nothing told her the thigh had not saved", "Done", "2026-09-26",
     "save-honesty.ts has a branch whose comment reads 'a weight saves while a waist does not'. It was dead code: the list it reads was initialised empty and never written to, anywhere. Built 27 August, one line short of working for a month."),
    ("Every message saved twice, voice and text", "Done", "2026-09-26",
     "Two faults. The app guarded on React state, stale within a tick, so two calls both passed. The server's duplicate check existed but ran only for voice. Both fixed; the server one now runs whatever the source."),
    ("25 existing duplicate rows", "Outstanding - needs her", "2026-09-26",
     "Identified (same person, role and words within 15 seconds) and copied to chat_messages_duplicates_removed. The delete was refused by this session's permission layer as a mass delete. Statement is in the summary for her to run."),
    ("Chat could not see measurement history", "Done", "2026-09-26",
     "It said it had one weight reading. Every prompt block is bounded by one context window - seven days typed, three spoken - which is right for food and wrong for a body. A separate 180-day block now carries scale readings and daily calories, summarised by week."),
    ("Screenshot logging said 'today' for another day's photo", "Done", "2026-09-26",
     "The route always read the date out of the image and checked that day. One hard-coded 'today' in the acknowledgment described the wrong day, which is why she could not argue with it. A different value on the same day now asks instead of ignoring."),
    ("Cycle day unlabelled, and possibly wrong", "Done", "2026-09-26",
     "It was right. Her period started on a Monday, so for that first week the cycle day and the weekday number are the same number - a coincidence with a cause. Now reads 'Cycle day 6', capped at 45 days, with a probe."),
    ("Today: value and unit split across lines", "Done", "2026-09-26",
     "'112g' and 'protein' were coming apart. Wrapping moved up a level, so whole pairs drop together. The reading date now sits at the end of its row."),
    ("Today: top-heavy, one large gap before the epigraph", "Done", "2026-09-26",
     "Greeting up from 32 to 38, heading block no longer pulled above the page inset, and the gaps computed from screen height rather than tuned on one handset."),
    ("Measurements: bins replaced by swipe", "Done", "2026-09-26",
     "Her reversal, same day, having used it: a bin on every reading plus one by the link put six delete controls on a five-reading day. Shared component generalised rather than forked."),
    ("Measurements: history rows name the metric; back arrow clear", "Done", "2026-09-26",
     "'Sat 26 . 25 cm' is a number to guess at. The back arrow gets the page-coloured disc the seeds mark has had since the 25th."),
    ("Voice: filler, repetition, reading her words back", "Done", "2026-09-26",
     "A filler phrase does not shorten a wait, it announces it. The block now carries the measurement rather than an instruction - 'Got it' 3% in August to 39% in September, in no prompt anywhere."),
    ("Voice offered to file a cold in the Almanac", "Done", "2026-09-26",
     "The prompt already said not to. Three-hour quiet period now enforced in code, on a new column - the existing one is cleared when an offer is answered, so it can only say 'is one waiting', never 'have I just asked'. Me cards exempt."),
    ("Undo for a deleted reading", "Done", "2026-09-26",
     "She lost Thu 24 Sept and re-entered it rounded from memory. The figures now travel out of the delete itself, so undo restores what was actually there. Ten seconds. A whole day keeps all of its readings, not the last one."),
    ("Soft delete and 7-day recovery", "Queued", "2026-09-26",
     "The rest of her item 8. Undo covers the wrong tap; this would cover the regret, and let the conversation restore Thursday's weight by name days later. Not built."),
    ("Thu 24 Sept original readings", "Unresolved", "2026-09-26",
     "Hard-deleted before any of this existed. The re-entered rounded values are what remains. Cannot be recovered."),
    ("Almanac > Me restructure to a record list", "Queued", "2026-09-26",
     "Her item 6, with a mockup for structure only - no illustrations, no watercolour. The largest remaining piece and not started."),
    ("selodia.app/terms returned 404", "Done - NEEDS LEGAL REVIEW", "2026-09-26",
     "Never existed: no route, no file, no commit in the whole history. /privacy, /support and /delete-account were all live. Written from the app rather than a template. Unreviewed and unlinked, same footing as the privacy policy."),
    ("Where the /terms expectation came from", "Unexplained", "2026-09-26",
     "Nothing in the app or landing page links to it, and she does not have Play Console yet. Flagged rather than guessed at."),
    ("Session 54 had no close-out", "Done", "2026-09-26",
     "Nothing failed. The ceremony's steps are automated; its trigger is a person saying the session is ending, and S54 never ended - she went to sleep and the work continued overnight into S55. 24 commits unrecorded, found by her noticing a file timestamp."),
    ("WORKFLOW: an overnight run IS a session close", "Done", "2026-09-26",
     "A pause is a pause when the WORK pauses too. When the human stops and the work accelerates is precisely when a record matters most, because nobody was watching it happen."),
    ("Three scale marks (weight, body fat, muscle)", "Queued", "2026-09-26",
     "She approved drawing them in the same family as the tape marks. Not started."),
    ("Botanical drawings: screenshot where each appears", "Queued", "2026-09-26",
     "She wants to see them in situ before deciding. Nothing deleted. Needs the bundler, which was unreliable all session."),
    ("Repeated-phrase probe over a 10-minute conversation", "Queued", "2026-09-26",
     "probe-reply-variety.mjs measures openers across stored replies; her ask is for repeats WITHIN one conversation. Extension not written."),
    ("Expo web bundler degradation", "Unresolved", "2026-09-26",
     "Still. 402s and 508s bundles again today. Carried from S54 with no more understanding of the cause than yesterday."),
    ("Almanac > Insights: two balance flowers", "On hold", "2026-09-26",
     "Her instruction: leave as is until the concept is decided."),
]

DECISIONS = [
    ("Draw the shape once, and move it", "2026-09-26",
     "On Android a background that arrives with a state change and a border radius do not reliably arrive together. A selected panel that takes its colour only when chosen gets its drawable built at that moment, without the radius. The fix is structural: one shape, created with a real colour and radius at mount, that never changes either and only translates. ChatGPT proposed a sliding capsule the same day for aesthetic reasons and was right for the wrong reason."),
    ("A closed list of intents discards what it has no name for", "2026-09-26",
     "The chat classifier picks one intent from a fixed list with no value for a waist or a thigh, and its description defined a measurement as the three scale readings. A thigh is outside that, so 'none' was obedient and 'none' runs nothing. It failed intermittently, which is worse, because a rule followed most of the time hides. The guard is now in code against her own tracked metric names - the model cannot talk its way out of it."),
    ("An undo that asks you to retype the number is not an undo", "2026-09-26",
     "Her words: 'users don't remember exact values (I re-entered from memory and rounded, so that day's record is now less accurate than the original)'. A body record rounded from memory is WORSE than one with a gap in it, because the gap is honest. So the figures travel out of the delete before anything is written."),
    ("A module built for a failure is not a module wired to it", "2026-09-26",
     "save-honesty.ts was written on 27 August after a waist and thigh log came back 'Got those down' having saved nothing. It carries a branch whose comment names that exact case. That branch was dead code for a month: the list it reads was initialised empty and never written to anywhere in the route. The comment made it look covered."),
    ("The close-out has steps but no trigger", "2026-09-26",
     "Automating the ceremony's steps made it feel automatic. It is not: it begins because a person says the session is ending, and step 6 requires four facts none of which is inferable. An overnight hand-over looks like a pause and is not one. Now written into WORKFLOW as its own rule."),
    ("A legal page can be missing rather than broken", "2026-09-26",
     "Asked to check whether /terms resolves, the useful answer was that it never existed - no route, no file, no commit in the entire history - rather than hunting for the fix that broke it. Worth stating plainly before writing anything, because the premise of the question was that something had been fixed and then lost."),
]


def main() -> int:
    wb = openpyxl.load_workbook(BOOK)
    check, dec = wb["Checklist"], wb["Decisions"]
    done_fill = copy(check.cell(479, 2).fill)
    header_font = copy(check.cell(477, 1).font)

    def append(ws, header, rows, status_col):
        r = ws.max_row + 1
        ws.cell(r, 1, header).font = copy(header_font)
        r += 1
        for row in rows:
            for c, value in enumerate(row, start=1):
                cell = ws.cell(r, c, value)
                if status_col and c == status_col and value in ("Done", "Diagnosed"):
                    cell.fill = copy(done_fill)
            r += 1

    append(check, "S55: 26Sep26  (11:40 start, travelling then home)", CHECKLIST, 2)
    append(dec, "S55: 26Sep26", DECISIONS, None)
    wb.save(BOOK)
    print(f"Checklist {check.max_row} rows, Decisions {dec.max_row} rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
