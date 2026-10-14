import { readMeCard } from './me-card';

// THE ME TAB AS A DOCUMENT (Me brief, "Export"; built 2026-09-19).
//
// Ruth's brief: "exportable as a clean reference document - suitable to print
// and stick somewhere visible, share with a carer, partner, or family member,
// hand to a new clinician as a 'this is how I operate' overview. Export includes
// all sections, all cards, expanded explanations. Clean formatting, no app
// chrome."
//
// SO IT IS A PAGE, NOT A SCREENSHOT OF ONE. Everything the app hides behind a
// tap is open here, because the reader is somebody else - a GP does not know to
// tap the card for the reason, and the reason is the part worth handing over.
//
// SET IN THE APP'S OWN TYPE, cream and charcoal, the serif for names and
// Manrope for everything else. A clinician should be able to tell at a glance
// that this came from one place and was made with care; that is part of why it
// gets read.
//
// NOTHING IS INTERPRETED. A value she quoted appears as she quoted it, and the
// page never adds "high", "low" or "concerning" - the same rule the cards keep
// (Ruth's answer 6).

export type ExportRow = {
  title: string;
  category: string | null;
  content: unknown;
  created_at: string;
};

const SECTION_ORDER = ['Nutrition', 'Supplements', 'Skincare', 'Wellbeing', 'Relationships'];

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * THE MARKS COME OFF HERE TOO (14 October 2026).
 *
 * A care record's detail is written with `**headings**` and `_quiet notes_`,
 * because the chat bubble and the Me tab both render them - and this page
 * escaped the text and printed the stars. Ruth, on the same marks reaching her
 * screen two days ago: "the awful formatting instantly makes me feel like its
 * a junk app I cant trust." On a page she hands to a clinician it is worse than
 * that, because the clinician forms the same judgement about her.
 *
 * DELIBERATELY SMALL, and the same four shapes mobile/src/lib/rich-text.ts
 * recognises: a line that is entirely bold is a heading, a line in underscores
 * is a quiet note, a dash or a bullet starts a list item, and everything else
 * is a paragraph that keeps its own line breaks. Anything it does not know
 * about comes out as the words themselves, never as a star.
 */
function marksToHtml(text: string): string {
  const inline = (s: string): string =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])_([^_]+)_(?=$|[\s.,)])/g, '$1<em>$2</em>');

  const out: string[] = [];
  let list: string[] = [];
  const closeList = () => {
    if (list.length === 0) return;
    out.push(`<ul>${list.map((i) => `<li>${i}</li>`).join('')}</ul>`);
    list = [];
  };

  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const heading = line.match(/^\*\*(.+)\*\*$/);
      const bullet = line.match(/^(?:[-•]|\d+\.)\s+(.*)$/);
      if (heading) {
        closeList();
        out.push(`<h4>${inline(heading[1])}</h4>`);
      } else if (bullet) {
        list.push(inline(bullet[1]));
      } else if (/^_[^_]+_$/.test(line)) {
        closeList();
        out.push(`<p class="quiet">${inline(line)}</p>`);
      } else {
        closeList();
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    closeList();
  }
  return out.join('');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Written out by hand, so the page reads the same in every browser and on every
// server rather than depending on the locale data a runtime happens to carry.
function longDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * HER STANDING DETAILS, AT THE TOP OF THE PAGE.
 *
 * On the phone they sit above How I Access Care and below everything she
 * follows, because the tab opens on the life and the paperwork sits under it.
 * On a printed page the reader is somebody else - a receptionist, a carer, a
 * clinician meeting her for the first time - and the first thing any of them
 * needs is which patient this is. So here they lead.
 *
 * Ruth's brief for the export: "hand to a new clinician as a 'this is how I
 * operate' overview."
 */
function detailsSection(details: ExportDetail[]): string {
  if (details.length === 0) return '';
  const rows = details
    .map(
      (d) => `
        <tr>
          <th>${esc(d.label)}</th>
          <td>${esc(d.value)}${d.note ? `<span class="quiet"> &middot; ${esc(d.note)}</span>` : ''}${
            d.confirmed ? '' : '<span class="quiet"> &middot; worth checking against the letter</span>'
          }</td>
        </tr>`
    )
    .join('');
  return `
    <section>
      <h2>Details I am asked for</h2>
      <table class="details">${rows}
      </table>
    </section>`;
}

export type ExportDetail = {
  label: string;
  value: string;
  note: string | null;
  confirmed: boolean;
};

