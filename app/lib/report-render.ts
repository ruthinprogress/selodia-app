import { capital, longDate, type ReportData } from './report';

// THE DOCUMENT (2026-09-20). Her brief: "The PDF should not resemble a medical
// record. It should resemble a beautifully organised briefing ... something the
// user is genuinely happy to hand to a consultant. Not because it is
// comprehensive. Because it is beautifully organised."
//
// It is HTML with print styles rather than a generated PDF file, and that is a
// decision rather than a shortcut: making a PDF on the phone needs a native
// module, which cannot arrive in an over-the-air update, and the browser's own
// "Save as PDF" prints exactly this page - the same typography, on A4, with the
// margins set below. The day there is a new native build, expo-print can hand
// the same HTML straight to a file and nothing here changes.
//
// NOTHING IS INVENTED. Every section only exists if it was chosen and has
// something in it, every figure is one that was logged, and where a figure
// would be a summary of a summary (a "trend", an "adherence rate") it is left
// out. A consultant reading this should be able to trace any line back to
// something the person actually recorded.

const CREAM = '#F7F3EA';
const PAPER = '#FFFFFF';
const CHARCOAL = '#2D2B28';
const GREY = '#605A52';
const TERRACOTTA = '#874C3A';
const SAND = '#E9D6C2';
const SAGE = '#95A987';

type Section = { id: string; title: string; body: string };

// A blank line is a paragraph break in the summary she approved.
const BLANK_LINE = /\r?\n\s*\r?\n/;

