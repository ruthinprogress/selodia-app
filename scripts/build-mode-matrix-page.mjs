// The matrix as a page, built from scripts/mode-matrix.json so the document
// cannot drift from the code. Run build-mode-matrix.mjs first.
//
//   node scripts/build-mode-matrix-page.mjs > out.html

import { readFileSync } from 'node:fs';

const m = JSON.parse(readFileSync('scripts/mode-matrix.json', 'utf8'));
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rule(r) {
  if (r.empty) return 'No figure at all. Nothing has been chosen, so there is nothing to show.';
  if (r.mode === 'deficit') {
    const base = 'A little under what you use — about 0.5% of bodyweight a week';
    return r.floored ? `${base}, held at the floor (the higher of BMR and 1,200).` : `${base}, ${Math.abs(r.delta)} kcal a day.`;
  }
  if (r.mode === 'surplus') return `A little over — ${r.delta} kcal a day, and never more. A constant in code with no field that takes a number.`;
  return 'Around what you use.';
}

const sw = (bools) =>
  bools.map((b) => (b ? '<span class="on">●</span>' : '<span class="no">○</span>')).join(' ');

const valid = m.rows.filter((r) => !r.blocked);
const blocked = m.rows.filter((r) => r.blocked);

const rulesRows = (m.rules ?? [])
  .map(
    (r) => `
      <tr>
        <td class="name">${esc(r.rule)}</td>
        <td class="num">${esc(r.value)}</td>
        <td class="small">${esc(r.basis)}</td>
        <td class="small">${esc(r.lastReviewed)}</td>
      </tr>`
  )
  .join('');

const body = valid
  .map(
    (r) => `
      <tr${r.empty ? ' class="none"' : ''}>
        <td class="sw">${sw(r.switches)}</td>
        <td class="name">${esc(r.name)}</td>
        <td class="num">${r.kcal ? r.kcal.toLocaleString('en-GB') : '—'}</td>
        <td class="small">${esc(rule(r))}</td>
        <td class="num">${esc(r.protein ?? '—')}${r.stepped === 'up' ? ' <span class="tag">top of range</span>' : ''}</td>
        <td class="small line">${esc(r.line)}</td>
        <td class="small safety">${r.safety ? esc(r.safety) + ' <span class="q">?</span>' : '<span class="no">—</span>'}</td>
      </tr>`
  )
  .join('');

