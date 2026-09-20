import { LOCKUP_INNER, LOCKUP_VIEWBOX, MARK_INNER, MARK_VIEWBOX } from './brand/marks';
import { capital, longDate, type ReportData } from './report';

// THE DOCUMENT (redesigned 20 September 2026, to her brief).
//
// She tested the first one and said what it was: "I tested the Report builder -
// it's ok. Thats why i need the UI pass." The chooser worked; the thing it
// produced did not look like something anybody would hand to a consultant.
//
// Her brief set the register: "somewhere between Apple Health, Monocle
// magazine, a private medical clinic, and a beautifully designed annual
// report", suitable for a GP, a consultant, a physiotherapist, a solicitor or
// an insurer "without feeling like a fitness app". And the line that decides
// every other question on the page:
//
//   "The report should allow the user's data to speak for itself. AI is used
//   only to organise, summarise, and explain the selected information. It
//   should never exaggerate, speculate, diagnose, or infer relationships that
//   are not supported by the underlying data."
//
// BRANDING IS A WATERMARK, NOT A MASTHEAD. Her instruction: a faint seedmark at
// 3-5%, a small mark and wordmark, a page number, a report id, a date. "No
// large logos. No splash pages. No promotional messaging. The report belongs to
// the user." So the marks below are the real outlined files from the asset pack
// rather than anything redrawn, used small.
//
// IT IS PAGINATED IN THE BROWSER, WHICH IS THE ONLY WAY TO KEEP THE PROMISE.
// The brief asks for a header and a footer on every page, a page number, and
// "every section begins on a new page" - and a browser printing a long scroll
// gives none of that: CSS page margin boxes, where page numbers would live, are
// not implemented by any browser this will meet. So the content is emitted as
// blocks, each one shorter than a page by construction, and packed into real
// A4 sheets on load. Each sheet is then a page, with its own header, footer,
// watermark and number. Without JavaScript it degrades to one honest flow with
// a repeating footer, which is what it was before.

// Her palette, from the brief.
const PAPER = '#F8F5EF';
const CHARCOAL = '#2D2B28';
const GREY = '#6B645B';
const FAINT = '#9A9188';
const TERRACOTTA = '#BA7256';
const SAND = '#E4D7C5';
const RULE = '#E7DFD3';

const BLANK_LINE = /\r?\n\s*\r?\n/;

/** Rows per table chunk. Chosen so no single block can be taller than a page. */
const ROWS_PER_BLOCK = 18;

type Block = string;
type Section = { id: string; title: string; blocks: Block[] };