export function renderMeExport(
  rows: ExportRow[],
  opts: { name: string | null; today: string; details?: ExportDetail[] }
): string {
  const bySection = new Map<string, ExportRow[]>();
  for (const r of rows) {
    const section = (r.category ?? '').trim() || 'Everything else';
    const list = bySection.get(section) ?? [];
    list.push(r);
    bySection.set(section, list);
  }
  const names = [...bySection.keys()];
  const ordered = [
    ...SECTION_ORDER.filter((s) => names.includes(s)),
    ...names.filter((s) => !SECTION_ORDER.includes(s)).sort((a, b) => a.localeCompare(b)),
  ];

  const sections = ordered
    .map((section) => {
      const cards = (bySection.get(section) ?? [])
        .map((r) => {
          const card = readMeCard(r.content) ?? { why: '', status: null, detail: null };
          const content = (r.content ?? {}) as Record<string, unknown>;
          const history = Array.isArray(content.history)
            ? (content.history as { date?: string; status?: string; reason?: string }[]).filter((h) => h?.date)
            : [];
          return `
      <article class="card">
        <header>
          <h3>${esc(r.title)}</h3>
          ${card.status ? `<span class="status${card.status === 'Paused' ? ' paused' : ''}">${esc(card.status)}</span>` : ''}
        </header>
        ${card.why ? `<p class="why">${esc(card.why)}</p>` : ''}
        ${card.detail ? `<div class="detail">${marksToHtml(card.detail)}</div>` : ''}
        <p class="meta">Added ${esc(longDate(r.created_at))}</p>
        ${history
          .map(
            (h) =>
              `<p class="meta">${esc([h.status, longDate(h.date ?? '')].filter(Boolean).join(' '))}${
                h.reason ? ` &middot; ${esc(h.reason)}` : ''
              }</p>`
          )
          .join('')}
      </article>`;
        })
        .join('');
      return `
    <section>
      <h2>${esc(section)}</h2>${cards}
    </section>`;
    })
    .join('');

  const whose = opts.name ? `${esc(opts.name)}&rsquo;s protocol` : 'My protocol';

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.name ? `${esc(opts.name)} - ` : ''}Selodia protocol</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Infant:wght@400;500&family=Manrope:wght@400;600&display=swap">
<style>
  :root { --cream: #F7F3EA; --sand: #E9D6C2; --ink: #2D2B28; --soft: #605A52; --terracotta: #874C3A; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cream); color: var(--ink); font-family: Manrope, system-ui, sans-serif; font-size: 15px; line-height: 1.55; }
  main { max-width: 680px; margin: 0 auto; padding: 40px 24px 64px; }
  h1 { font-family: 'Cormorant Infant', Georgia, serif; font-weight: 400; font-size: 44px; line-height: 1.02; margin: 0 0 6px; }
  .sub { color: var(--soft); margin: 0 0 8px; }
  .printed { color: var(--soft); font-size: 13px; margin: 0 0 32px; }
  h2 { font-family: 'Cormorant Infant', Georgia, serif; font-weight: 400; font-size: 28px; margin: 32px 0 10px; }
  .card { background: #fff; border: 1px solid var(--sand); border-radius: 14px; padding: 14px 16px; margin: 0 0 8px; break-inside: avoid; }
  .card header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  h3 { font-family: 'Cormorant Infant', Georgia, serif; font-weight: 500; font-size: 21px; margin: 0; }
  .status { font-size: 13px; font-weight: 600; white-space: nowrap; }
  .status.paused { color: var(--soft); font-weight: 400; }
  .why { margin: 6px 0 0; }
  .detail { margin: 4px 0 0; color: var(--soft); }
  /* A care record's own headings, inside a card. Weight and a little space,
     not a third size of serif: the card's name is still the heading here and
     these are the parts of a letter under it. */
  .detail h4 { font-family: Manrope, system-ui, sans-serif; font-size: 15px; font-weight: 600; color: var(--ink); margin: 12px 0 2px; }
  .detail h4:first-child { margin-top: 2px; }
  .detail p { margin: 0 0 4px; }
  .detail ul { margin: 2px 0 6px; padding-left: 18px; }
  .detail li { margin: 0 0 2px; }
  .quiet { color: var(--soft); font-size: 13px; }
  /* THE DETAILS SHE IS ASKED FOR: a table, because a receptionist reads down
     a column of labels. Tabular figures so a transposed digit is visible. */
  .details { width: 100%; border-collapse: collapse; margin: 6px 0 0; }
  .details th { text-align: left; font-weight: 600; padding: 7px 12px 7px 0; vertical-align: top; white-space: nowrap; }
  .details td { padding: 7px 0; font-variant-numeric: tabular-nums; }
  .details tr + tr th, .details tr + tr td { border-top: 1px solid var(--sand); }
  .meta { margin: 4px 0 0; color: var(--soft); font-size: 13px; }
  .actions { margin: 0 0 28px; }
  .actions button { font: 600 14px Manrope, sans-serif; color: var(--cream); background: var(--terracotta); border: 0; border-radius: 999px; padding: 10px 20px; cursor: pointer; }
  footer { margin-top: 40px; color: var(--soft); font-size: 12px; }
  @media print {
    body { background: #fff; }
    main { padding: 0; max-width: none; }
    .actions { display: none; }
    .card { border-color: #ddd; }
    @page { margin: 18mm; }
  }
</style>
</head>
<body>
<main>
  <h1>${whose}</h1>
  <p class="sub">How I have decided to look after myself, and why.</p>
  <p class="printed">As of ${esc(longDate(opts.today))}</p>
  <div class="actions"><button onclick="window.print()">Print or save as PDF</button></div>
  ${detailsSection(opts.details ?? [])}
  ${rows.length > 0 ? sections : (opts.details ?? []).length > 0 ? '' : '<p class="sub">Nothing has been added yet.</p>'}
  <footer>Kept in Selodia. Each entry was decided in conversation and records the reason at the time.</footer>
</main>
</body>
</html>`;
}
