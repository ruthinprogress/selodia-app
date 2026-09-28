"""Append Session 57's third queue to both sheets of the close-out workbook.

A third block under the same session, for the same reason as the second: 57 is
one day, and a workbook inventing S57a, S57b and S57c would make the run of
session numbers stop meaning anything.
"""

import sys
from copy import copy

import openpyxl

BOOK = r"H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia-Session-Closeouts.xlsx"

CHECKLIST = [
    ("Parallel voice calls, live", "Done", "2026-09-28",
     "A spoken turn starts writing its reply at the same moment it classifies. The guess held on 9 of 9 probe turns and the classify call has left the critical path entirely. Discarded whole when wrong - a reply missing the one thing she needed to know is the failure the rebuild exists to prevent. Voice only; typed turns keep the pause with a typing indicator in it."),
    ("And it did not reach 3.3s", "Diagnosed - her call", "2026-09-28",
     "Median 6.3s across nine turns. Phase timings say why and it is not the thing that was fixed: the reply WRITER alone takes 2.9-6.6s, longer than the entire old path. Parallelism removed the smaller call from the sum and cannot make the larger one faster. One lever left - stream the reply from the moment the saves confirm, worth ~1.9s - and it changes the ask-selodia contract the phone also consumes. Not done unasked on the same day as the last one."),
    ("What the parallel call costs", "Done", "2026-09-28",
     "Nothing on the turns where the guess holds: the speculative call IS the reply. 0.337c when discarded, +19% of that turn. The nine probe turns were all questions, which flatters it - a turn that logs food is exactly the kind that discards. The rate is now logged per turn rather than guessed."),

    ("The email claim: no test, not a wrong test", "Answered", "2026-09-28",
     "She asked which it was. Neither. There was no check behind the sentence at all - an inference written into a decision document as a finding, hedged with 'as far as I can tell', which reads as diligence while doing none of the work. The MX records are public and name the provider. Her own subscriptions sheet, open that same afternoon, carries the line for the mailbox and notes it as the recovery address for four other services. Recorded in DECISION_PATTERNS.md beside the curl one."),

    ("Company particulars into every legal document", "Done", "2026-09-28",
     "Selodia Ltd, 19 Campbell Road, London, E17 6RR, company number 12246794. Beta agreement, DPIA, Legal folder - and the public privacy policy and terms, which named the company and stopped there where the Companies Act and the E-Commerce Regulations want the number, the place of registration and the registered office."),
    ("The privacy page's UPDATED deliberately not bumped", "Decided", "2026-09-28",
     "That field re-asks every existing user to confirm their consent. Statutory particulars change neither what is collected nor who sees it, and making the whole userbase re-consent to learn Selodia's postcode is the wrong trade. Written into the file so nobody tidies it later."),
    ("The agreement's version date, derived not typed", "Done", "2026-09-28",
     "Her rule is the day it is first shown to a tester. scripts/beta-agreement-date.mjs reads it from the earliest grant in beta_members. THE FIRST RUN DATED IT FROM HER OWN GRANT, made that morning so she could see the feedback screen - she is in the beta and has never been shown the agreement, and they are not the same fact. The founder is now excluded and why is at the top of the script."),

    ("International transfer mechanism: both have one", "Done - blocker closed", "2026-09-28",
     "Anthropic: EU SCCs Module Two at I.1 plus the UK Addendum at Schedule 3 B, incorporated by the Commercial Terms with no form to sign. ElevenLabs: SCCs at 11.1, UK Addendum completed at 11.4, deemed executed. Read from the processors' own documents. Two things left as UNKNOWN rather than guessed: Data Privacy Framework certification with the UK Extension, and a transfer risk assessment, which is a solicitor's job."),
    ("A breach-response procedure", "Done - blocker closed", "2026-09-28",
     "docs/breach-response.md and the Legal folder. What counts and what does not, the first hour, the 72-hour clock which starts at AWARENESS rather than at understanding, when the people affected are told, the contacts. Nobody reads a procedure for the first time while that clock is running. Wave one is down from four blockers to two, both hers."),

    ("Pricing: competitors, overheads, a founding rate", "Done - her decision", "2026-09-28",
     "GBP 9/month and GBP 79/year recommended, with a founding rate of GBP 6 / GBP 59 kept for good. Round numbers, no .99. She was right that GBP 7 was too low and the overheads table is why: model cost per user is FLAT at GBP 2.12 from a hundred users to ten thousand, and the company's own ~GBP 1,150 a year is not - spread over 25 subscribers it is GBP 3.83 a head a month. Nothing comparable sells under GBP 45 a year except MyFitnessPal; Balance+, same audience, is GBP 89.99. Break-even on overheads alone at GBP 9: about 19 subscribers held for a year."),
    ("The waiting list, treated as empty", "Done", "2026-09-28",
     "Fiona is her sister. Both planning documents now say the landing-page list is the route that keeps working AFTER wave one and not a source for it. Which leaves route 1: ask each of Lynda, Carol, Nikki and Auguste for two names."),

    ("Cost per user is counted, not modelled", "Done", "2026-09-28",
     "The costing document's own highest-value item. model_usage takes a row per call with the tokens AND the cost priced at the rates of the day - both, because a table storing only tokens would silently re-price last quarter whenever a rate changes. Classify, the writer on BOTH outcomes, and the three Haiku parses. Not counted and said so: the allergy gate's layer 4 and the report writer. Eight checks on the arithmetic, each proved able to fail."),
    ("And it wrote nothing the first time", "Fixed", "2026-09-28",
     "A fire-and-forget insert in a serverless function is not forgotten, it is killed: the instance is entitled to freeze the moment the response is sent. after() fixes it. Third time in two days that the code was right about what it asked for and wrong about the machinery underneath - and all three returned success."),
    ("The build log's --continue, and the bug in it", "Done", "2026-09-28",
     "A session that runs all day gets one entry appended to, not S57a and S57b. The script had no way to say that, so the second queue went in by hand - and hand steps in that file are what cost nine sessions. The first version of --continue matched the CONTENTS line for Session 57 rather than the body header and put five paragraphs into the table of contents. Both now match the body's one-space separator, which rebuild_contents already relied on."),
]

