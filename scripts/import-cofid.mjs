// McCance and Widdowson into a table the app can ask.
//
// WHAT THIS IS. CoFID - the Composition of Foods Integrated Dataset - is the UK
// government's official food composition table, published by UKHSA. 2,887 foods
// with measured values per 100g, under the Open Government Licence. It is the
// authoritative source for WHOLE foods in this country: cheddar, porridge oats,
// boiled new potatoes, the things people actually eat and describe.
//
// WHY IT MATTERS MORE THAN THE API DID (measured 2026-09-18). Open Food Facts is
// a database of PACKAGED PRODUCTS, and the difference is not academic: asked for
// "100g cheddar" it returned "Mature Cheddar & Chive" at 469 kcal and 6.9g
// protein. Real cheddar is about 25g. That answer would have been accepted at
// the confidence threshold and logged, and it is wrong by nearly four times on
// the number this app tracks most carefully. Five of six ordinary foods returned
// nothing usable at all. A local, authoritative table of whole foods is the
// thing that actually reduces the model's share of the work.
//
// IT IS AN IMPORT, NOT A SYNC. CoFID is republished every few years, not daily.
// Run this when a new edition appears, check the count, commit the result.
//
//   node scripts/import-cofid.mjs <path-to-cofid.xlsx> [--out data/cofid.json]
//
// The spreadsheet is downloaded from gov.uk and is not kept in the repository;
// the JSON this produces is, because it is what ships.
//
// Attribution, required by the licence and correct anyway: "Contains public
// sector information licensed under the Open Government Licence v3.0."

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.log('\n  Usage: node scripts/import-cofid.mjs <path-to-cofid.xlsx>\n');
  process.exit(1);
}
const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : 'data/cofid.json';

// openpyxl does the reading. A JS xlsx parser would be another dependency in the
// app's tree for a script that runs once every few years, and the Python one is
// already on this machine.
const PY = `
import json, sys, openpyxl

wb = openpyxl.load_workbook(sys.argv[1], read_only=True)

def sheet_rows(name):
    ws = wb[name]
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    # CoFID puts two more label rows under the header before the data starts.
    next(rows); next(rows)
    return header, rows

def num(v):
    if v is None: return None
    s = str(v).strip()
    # The dataset's own conventions: Tr is a trace, N means not measured, and
    # a bracketed value is an estimate. A trace is zero; the rest are unknown,
    # and unknown must never be written as zero.
    if s in ('Tr', 'tr'): return 0.0
    if s in ('N', 'n', '', '-'): return None
    s = s.strip('()[]')
    try: return float(s)
    except ValueError: return None

prox_header, prox = sheet_rows('1.3 Proximates')
col = {h: i for i, h in enumerate(prox_header) if h}

foods = {}
for r in prox:
    code = r[col['Food Code']]
    name = r[col['Food Name']]
    if not code or not name: continue

    # FIBRE IS MEASURED TWO WAYS AND THEY ARE NOT THE SAME NUMBER. AOAC is the
    # international method and what a label in the shops reports; NSP is the
    # older UK one and reads about a third lower because it leaves out resistant
    # starch and lignin. AOAC covers 1,548 foods, NSP covers 2,538. Preferring
    # AOAC and falling back to NSP gets 2,640 of 2,887 - and fibre_basis says
    # which, so a number is never silently one method wearing the other's name.
    aoac = num(r[col['AOAC fibre (g)']])
    nsp = num(r[col['NSP (g)']])
    fibre = aoac if aoac is not None else nsp
    basis = 'AOAC' if aoac is not None else ('NSP' if nsp is not None else None)

    foods[str(code)] = {
        'code': str(code),
        'name': str(name).strip(),
        'group': str(r[col['Group']] or '').strip(),
        'kcal': num(r[col['Energy (kcal) (kcal)']]),
        'protein_g': num(r[col['Protein (g)']]),
        'fat_g': num(r[col['Fat (g)']]),
        'carbs_g': num(r[col['Carbohydrate (g)']]),
        'sodium_mg': None,
        # "Satd FA /100g fd" is saturated fat in grams per 100g OF FOOD, which
        # is what a food log wants. The column beside it, "Satd FA /100g FA",
        # is the saturated share of the FAT - so for a lean food it reads high
        # and for an oil it reads near its true value. Taking the wrong one
        # produces numbers that look reasonable and are a different quantity.
        'saturated_fat_g': num(r[col['Satd FA /100g fd (g)']]),
        'sugar_g': num(r[col['Total sugars (g)']]),
        'fibre_g': fibre,
        'fibre_basis': basis,
    }

# Sodium lives in its own sheet, in milligrams per 100g.
try:
    ino_header, ino = sheet_rows('1.4 Inorganics')
    icol = {h: i for i, h in enumerate(ino_header) if h}
    sodium_key = next((h for h in icol if h and h.lower().startswith('sodium')), None)
    if sodium_key:
        # The Inorganics sheet heads its first column with a single space
        # rather than "Food Code", so the code column is taken by position when
        # the name is not there. Found by reading the sheet, not by guessing.
        code_at = icol.get('Food Code', 0)
        for r in ino:
            code = r[code_at]
            if code is None: continue
            f = foods.get(str(code))
            if f: f['sodium_mg'] = num(r[icol[sodium_key]])
except Exception as e:
    print('sodium sheet skipped:', e, file=sys.stderr)

# A row with no energy and no protein describes nothing this app can use.
usable = [f for f in foods.values() if f['kcal'] is not None or f['protein_g'] is not None]
json.dump(usable, sys.stdout, ensure_ascii=False)
`;

const json = execFileSync('python', ['-c', PY, file], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const foods = JSON.parse(json);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(foods, null, 0));

const has = (k) => foods.filter((f) => f[k] != null).length;
const basis = (b) => foods.filter((f) => f.fibre_basis === b).length;
console.log(`\n  ${foods.length} foods written to ${out}`);
console.log(`    with energy:         ${has('kcal')}`);
console.log(`    with sodium:         ${has('sodium_mg')}`);
console.log(`    with saturated fat:  ${has('saturated_fat_g')}`);
console.log(`    with sugar:          ${has('sugar_g')}`);
console.log(`    with fibre:          ${has('fibre_g')}  (AOAC ${basis('AOAC')}, NSP ${basis('NSP')})`);
console.log('\n  Contains public sector information licensed under the Open Government Licence v3.0.\n');