process.stdout.write(`<title>Selodía Mode Matrix</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Infant:ital,wght@0,400;1,400&family=Manrope:wght@400;500;600&display=swap">
<style>
  :root {
    --page: #EFE9DC; --card: #FBF8F2; --rule: #D9CDBB;
    --ink: #2D2B28; --ink-soft: #605A52; --off: #B5ABA0;
    --terracotta: #C97458; --terracotta-deep: #874C3A; --flagged: #A63A2E;
    --display: "Cormorant Infant", Georgia, serif;
    --body: "Manrope", system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --page: #1A1815; --card: #24211C; --rule: #3A352E;
      --ink: #EDE6DA; --ink-soft: #A79D90; --off: #5C564E;
      --terracotta-deep: #D98E6F; --flagged: #E07A6A; color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --page: #1A1815; --card: #24211C; --rule: #3A352E;
    --ink: #EDE6DA; --ink-soft: #A79D90; --off: #5C564E;
    --terracotta-deep: #D98E6F; --flagged: #E07A6A; color-scheme: dark;
  }
  body { background: var(--page); color: var(--ink); font-family: var(--body);
    margin: 0; padding-block: 30px 60px; padding-left: 16px; padding-right: 16px; line-height: 1.5; }
  .wrap { max-width: 1240px; margin: 0 auto; }
  h1 { font-family: var(--display); font-weight: 400; font-size: clamp(32px,6vw,46px); margin: 0 0 4px; text-wrap: balance; }
  .lede { color: var(--ink-soft); max-width: 72ch; margin: 0 0 8px; font-size: 15px; }
  .stamp { color: var(--off); font-size: 12.5px; margin: 0 0 28px; }
  h2 { font-family: var(--display); font-weight: 400; font-size: 26px; margin: 40px 0 8px; text-wrap: balance; }
  p { max-width: 74ch; }
  .small { font-size: 13px; color: var(--ink-soft); }
  .scroller { overflow-x: auto; margin-top: 14px; }
  table { border-collapse: collapse; font-size: 13.5px; min-width: 1020px; width: 100%; }
  th { text-align: left; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase;
    color: var(--ink-soft); font-weight: 600; padding: 0 12px 9px 0; white-space: nowrap; }
  td { padding: 11px 12px 11px 0; border-top: 1px solid var(--rule); vertical-align: top; }
  tr.none td { color: var(--off); }
  .sw { white-space: nowrap; letter-spacing: .18em; font-size: 15px; }
  .on { color: var(--terracotta-deep); } .no, .grey { color: var(--off); }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 600; }
  .name { font-weight: 600; min-width: 170px; }
  .line { min-width: 250px; } .safety { min-width: 190px; color: var(--terracotta-deep); }
  .tag { font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-soft); font-weight: 500; }
  .q { display: inline-block; border: 1px solid currentColor; border-radius: 50%; width: 14px; height: 14px;
    line-height: 13px; text-align: center; font-size: 10px; }
  .flag { background: var(--card); border-left: 3px solid var(--terracotta); border-radius: 0 10px 10px 0; padding: 15px 17px; margin: 22px 0; }
  .flag.alert { border-left-color: var(--flagged); }
  .flag h3 { margin: 0 0 7px; font-size: 13px; letter-spacing: .05em; text-transform: uppercase; color: var(--terracotta-deep); }
  .flag.alert h3 { color: var(--flagged); }
  .flag p { margin: 0 0 9px; font-size: 14px; } .flag p:last-child { margin-bottom: 0; }
  ul { max-width: 74ch; padding-left: 20px; } li { margin-bottom: 7px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--card); padding: 1px 5px; border-radius: 4px; }
  .choice { background: var(--card); border-radius: 12px; padding: 15px 17px; margin: 12px 0; }
  .choice h4 { margin: 0 0 6px; font-size: 14.5px; }
  .choice .rec { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--terracotta-deep); font-weight: 600; }
</style>

<div class="wrap">
  <h1>Mode matrix</h1>
  <p class="lede">Four switches and one Pause. Lose fat, Maintain weight and Gain weight are one weight direction and only one can be on; Build muscle is independent. All off means nothing chosen, and nothing chosen has no figure at all.</p>
  <p class="stamp">Generated from the app's own modules into <code>scripts/mode-matrix.json</code>, which the checks read. Figures use TDEE ${m.body.tdeeKcal.toLocaleString('en-GB')} kcal, ${m.body.weightKg} kg, ${m.body.bodyFatPct}% body fat.</p>

  <div class="flag">
    <h3>Decided, 4 October</h3>
    <p><strong>Build muscle alone gets a small surplus; Maintain + Build does not.</strong> 5% of what you use — 78 kcal for you — on the low side because fat is easier to gain at this stage of life. It is a starting point, and the basis below says so. Saying “Maintain weight” switches it off, because you said so.</p>
    <p><strong>What you tick is now what is stored.</strong> Those two states share one focus pair, so the old storage could not tell them apart — which is how your Maintain tick came back missing earlier. <code>body_mode</code> holds exactly the four switches; the focus columns are written from it and kept as the view everything else already reads. Nothing is inferred and nothing is lost, and a check walks all eight states through a save and reload.</p>
    <p><strong>Empty and maintain are distinguishable,</strong> as asked — and it is already live. Nothing chosen leaves both focus values null and produces no figure at all; maintain writes <code>maintain/maintain</code>. One of the three accounts is sitting in the null state right now and correctly gets no calorie figure.</p>
  </div>

  <h2>Every combination</h2>
  <div class="scroller">
    <table>
      <thead><tr>
        <th>LF · MW · GW · BM</th><th>Outcome</th><th>Calories</th>
        <th>Calorie rule</th><th>Protein</th><th>The line on screen</th><th>Safety line</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <p class="small">LF = Lose fat · MW = Maintain weight · GW = Gain weight · BM = Build muscle. ${blocked.length} of the 16 combinations cannot be reached: turning on one weight direction turns the other two off.</p>

  <h2>Pause — one row, every combination</h2>
  <div class="flag">
    <p><strong>${m.paused.kcal.toLocaleString('en-GB')} kcal · ${esc(m.paused.protein)}</strong></p>
    <p>${esc(m.paused.rule)}</p>
    <p class="small">${esc(m.paused.explanation)}</p>
  </div>

  <h2>Two states share one set of figures, and that is correct</h2>
  <div class="flag">
    <p><strong>Less fat, more muscle</strong> and <strong>Holding weight, building muscle</strong> both read 1,550 kcal and 90–106 g.</p>
    <p>They are the same arithmetic because none of them adds or subtracts anything: each one eats around what you use, with protein high. They are not the same <em>answer</em> — they differ in what you are working towards, in what the screen says, and in what you would change next — but the figures coincide and pretending otherwise would mean inventing a difference the body does not have.</p>
    <p class="small">Building muscle on its own is no longer among them: it now sits at 1,630.</p>
  </div>

  <h2>Why your maintenance said 1,350</h2>
  <div class="flag alert">
    <h3>Two faults, compounding</h3>
    <p><strong>Your activity level was being overwritten.</strong> The activities screen derives it from the cadences you tick, and <code>activityLevelFrom([])</code> returns <em>sedentary</em> — with no guard on whether you ticked anything. Your chips were not saving, so the list was empty every time, so every walk through that screen wrote sedentary over your moderate. On 28 September you were on moderate: BMR 1,133 × 1.55 = 1,756, less a 313 kcal deficit, is the 1,440 you saw. Fixed: it is only written when you actually answer.</p>
    <p><strong>And the question does not mean what the sum means.</strong> The profile asks “how much you move <em>outside exercise</em>”, but the multiplier it feeds is a whole-day figure meant to include exercise. Answering honestly about non-exercise movement produces a TDEE that leaves out your ballet, your training and your 9,847 steps.</p>
    <p><strong>A naming mismatch too.</strong> The ~1,550 you expect is what the app calls <em>light</em>; its <em>moderate</em> is 1,748. The sheet should let you pick by plain description rather than by label, and say whether usual training is counted.</p>
  </div>

  <h2>Still to settle</h2>
  <ul>
    <li><strong>The gain bounds you asked for:</strong> floor <strong>100</strong> kcal a day, ceiling <strong>300</strong>. The ceiling binds above about 109 kg so scaling can never become a reason the number keeps growing; the floor binds below about 36 kg so the surplus stays large enough to do anything. Yours is 156.</li>
    <li><strong>The energy constant is the same in both directions:</strong> 7,700 kcal to a kilo for losing and for gaining. It is an approximation either way — tissue gained is not identical to tissue lost — and using one number keeps the two rates comparable rather than inventing a difference the evidence does not support.</li>
    <li><strong>Where the activity sheet lives</strong> — Body Manual under More, edited in one place, linked from wherever the figure appears.</li>
    <li><strong>“Feel stronger”</strong> moves into “How do you want your days to feel”; “Get stronger” leaves the body question entirely.</li>
  </ul>

  <h2>Every rule, its evidence, and when it was last looked at</h2>
  <p class="small">These are not notes about the code — they are the same objects the engine uses, so a number cannot change without its reason changing with it. The monthly scan proposes against these entries and never applies anything.</p>
  <div class="scroller">
    <table>
      <thead><tr><th>Rule</th><th>Value</th><th>Basis</th><th>Last reviewed</th></tr></thead>
      <tbody>${rulesRows}</tbody>
    </table>
  </div>

  <h2>What is stored</h2>
  <p class="small"><code>body_mode</code> holds the four switches exactly as ticked, and is the record. <code>fat_focus_state</code> and <code>muscle_focus_state</code> are written from it and kept as the view that turn_context, the day sums, the protein rule and every existing probe already read. Null everywhere means never answered — which is what makes “no goal chosen” a real state rather than a silent maintenance default, the fault that showed three people a figure nobody had chosen on 28 September. <code>paused_at</code> records the one Pause; nothing expires it and no timer reads it.</p>
</div>
`);