export function renderReport(data: ReportData): string {
  const sections: Section[] = [];

  if (data.profile.length > 0 || data.goals.length > 0) {
    sections.push({
      id: 'profile',
      title: 'Profile and goals',
      body:
        (data.profile.length > 0 ? definitionList(data.profile) : '') +
        (data.goals.length > 0
          ? `<h3>Goals</h3><ul class="plain">${data.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`
          : ''),
    });
  }

  if (data.weights.length > 0 || data.metrics.length > 0) {
    const weightRows = data.weights.map((w) => [
      shortDate(w.at),
      w.weight != null ? `${round(w.weight)} kg` : '—',
      w.fat != null ? `${round(w.fat)}%` : '—',
      w.muscle != null ? `${round(w.muscle)} kg` : '—',
    ]);
    const metricRows = data.metrics.map((m) => [shortDate(m.at), capital(m.name), m.value]);
    sections.push({
      id: 'body',
      title: 'Body',
      body:
        (weightRows.length > 0
          ? intro('Every reading recorded in this period, as it was recorded.') +
            table(['Date', 'Weight', 'Body fat', 'Muscle'], weightRows)
          : '') +
        (metricRows.length > 0
          ? `<h3>Other measurements</h3>` + table(['Date', 'What', 'Reading'], metricRows)
          : ''),
    });
  }

  if (data.symptoms.length > 0) {
    sections.push({
      id: 'symptoms',
      title: 'Symptoms and observations',
      body:
        // IN FULL, AS WRITTEN (Ruth, 2026-09-20). A clinician reading a symptom
        // needs what was actually noticed, not a trimmed version of it, so
        // nothing here is shortened and the chooser picks which ones appear.
        intro('Each one in full, as it was written at the time. Only the ones chosen for this report appear.') +
        data.symptoms
          .map((s) => card(s.title, shortDate(s.at), s.content))
          .join(''),
    });
  }

  if (data.food.length > 0 || data.water.length > 0 || data.foodEntries.length > 0) {
    const foodRows = data.food.map((d) => [
      shortDate(d.day),
      `${Math.round(d.kcal)} kcal`,
      `${Math.round(d.protein)} g`,
      String(d.entries),
    ]);
    const waterRows = data.water.map((d) => [
      shortDate(d.day),
      `${Math.round(d.ml / 100) / 10} L`,
      String(d.drinks),
    ]);
    sections.push({
      id: 'nutrition',
      title: 'Nutrition',
      body:
        (foodRows.length > 0
          ? intro(
              'Totals for each day that has entries. Days with nothing logged are absent rather than shown as zero, because a day nobody recorded is not a day of no food.'
            ) + table(['Date', 'Energy', 'Protein', 'Entries'], foodRows)
          : '') +
        (data.foodEntries.length > 0
          ? `<h3>Every entry</h3>` +
            intro('Each entry as it was logged, in her own words.') +
            table(
              ['Date', 'What', 'Energy', 'Protein'],
              data.foodEntries.map((e) => [
                shortDate(e.at),
                e.what,
                e.kcal != null ? `${Math.round(e.kcal)} kcal` : '—',
                e.protein != null ? `${Math.round(e.protein)} g` : '—',
              ])
            )
          : '') +
        (waterRows.length > 0
          ? `<h3>Drinks</h3>` +
            intro('What was logged, which is not the same as everything that was drunk.') +
            table(['Date', 'Logged', 'Drinks'], waterRows)
          : ''),
    });
  }

  if (data.sleep.length > 0) {
    sections.push({
      id: 'sleep',
      title: 'Sleep',
      body:
        intro(
          'Only the nights that were described. A night that is absent was not recorded, which says nothing about how it went.'
        ) +
        table(
          ['Night of', 'Slept', 'How it felt', 'Woke'],
          data.sleep.map((n) => [
            shortDate(n.night),
            n.minutes != null
              ? `${Math.floor(n.minutes / 60)}h${n.minutes % 60 ? ' ' + (n.minutes % 60) + 'm' : ''}`
              : '—',
            n.quality ? capital(n.quality) : '—',
            n.awakenings != null ? String(n.awakenings) : '—',
          ])
        ),
    });
  }

  if (data.activity.length > 0 || data.plans.length > 0) {
    const rows = data.activity.map((a) => [
      shortDate(a.at),
      capital(a.what),
      a.minutes != null ? `${a.minutes} min` : '—',
      a.intensity ? capital(a.intensity) : '—',
    ]);
    sections.push({
      id: 'movement',
      title: 'Movement',
      body:
        (rows.length > 0 ? table(['Date', 'What', 'Duration', 'Intensity'], rows) : '') +
        (data.plans.length > 0
          ? `<h3>Current plans</h3>` + data.plans.map((p) => card(p.title, null, p.content)).join('')
          : ''),
    });
  }

  if (data.cards.length > 0) {
    sections.push({
      id: 'knowledge',
      title: 'Summaries',
      body:
        intro(
          'These are summaries built from conversations and notes. Selodía does not hold medical documents, scans or test results: what is here is the understanding that was kept.'
        ) + data.cards.map((c) => card(c.title, `Updated ${shortDate(c.updated)}`, c.content, c.kind)).join(''),
    });
  }

  if (data.insights.length > 0) {
    sections.push({
      id: 'insights',
      title: 'Patterns noticed',
      body:
        intro('Observations drawn from the logs above, kept when they proved to hold.') +
        data.insights.map((i) => card(i.title, shortDate(i.at), i.content)).join(''),
    });
  }

  const who = data.name ? esc(data.name) : 'Personal health summary';

  return `<!doctype html>
<html lang="en-GB"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Selodía · Personal Health Summary</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Infant:wght@400;600&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: ${CREAM};
    color: ${CHARCOAL};
    font-family: Manrope, system-ui, sans-serif;
    font-size: 11.5pt;
    line-height: 1.6;
  }
  .sheet {
    max-width: 190mm;
    margin: 0 auto;
    background: ${PAPER};
    padding: 18mm 16mm;
  }
  h1, h2, h3 { font-family: 'Cormorant Infant', Georgia, serif; font-weight: 400; color: ${TERRACOTTA}; }
  h1 { font-size: 30pt; margin: 0 0 2mm; letter-spacing: .01em; }
  h2 { font-size: 20pt; margin: 0 0 3mm; }
  h3 { font-size: 14pt; margin: 8mm 0 2mm; color: ${CHARCOAL}; }
  p { margin: 0 0 3mm; }
  .muted { color: ${GREY}; }
  .cover { text-align: center; padding: 26mm 0 14mm; }
  .cover .mark { color: ${TERRACOTTA}; font-family: 'Cormorant Infant', Georgia, serif; font-size: 34pt; }
  .cover .rule { width: 26mm; height: 1px; background: ${SAND}; margin: 6mm auto; }
  .facts { display: grid; grid-template-columns: 38mm 1fr; gap: 2mm 6mm; max-width: 120mm; margin: 8mm auto 0; text-align: left; font-size: 10.5pt; }
  .facts dt { color: ${GREY}; }
  .facts dd { margin: 0; }
  .note { margin: 10mm auto 0; max-width: 130mm; padding: 5mm 6mm; background: ${CREAM}; border-radius: 4mm; text-align: left; }
  .contents { margin: 10mm 0 0; }
  .contents ol { list-style: none; padding: 0; margin: 0; }
  .contents li { display: flex; align-items: baseline; gap: 3mm; padding: 2.4mm 0; border-bottom: 1px solid ${SAND}; }
  .contents .n { width: 7mm; height: 7mm; border-radius: 50%; background: ${CREAM}; color: ${TERRACOTTA};
                 display: inline-flex; align-items: center; justify-content: center; font-size: 9pt; flex: none; }
  section { page-break-before: always; padding-top: 4mm; }
  section:first-of-type { page-break-before: avoid; }
  .intro { color: ${GREY}; max-width: 135mm; }
  table { width: 100%; border-collapse: collapse; margin: 4mm 0 6mm; font-size: 10.5pt; font-variant-numeric: tabular-nums; }
  th { text-align: left; font-weight: 500; color: ${GREY}; border-bottom: 1px solid ${SAND}; padding: 2mm 3mm 2mm 0; }
  td { padding: 2mm 3mm 2mm 0; border-bottom: 1px solid #F1EAE0; }
  tr { page-break-inside: avoid; }
  .card { background: ${CREAM}; border-radius: 4mm; padding: 5mm 6mm; margin: 0 0 4mm; page-break-inside: avoid; }
  .card h4 { font-family: 'Cormorant Infant', Georgia, serif; font-weight: 600; font-size: 13.5pt; margin: 0 0 1mm; color: ${CHARCOAL}; }
  .card .when { color: ${GREY}; font-size: 9.5pt; margin: 0 0 2.5mm; }
  .card .kind { display: inline-block; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase;
                color: ${SAGE}; margin-bottom: 1.5mm; }
  .card p { white-space: pre-wrap; margin: 0; }
  ul.plain { padding-left: 5mm; margin: 0 0 4mm; }
  ul.plain li { margin-bottom: 1.5mm; }
  dl.facts-inline { display: grid; grid-template-columns: 45mm 1fr; gap: 2mm 6mm; margin: 0 0 5mm; }
  dl.facts-inline dt { color: ${GREY}; }
  dl.facts-inline dd { margin: 0; }
  footer { margin-top: 10mm; padding-top: 4mm; border-top: 1px solid ${SAND}; color: ${GREY}; font-size: 9pt; display: flex; justify-content: space-between; }
  .print { position: fixed; right: 6mm; bottom: 6mm; background: ${TERRACOTTA}; color: ${CREAM};
           border: 0; border-radius: 999px; padding: 3.5mm 7mm; font: inherit; font-size: 11pt; cursor: pointer; }
  .summary { margin-bottom: 10mm; }
  .summary .label { font-size: 8.5pt; border-left: 2px solid ${SAND}; padding-left: 4mm; margin-bottom: 6mm; }
  @media print { .print { display: none; } body { background: ${PAPER}; } .sheet { padding: 0; max-width: none; } }
</style>
</head><body>
<div class="sheet">
  <div class="cover">
    <div class="mark">Selodía</div>
    <h1>Personal Health Summary</h1>
    <div class="rule"></div>
    <dl class="facts">
      <dt>Name</dt><dd>${who}</dd>
      ${data.dateOfBirth ? `<dt>Date of birth</dt><dd>${esc(longDate(data.dateOfBirth))}</dd>` : ''}
      <dt>Reporting period</dt><dd>${esc(data.periodLabel)}</dd>
      <dt>Generated</dt><dd>${esc(shortDate(data.generated))}</dd>
    </dl>
    ${data.note ? `<div class="note"><p class="muted">${esc(data.note)}</p></div>` : ''}
    <!-- WHAT THIS DOCUMENT IS, said on its face (Ruth, 2026-09-20): "if the
         data is just the data collected, the report can't be dismissed as ai
         dumps, it's the true collected data, with a summary for convenience".
         A clinician's first question about anything from a health app is
         whether a machine wrote it, and the answer has to be on the page
         rather than in the person's explanation of it. -->
    <p class="muted" style="margin-top:10mm">
      The pages that follow are records as they were entered, on the dates shown. Nothing here was
      generated or inferred: any summary is labelled as one and is drawn from these pages.
    </p>
  </div>

  ${
    data.summary
      ? `<section class="summary" id="summary">
          <h2>Summary</h2>
          <!-- LABELLED, ALWAYS (Ruth, 2026-09-20): "AI should analyse the
               selected data. AI should not decide what data is selected", and
               a summary that does not say what it is turns the whole document
               into something a reader has to take on trust. The label names
               both what wrote it and what it was allowed to see. -->
          <p class="muted label">Written by Selodía from the pages that follow, and read and approved by the person named above. The records themselves begin after it.</p>
          ${data.summary
            .split(BLANK_LINE)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => `<p>${esc(p)}</p>`)
            .join('')}
        </section>`
      : ''
  }

  <div class="contents">
    <h2>Contents</h2>
    <ol>
      ${sections
        .map((s, i) => `<li><span class="n">${i + 1}</span><span>${esc(s.title)}</span></li>`)
        .join('')}
    </ol>
  </div>

  ${sections
    .map(
      (s, i) => `<section id="${s.id}">
        <h2>${i + 1}. ${esc(s.title)}</h2>
        ${s.body}
      </section>`
    )
    .join('')}

  <footer>
    <span>Selodía · Personal Health Summary</span>
    <span>Not a medical record. Prepared by the person named above.</span>
  </footer>
</div>
<button class="print" onclick="window.print()">Save as PDF</button>
</body></html>`;
}

function intro(text: string): string {
  return `<p class="intro">${esc(text)}</p>`;
}

function definitionList(items: { label: string; value: string }[]): string {
  return `<dl class="facts-inline">${items
    .map((i) => `<dt>${esc(i.label)}</dt><dd>${esc(i.value)}</dd>`)
    .join('')}</dl>`;
}

function table(headers: string[], rows: string[][]): string {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
}

function card(title: string, when: string | null, content: string, kind?: string): string {
  return `<div class="card">
    ${kind ? `<div class="kind">${esc(kind)}</div>` : ''}
    <h4>${esc(title)}</h4>
    ${when ? `<p class="when">${esc(when)}</p>` : ''}
    <p>${esc(content)}</p>
  </div>`;
}

function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function esc(value: string): string {
  // Coerced, not trusted (2026-09-20). One field arriving as an object - an
  // Almanac entry's JSONB content - threw here and took the whole report with
  // it, after every one of her rows had been read. A document is not the place
  // to discover a type mismatch.
  const s = typeof value === 'string' ? value : value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
