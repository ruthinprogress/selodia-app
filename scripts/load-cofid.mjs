// Load data/cofid.json into public.food_composition.
//
// Separate from the import on purpose: importing parses a government
// spreadsheet and is run once an edition; loading writes to a database and may
// need running again against a new environment. Neither should have to redo the
// other's work.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/load-cofid.mjs
//
// The service role is required because food_composition is readable by everyone
// and writable by nobody - which is the point of it.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('\n  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}

const foods = JSON.parse(fs.readFileSync('data/cofid.json', 'utf8'));
const supabase = createClient(url, key, { auth: { persistSession: false } });

const rows = foods.map((f) => ({
  code: f.code,
  name: f.name,
  food_group: f.group || null,
  kcal: f.kcal,
  protein_g: f.protein_g,
  fat_g: f.fat_g,
  carbs_g: f.carbs_g,
  sodium_mg: f.sodium_mg,
  search_name: f.name.toLowerCase(),
}));

let done = 0;
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500);
  const { error } = await supabase.from('food_composition').upsert(batch, { onConflict: 'code' });
  if (error) {
    console.log('  batch failed:', error.message);
    process.exit(1);
  }
  done += batch.length;
  console.log(`  ${done}/${rows.length}`);
}

const { count } = await supabase
  .from('food_composition')
  .select('code', { count: 'exact', head: true });
console.log(`\n  food_composition now holds ${count} foods.\n`);