export function renderReport(data: ReportData): string {
  const sections: Section[] = [];

  // ---- 1. Summary -------------------------------------------------------
  // First because it is what a busy reader reads, and because her mock puts it
  // there. The figures in it are the app's own count; the prose states none.
  if (data.glance?.length || data.summary) {
    const blocks: Block[] = [];
    const cards = glanceCards(data);
    if (cards) blocks.push(cards);
    if (data.glance?.length) {
      blocks.push(
        `<div class="panel"><h3>Key points</h3><ul class="points">${data.glance
          .map((l) => `<li>${esc(l)}</li>`)
          .join('')}</ul></div>`
      );
    }
    if (data.summary) {
      blocks.push(
        `<p class="note-line">Written by Selodía from the pages that follow, and read and approved by the person named above. It states no figures of its own: the figures are the ones above.</p>` +
          data.summary
            .split(BLANK_LINE)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => `<p>${esc(p)}</p>`)
            .join('')
      );
    }
    sections.push({ id: 'summary', title: 'Summary', blocks });
  }

  // ---- 2. Symptoms, as a timeline --------------------------------------
  if (data.symptoms.length > 0) {
    const blocks: Block[] = [
      intro('Each one in full, as it was written at the time. Only the ones chosen for this report appear.'),
    ];
    // A TIMELINE, NOT A STACK OF CARDS. Her brief asks for one, and it is the
    // right shape: what a clinician reads a symptom history FOR is the order
    // and the spacing of it, which a list of boxes hides.
    for (const s of data.symptoms) {
      blocks.push(
        `<div class="tl"><div class="tl-date">${esc(shortDate(s.at))}</div>` +
          `<div class="tl-body"><h4>${esc(s.title)}</h4><p>${esc(s.content)}</p></div></div>`
      );
    }
    sections.push({ id: 'symptoms', title: 'Symptoms and observations', blocks });
  }

  // ---- 3. Body ----------------------------------------------------------
  if (data.weights.length > 0 || data.metrics.length > 0) {
    const blocks: Block[] = [];
    if (data.weights.length > 0) {
      blocks.push(intro('Every reading recorded in this period, as it was recorded.'));
      blocks.push(...tableBlocks(['Date', 'Weight', 'Body fat', 'Muscle'], data.weights.map((w) => [
        shortDate(w.at),
        w.weight != null ? `${round(w.weight)} kg` : '—',
        w.fat != null ? `${round(w.fat)}%` : '—',
        w.muscle != null ? `${round(w.muscle)} kg` : '—',
      ])));
      const trends = trendPanels(data);
      if (trends) blocks.push(trends);
    }
    if (data.metrics.length > 0) {
      blocks.push(`<h3>Other measurements</h3>`);
      blocks.push(...tableBlocks(['Date', 'What', 'Reading'], data.metrics.map((m) => [
        shortDate(m.at),
        capital(m.name),
        m.value,
      ])));
    }
    sections.push({ id: 'body', title: 'Body measurements', blocks });
  }

  // ---- 4. Nutrition and drinks -----------------------------------------
  if (data.food.length > 0 || data.water.length > 0 || data.foodEntries.length > 0) {
    const blocks: Block[] = [];
    if (data.food.length > 0) {
      blocks.push(
        intro(
          'Totals for each day that has entries. Days with nothing logged are absent rather than shown as zero, because a day nobody recorded is not a day of no food.'
        )
      );
      blocks.push(...tableBlocks(['Date', 'Energy', 'Protein', 'Entries'], data.food.map((d) => [
        shortDate(d.day),
        `${Math.round(d.kcal)} kcal`,
        `${Math.round(d.protein)} g`,
        String(d.entries),
      ])));
    }
    if (data.foodEntries.length > 0) {
      blocks.push(`<h3>Every entry</h3>`);
      blocks.push(intro('Each entry as it was logged, in the words it was logged in.'));
      blocks.push(...tableBlocks(['Date', 'What', 'Energy', 'Protein'], data.foodEntries.map((e) => [
        shortDate(e.at),
        e.what,
        e.kcal != null ? `${Math.round(e.kcal)} kcal` : '—',
        e.protein != null ? `${Math.round(e.protein)} g` : '—',
      ])));
    }
    if (data.water.length > 0) {
      blocks.push(`<h3>Drinks</h3>`);
      blocks.push(intro('What was logged, which is not the same as everything that was drunk.'));
      blocks.push(...tableBlocks(['Date', 'Logged', 'Drinks'], data.water.map((d) => [
        shortDate(d.day),
        `${Math.round(d.ml / 100) / 10} L`,
        String(d.drinks),
      ])));
    }
    sections.push({ id: 'nutrition', title: 'Nutrition and drinks', blocks });
  }

  // ---- 5. Sleep ---------------------------------------------------------
  if (data.sleep.length > 0) {
    sections.push({
      id: 'sleep',
      title: 'Sleep',
      blocks: [
        intro(
          'Only the nights that were described. A night that is absent was not recorded, which says nothing about how it went.'
        ),
        ...tableBlocks(['Night of', 'Slept', 'How it felt', 'Woke'], data.sleep.map((n) => [
          shortDate(n.night),
          n.minutes != null
            ? `${Math.floor(n.minutes / 60)}h${n.minutes % 60 ? ' ' + (n.minutes % 60) + 'm' : ''}`
            : '—',
          n.quality ? capital(n.quality) : '—',
          n.awakenings != null ? String(n.awakenings) : '—',
        ])),
      ],
    });
  }

  // ---- 6. Movement ------------------------------------------------------
  if (data.activity.length > 0 || data.plans.length > 0) {
    const blocks: Block[] = [];
    if (data.activity.length > 0) {
      blocks.push(...tableBlocks(['Date', 'What', 'Duration', 'Intensity'], data.activity.map((a) => [
        shortDate(a.at),
        capital(a.what),
        a.minutes != null ? `${a.minutes} min` : '—',
        a.intensity ? capital(a.intensity) : '—',
      ])));
    }
    if (data.plans.length > 0) {
      blocks.push(`<h3>Current plans</h3>`);
      for (const p of data.plans) blocks.push(panel(p.title, null, p.content));
    }
    sections.push({ id: 'movement', title: 'Movement', blocks });
  }

  // ---- 7. Patterns ------------------------------------------------------
  if (data.insights.length > 0) {
    const blocks: Block[] = [intro('Observations drawn from the logs above, kept when they proved to hold.')];
    for (const i of data.insights) blocks.push(panel(i.title, shortDate(i.at), i.content));
    sections.push({ id: 'insights', title: 'Patterns noticed', blocks });
  }

  // ---- 8. Records kept --------------------------------------------------
  if (data.cards.length > 0) {
    const blocks: Block[] = [
      intro(
        'Records kept from conversations, notes and documents that were read. Selodía does not hold the documents themselves: what is here is the record that was made and agreed.'
      ),
    ];
    for (const c of data.cards) blocks.push(panel(c.title, `Updated ${shortDate(c.updated)}`, c.content, c.kind));
    sections.push({ id: 'knowledge', title: 'Records kept', blocks });
  }

  // ---- 9. Profile and goals, last ---------------------------------------
  // Last rather than first: a consultant wants the findings, and the height and
  // activity level are reference material behind them.
  if (data.profile.length > 0 || data.goals.length > 0) {
    const blocks: Block[] = [];
    if (data.profile.length > 0) blocks.push(definitionList(data.profile));
    if (data.goals.length > 0) {
      blocks.push(`<h3>Goals</h3><ul class="points">${data.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`);
    }
    sections.push({ id: 'profile', title: 'Profile and goals', blocks });
  }

  const id = data.reportId ?? '';
  const generated = shortDate(data.generated);
  const person = data.name ? esc(data.name) : 'This report';
  const runner = `${data.name ? esc(shortName(data.name)) : 'Personal health summary'} · ${esc(data.periodLabel)}`;

  const flow = [
    // The cover is its own sheet and takes no header.
    `<div class="blk cover" data-sheet="cover">${cover(data, generated)}</div>`,
    `<div class="blk" data-break="page"><h2 class="contents-h">Contents</h2>` +
      `<p class="lead">Only the sections you chose are included in this report.</p>` +
      `<ol class="contents">${sections
        .map((s, i) => `<li data-ref="${s.id}"><span class="n">${i + 1}</span><span class="t">${esc(s.title)}</span><span class="p"></span></li>`)
        .join('')}</ol>` +
      `<div class="callout">${markSvg(14)}<p>This report was created from your Selodía data. It includes only the information you selected.</p></div></div>`,
    ...sections.flatMap((s, i) => [
      `<div class="blk" data-break="page" data-section="${s.id}"><h2><span class="num">${i + 1}.</span> ${esc(s.title)}</h2></div>`,
      ...s.blocks.map((b) => `<div class="blk">${b}</div>`),
    ]),
  ].join('');

  return `<!doctype html>
<html lang="en-GB"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Selodía · Health Summary</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Infant:wght@300;400;500;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --paper: ${PAPER};
    --ink: ${CHARCOAL};
    --grey: ${GREY};
    --faint: ${FAINT};
    --terracotta: ${TERRACOTTA};
    --sand: ${SAND};
    --rule: ${RULE};
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #EFE9E0;
    color: var(--ink);
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  /* A SHEET IS A PAGE. 210 x 297, with the margins the brief's generous white
     space needs, and everything positioned against it. */
  .sheet {
    position: relative;
    width: 210mm;
    height: 297mm;
    margin: 0 auto 8mm;
    padding: 14mm 20mm 12mm;
    background: var(--paper);
    box-shadow: 0 1px 3px rgba(45,43,40,.10), 0 10px 30px rgba(45,43,40,.06);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .sheet-head {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 4mm; border-bottom: 0.4pt solid var(--rule);
    flex: 0 0 auto;
  }
  /* The box is given the lockup's own proportion (883.73 / 402.89), so the box
     and the drawing are the same thing and "how big is the mark" has one
     answer rather than two. */
  .sheet-head .lockup { height: 9mm; width: 19.7mm; display: block; flex: 0 0 auto; }
  .sheet-head .who { font-size: 7.6pt; color: var(--grey); letter-spacing: .02em; }
  .sheet-body { flex: 1 1 auto; padding-top: 7mm; overflow: hidden; }
  .sheet-foot {
    flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
    padding-top: 3.5mm; border-top: 0.4pt solid var(--rule);
    font-size: 7pt; color: var(--faint); letter-spacing: .02em;
  }
  .sheet-foot .tagline { font-family: 'Cormorant Infant', Georgia, serif; font-style: italic; font-size: 8.4pt; }
  .sheet-foot .meta { display: flex; align-items: center; gap: 4mm; }
  .sheet-foot .seed { width: 3mm; height: 3mm; opacity: .5; }

  /* THE WATERMARK. Her figure: 3-5%. Behind everything, clipped by the sheet. */
  .wm {
    position: absolute; right: -34mm; bottom: -30mm;
    width: 150mm; height: 150mm; opacity: .04; pointer-events: none; z-index: 0;
  }
  .sheet-head, .sheet-body, .sheet-foot { position: relative; z-index: 1; }

  /* ---- Type ---------------------------------------------------------- */
  h2, h3, h4 { font-family: 'Cormorant Infant', Georgia, serif; font-weight: 400; color: var(--ink); }
  h2 { font-size: 26pt; line-height: 1.1; margin: 0 0 2mm; letter-spacing: -.01em; }
  h2 .num { color: var(--terracotta); }
  h3 { font-size: 14pt; margin: 8mm 0 2.5mm; }
  h4 { font-size: 11.5pt; margin: 0 0 1mm; }
  p { margin: 0 0 3mm; }
  .lead { color: var(--grey); margin-bottom: 6mm; max-width: 130mm; }
  .intro { color: var(--grey); font-size: 9pt; max-width: 130mm; margin-bottom: 4mm; }
  .note-line {
    font-size: 8pt; color: var(--grey); border-left: 1.2pt solid var(--sand);
    padding-left: 3.5mm; margin: 5mm 0 4mm; max-width: 130mm;
  }
  .points { margin: 0; padding-left: 4.5mm; }
  .points li { margin-bottom: 1.8mm; }
  .points li::marker { color: var(--terracotta); }

  /* ---- Cover --------------------------------------------------------- */
  .cover-wrap { display: flex; flex-direction: column; height: 100%; }
  .cover-mark { height: 13mm; width: 28.5mm; align-self: flex-start; margin-bottom: 30mm; }
  .cover-eyebrow { font-size: 7.6pt; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); margin-bottom: 2mm; }
  .cover h1 { font-family: 'Cormorant Infant', Georgia, serif; font-weight: 300; font-size: 40pt; line-height: 1.05; margin: 0 0 12mm; letter-spacing: -.015em; }
  .cover h1 .to { display: block; font-size: 40pt; }
  .cover-facts { display: grid; grid-template-columns: 34mm 1fr; gap: 2.2mm 6mm; max-width: 120mm; font-size: 9.5pt; }
  .cover-facts dt { color: var(--faint); }
  .cover-facts dd { margin: 0; }
  .cover-letter { margin-top: 12mm; max-width: 110mm; color: var(--grey); font-size: 9.5pt; }
  .cover-letter p { margin: 0 0 2mm; }
  .cover-provenance { font-size: 8pt; color: var(--faint); max-width: 120mm; margin-top: 8mm; }

  /* ---- Contents ------------------------------------------------------ */
  .contents-h { margin-bottom: 1mm; }
  ol.contents { list-style: none; margin: 0; padding: 0; }
  ol.contents li { display: flex; align-items: baseline; gap: 5mm; padding: 3mm 0; border-bottom: 0.4pt solid var(--rule); }
  ol.contents .n { width: 6mm; color: var(--faint); font-size: 9pt; }
  ol.contents .t { flex: 1; font-size: 11.5pt; font-family: 'Cormorant Infant', Georgia, serif; }
  ol.contents .p { color: var(--faint); font-size: 9pt; font-variant-numeric: tabular-nums; }

  /* ---- Panels and cards ---------------------------------------------- */
  .panel { border: 0.4pt solid var(--rule); border-radius: 3mm; padding: 5mm 6mm; margin: 0 0 4mm; background: rgba(255,255,255,.5); }
  .panel h3 { margin-top: 0; font-size: 12pt; }
  .panel .when, .panel .kind { font-size: 7.4pt; letter-spacing: .08em; text-transform: uppercase; color: var(--faint); margin-bottom: 1mm; }
  .callout {
    display: flex; gap: 3.5mm; align-items: flex-start;
    background: rgba(228,215,197,.35); border-radius: 3mm; padding: 4mm 5mm; margin-top: 8mm; max-width: 130mm;
  }
  .callout p { margin: 0; font-size: 8.4pt; color: var(--grey); }
  .callout svg { flex: 0 0 auto; opacity: .55; margin-top: .6mm; }

  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(38mm, 1fr)); gap: 4mm; margin-bottom: 6mm; }
  .cards .c { border: 0.4pt solid var(--rule); border-radius: 3mm; padding: 4.5mm; text-align: center; background: rgba(255,255,255,.5); }
  .cards .c .label { font-family: 'Cormorant Infant', Georgia, serif; font-size: 11pt; display: block; margin-bottom: .6mm; }
  .cards .c .val { font-size: 8.2pt; color: var(--grey); }

  /* ---- Tables -------------------------------------------------------- */
  .tbl { border: 0.4pt solid var(--rule); border-radius: 3mm; overflow: hidden; margin: 0 0 4mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead th {
    text-align: left; font-weight: 500; font-size: 7.6pt; letter-spacing: .07em; text-transform: uppercase;
    color: var(--grey); padding: 2.6mm 4mm; background: rgba(228,215,197,.32);
  }
  tbody td { padding: 2.4mm 4mm; border-top: 0.4pt solid var(--rule); font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) td { background: rgba(228,215,197,.14); }
  .tbl.cont thead th { font-style: italic; text-transform: none; letter-spacing: 0; }

  /* ---- Trend sparklines ---------------------------------------------- */
  .trends { display: grid; grid-template-columns: repeat(auto-fit, minmax(42mm, 1fr)); gap: 4mm; margin: 2mm 0 4mm; }
  .trend { border: 0.4pt solid var(--rule); border-radius: 3mm; padding: 4mm; background: rgba(255,255,255,.5); }
  .trend .t { font-family: 'Cormorant Infant', Georgia, serif; font-size: 10.5pt; }
  .trend .d { font-size: 13pt; color: var(--terracotta); font-family: 'Cormorant Infant', Georgia, serif; }
  .trend .s { font-size: 7.4pt; color: var(--faint); }
  .trend svg { display: block; width: 100%; height: 11mm; margin: 2mm 0 1mm; }
  .trend .ends { display: flex; justify-content: space-between; font-size: 7.4pt; color: var(--faint); font-variant-numeric: tabular-nums; }

  /* ---- Timeline ------------------------------------------------------ */
  .tl { display: grid; grid-template-columns: 30mm 1fr; gap: 5mm; padding: 0 0 5mm 0; position: relative; }
  .tl-date { font-size: 8.6pt; color: var(--grey); padding-top: .8mm; position: relative; padding-left: 5mm; }
  .tl-date::before {
    content: ''; position: absolute; left: 0; top: 1.6mm;
    width: 2.2mm; height: 2.2mm; border-radius: 50%; background: var(--terracotta);
  }
  .tl-date::after {
    content: ''; position: absolute; left: .95mm; top: 4.4mm; bottom: -5mm; width: 0.4pt; background: var(--rule);
  }
  .tl:last-child .tl-date::after { display: none; }
  .tl-body p { margin: 0; color: var(--grey); }

  dl.facts-inline { display: grid; grid-template-columns: 38mm 1fr; gap: 2mm 6mm; margin: 0 0 4mm; font-size: 9.5pt; }
  dl.facts-inline dt { color: var(--faint); }
  dl.facts-inline dd { margin: 0; }

  /* ---- The one control ----------------------------------------------- */
  .print {
    position: fixed; right: 20px; bottom: 20px; z-index: 50;
    background: var(--terracotta); color: #fff; border: 0; cursor: pointer;
    font: 500 14px/1 Inter, sans-serif; padding: 13px 20px; border-radius: 999px;
    box-shadow: 0 6px 20px rgba(45,43,40,.22);
  }

  @media print {
    body { background: var(--paper); }
    .print { display: none; }
    .sheet { margin: 0; box-shadow: none; break-after: page; }
    .sheet:last-child { break-after: auto; }
  }
  @page { size: A4; margin: 0; }

  /* WITHOUT JAVASCRIPT this is still a readable document: the blocks simply
     flow, sections start on new pages, and nothing claims a page number it
     cannot count. */
  #flow { max-width: 210mm; margin: 0 auto; padding: 16mm 20mm; background: var(--paper); }
  #flow .blk[data-break='page'] { break-before: page; }
  .paginated #flow { display: none; }
</style>
</head>
<body>
<div id="flow">${flow}</div>
<div id="sheets" hidden></div>
<button class="print" onclick="window.print()">Save as PDF</button>

<template id="sheet-tpl">
  <div class="sheet">
    <svg class="wm" viewBox="${MARK_VIEWBOX}" aria-hidden="true">${MARK_INNER}</svg>
    <div class="sheet-head">
      <svg class="lockup" viewBox="${LOCKUP_VIEWBOX}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="Selodía">${LOCKUP_INNER}</svg>
      <span class="who">${runner}</span>
    </div>
    <div class="sheet-body"></div>
    <div class="sheet-foot">
      <span class="tagline">Knowledge creates options.</span>
      <span class="meta">
        <span class="rid">${id ? esc(id) : ''}</span>
        <span class="pg"></span>
        <svg class="seed" viewBox="${MARK_VIEWBOX}" aria-hidden="true">${MARK_INNER}</svg>
      </span>
    </div>
  </div>
</template>

<script>
(function () {
  // PACKING BLOCKS INTO SHEETS. Every block the server emits is shorter than a
  // page by construction - tables arrive pre-chunked - so this only has to
  // decide where each one goes, and never to split one.
  function paginate() {
    var flow = document.getElementById('flow');
    var out = document.getElementById('sheets');
    var tpl = document.getElementById('sheet-tpl');
    if (!flow || !out || !tpl) return;

    var blocks = Array.prototype.slice.call(flow.querySelectorAll('.blk'));
    if (!blocks.length) return;

    out.hidden = false;
    document.body.classList.add('paginated');

    var sheet = null, body = null;
    function newSheet(cover) {
      sheet = tpl.content.firstElementChild.cloneNode(true);
      if (cover) {
        sheet.querySelector('.sheet-head').remove();
        sheet.querySelector('.wm').style.opacity = '.05';
        sheet.querySelector('.wm').style.width = '210mm';
        sheet.querySelector('.wm').style.height = '210mm';
      }
      out.appendChild(sheet);
      body = sheet.querySelector('.sheet-body');
      return body;
    }

    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var isCover = b.getAttribute('data-sheet') === 'cover';
      if (!body || isCover || b.getAttribute('data-break') === 'page') newSheet(isCover);
      body.appendChild(b);
      // Overflowed, and it is not the only thing here: it belongs on the next.
      if (body.scrollHeight > body.clientHeight + 1 && body.children.length > 1) {
        body.removeChild(b);
        newSheet(false);
        body.appendChild(b);
      }
      if (isCover) { body = null; }
    }

    // Numbering last, when the count is finally known - which is the whole
    // reason this runs in the browser rather than being printed as a scroll.
    var sheets = out.querySelectorAll('.sheet');
    for (var j = 0; j < sheets.length; j++) {
      var pg = sheets[j].querySelector('.pg');
      if (pg) pg.textContent = 'Page ' + (j + 1) + ' of ' + sheets.length;
    }

    // And the contents page can now say which page each section landed on.
    var pageOf = {};
    for (var k = 0; k < sheets.length; k++) {
      var marked = sheets[k].querySelectorAll('[data-section]');
      for (var m = 0; m < marked.length; m++) pageOf[marked[m].getAttribute('data-section')] = k + 1;
    }
    var items = out.querySelectorAll('ol.contents li');
    for (var n = 0; n < items.length; n++) {
      var ref = items[n].getAttribute('data-ref');
      var slot = items[n].querySelector('.p');
      if (slot && pageOf[ref]) slot.textContent = String(pageOf[ref]);
    }
  }

  // After the fonts, because Cormorant is a different height from the fallback
  // and packing measured against the wrong one puts a line on the wrong page.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { setTimeout(paginate, 0); });
  } else {
    window.addEventListener('load', paginate);
  }
})();
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------

function cover(data: ReportData, generated: string): string {
  const facts: string[] = [];
  if (data.name) facts.push(`<dt>Name</dt><dd>${esc(data.name)}</dd>`);
  if (data.dateOfBirth) facts.push(`<dt>Date of birth</dt><dd>${esc(longDate(data.dateOfBirth))}</dd>`);
  facts.push(`<dt>Reporting period</dt><dd>${esc(data.periodLabel)}</dd>`);
  facts.push(`<dt>Generated</dt><dd>${esc(generated)}</dd>`);
  if (data.reportId) facts.push(`<dt>Report ID</dt><dd>${esc(data.reportId)}</dd>`);

  return `<div class="cover-wrap">
    <svg class="cover-mark" viewBox="${LOCKUP_VIEWBOX}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="Selodía">${LOCKUP_INNER}</svg>
    ${
      data.recipient
        ? `<div class="cover-eyebrow">Prepared for</div><h1><span class="to">${esc(data.recipient)}</span></h1>`
        : `<div class="cover-eyebrow">Personal</div><h1>Health Summary</h1>`
    }
    <dl class="cover-facts">${facts.join('')}</dl>
    ${
      data.note
        ? `<div class="cover-letter">${data.note
            .split(BLANK_LINE)
            .map((p) => `<p>${esc(p.trim())}</p>`)
            .join('')}</div>`
        : ''
    }
    <p class="cover-provenance">The pages that follow are records as they were entered, on the dates shown. Nothing here was generated or inferred: any summary is labelled as one and is drawn from these pages.</p>
  </div>`;
}

/** The small counted cards at the top of the summary. */
function glanceCards(data: ReportData): string | null {
  const cards: { label: string; value: string }[] = [];
  if (data.weights.length > 0) cards.push({ label: 'Body', value: `${data.weights.length} ${plural(data.weights.length, 'reading')}` });
  if (data.metrics.length > 0) cards.push({ label: 'Measurements', value: `${data.metrics.length} ${plural(data.metrics.length, 'reading')}` });
  if (data.symptoms.length > 0) cards.push({ label: 'Symptoms', value: `${data.symptoms.length} ${plural(data.symptoms.length, 'entry', 'entries')}` });
  if (data.activity.length > 0) cards.push({ label: 'Activity', value: `${data.activity.length} ${plural(data.activity.length, 'session')}` });
  if (data.food.length > 0) cards.push({ label: 'Food', value: `${data.food.length} ${plural(data.food.length, 'day')}` });
  if (data.sleep.length > 0) cards.push({ label: 'Sleep', value: `${data.sleep.length} ${plural(data.sleep.length, 'night')}` });
  if (data.water.length > 0) cards.push({ label: 'Drinks', value: `${data.water.length} ${plural(data.water.length, 'day')}` });
  if (cards.length === 0) return null;
  return `<div class="cards">${cards
    .map((c) => `<div class="c"><span class="label">${esc(c.label)}</span><span class="val">${esc(c.value)}</span></div>`)
    .join('')}</div>`;
}

/**
 * The small trend panels. EVERY FIGURE IN THEM IS A SUBTRACTION between two
 * readings that are both printed in the table above - never a rate, a
 * projection or a "trend" in the sense of a claim about where something is
 * going. Her rule: never infer a relationship the data does not support.
 */
function trendPanels(data: ReportData): string | null {
  const series: { title: string; values: number[]; unit: string }[] = [];
  const weights = data.weights.map((w) => w.weight).filter((v): v is number => v != null);
  const fats = data.weights.map((w) => w.fat).filter((v): v is number => v != null);
  const muscle = data.weights.map((w) => w.muscle).filter((v): v is number => v != null);
  if (weights.length > 1) series.push({ title: 'Weight', values: weights, unit: 'kg' });
  if (fats.length > 1) series.push({ title: 'Body fat', values: fats, unit: '%' });
  if (muscle.length > 1) series.push({ title: 'Muscle', values: muscle, unit: 'kg' });
  if (series.length === 0) return null;

  return `<div class="trends">${series
    .map((s) => {
      // Rows arrive oldest first, so the last is the most recent.
      const first = s.values[0];
      const last = s.values[s.values.length - 1];
      const delta = round(last - first);
      const sign = delta > 0 ? '+' : '';
      return `<div class="trend">
        <div class="t">${esc(s.title)}</div>
        <div class="d">${sign}${delta} ${esc(s.unit)}</div>
        <div class="s">across ${s.values.length} ${plural(s.values.length, 'reading')}</div>
        ${sparkline(s.values)}
        <div class="ends"><span>${round(first)}</span><span>${round(last)}</span></div>
      </div>`;
    })
    .join('')}</div>`;
}

function sparkline(values: number[]): string {
  const w = 100;
  const h = 26;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (values.length - 1);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(' ');
  const lastX = values.length === 1 ? w / 2 : w - pad;
  const lastY = h - pad - ((values[values.length - 1] - min) / span) * (h - pad * 2);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${points}" fill="none" stroke="${TERRACOTTA}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${lastX}" cy="${Math.round(lastY * 10) / 10}" r="1.6" fill="${TERRACOTTA}"/>
  </svg>`;
}