DECISIONS = [
    ("A derived value is only as good as the fact it is derived from", "2026-09-28",
     "The agreement's version date is 'the day it was first shown to a tester', so rather than let somebody type it in weeks later I read it from the earliest row in beta_members. The reasoning is right and the script was wrong, because the earliest grant was hers - made that morning so she could see the feedback screen. 'Who is in the beta' and 'who has been shown the agreement' are different facts that overlap almost completely, and the founder is the one row where they come apart. The question that would have caught it: name the rows where the proxy and the fact disagree, before trusting the proxy."),
    ("A silent success is the signature of an environment assumption", "2026-09-28",
     "Three bugs in two days, same shape. A curl POST returned 200 and wrote nothing. A latency probe printed a median from a fixture describing an impossible turn. A cost table recorded nothing because the write was started and not awaited, and a serverless instance freezes when the response is sent. In each the code was correct about what it asked for and wrong about the environment it asked in - and NONE OF THEM FAILED LOUDLY. That is the failure mode testing the code cannot catch, because the code did what it said. The check that works asks the other system what it saw: read the table, open the page, look at the row."),
    ("The sentinel in a can-this-test-fail check has to be outside every legitimate answer", "2026-09-28",
     "The pricing function's eight checks end by running all eight against a deliberately broken pricer, and refusing to pass unless all eight fail. The first version broke it by returning 0 - and one case is 'a call that did nothing costs nothing', which legitimately expects 0, so it passed against the broken pricer and the guard correctly refused. The general form: whatever you break the implementation with must be outside the range of every honest answer, or you quietly exempt whichever case sits on the boundary. And boundary cases are the ones most worth checking."),
    ("Running cost per user and company cost per user are different questions", "2026-09-28",
     "The first costing document answered the first and presented it as the answer to the second. Model cost per user is flat from a hundred users to ten thousand, which reads as reassuring. The company's own overheads are the opposite of flat: about GBP 1,150 a year is 46 pence a head at 200 subscribers and GBP 3.83 at 25, and the first year is spent at the wrong end of that. She reached the conclusion by instinct - 'GBP 7 feels too low once company costs are included' - before the document could show it, which is the tell that the document was answering a narrower question than the one being asked."),
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
                if status_col and c == status_col and value.startswith(("Done", "Fixed", "Answered", "Decided", "Diagnosed")):
                    cell.fill = copy(done_fill)
            r += 1

    append(check, "S57 continued: 28Sep26  (evening queue)", CHECKLIST, 2)
    append(dec, "S57 continued: 28Sep26  (evening)", DECISIONS, None)
    wb.save(BOOK)
    print(f"Checklist {check.max_row} rows, Decisions {dec.max_row} rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