/**
 * A table split into page-safe pieces, each carrying the headings again. The
 * paginator never has to break one open, and a table continued overleaf still
 * says what its columns are - which is the whole reason to repeat them.
 */
function tableBlocks(headers: string[], rows: string[][]): Block[] {
  if (rows.length === 0) return [];
  const out: Block[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_BLOCK) {
    const chunk = rows.slice(i, i + ROWS_PER_BLOCK);
    const continued = i > 0;
    out.push(
      `<div class="tbl${continued ? ' cont' : ''}"><table><thead><tr>${headers
        .map((h, n) => `<th>${esc(continued && n === 0 ? `${h} (continued)` : h)}</th>`)
        .join('')}</tr></thead><tbody>${chunk
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`
    );
  }
  return out;
}

function panel(title: string, when: string | null, content: string, kind?: string): string {
  return `<div class="panel">
    ${kind ? `<div class="kind">${esc(kind)}</div>` : ''}
    ${when ? `<div class="when">${esc(when)}</div>` : ''}
    <h4>${esc(title)}</h4>
    <p>${esc(content)}</p>
  </div>`;
}

function intro(text: string): string {
  return `<p class="intro">${esc(text)}</p>`;
}

function definitionList(items: { label: string; value: string }[]): string {
  return `<dl class="facts-inline">${items
    .map((i) => `<dt>${esc(i.label)}</dt><dd>${esc(i.value)}</dd>`)
    .join('')}</dl>`;
}

function markSvg(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}" aria-hidden="true">${MARK_INNER}</svg>`;
}

function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : (many ?? `${one}s`);
}

/** "Ruth Christianson" on the cover, "Ruth C." in the running head. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
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
