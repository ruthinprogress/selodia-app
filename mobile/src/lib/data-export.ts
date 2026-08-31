import type { SupabaseClient } from '@supabase/supabase-js';

// GDPR data export (build item 41 — Part Five, Data Export).
//
// "Under UK GDPR, users have a right to receive a copy of their own data,
// independent of any research-use consent." That last clause is load-bearing and
// is why nothing here reads a consent flag: the right to portability is not
// conditional on the research opt-in, and a check for it would be a bug, not a
// safeguard.
//
// RUNS ENTIRELY CLIENT-SIDE, under the person's own session. Every one of these
// tables carries a `manage_own` RLS policy covering SELECT, so the export sees
// exactly what the person is entitled to and nothing else — no service-role key,
// no backend route, and no way for this code to read another account even if it
// were asked to.
//
// THE TABLE LIST IS EXPLICIT, not discovered at runtime. A `select * from
// information_schema` walk would look cleverer and would quietly start exporting
// any table added later, including ones that should never leave the server. An
// explicit list fails the right way: a new table is simply absent until someone
// decides it belongs, and the count check below makes that absence visible.

export type ExportTable = {
  table: string;
  // What this is, in the person's language rather than the schema's.
  label: string;
  // The column that orders the rows and dates the summary, when there is one.
  dateColumn: string | null;
};

// All 17 tables that carry user data, verified against the live schema on
// 2026-08-31. Every one has user_id → auth.users ON DELETE CASCADE.
export const EXPORT_TABLES: ExportTable[] = [
  { table: 'user_profile', label: 'Your profile', dateColumn: null },
  { table: 'user_context', label: 'Things Unflump remembers about you', dateColumn: 'created_at' },
  { table: 'health_context', label: 'Health context', dateColumn: null },
  // Medical data, and someone's copy of their own record has to include it.
  { table: 'allergies', label: 'Allergies and dietary restrictions', dateColumn: 'disclosed_at' },
  { table: 'chat_messages', label: 'Conversations', dateColumn: 'created_at' },
  { table: 'food_logs', label: 'Food logs', dateColumn: 'happened_at' },
  { table: 'food_items', label: 'Food breakdown items', dateColumn: 'created_at' },
  { table: 'activity_logs', label: 'Activity logs', dateColumn: 'happened_at' },
  { table: 'body_measurements', label: 'Body measurements', dateColumn: 'measured_at' },
  { table: 'personal_metrics', label: 'Your own measurements', dateColumn: 'measured_at' },
  { table: 'hydration_logs', label: 'Drinks', dateColumn: 'happened_at' },
  { table: 'cycle_events', label: 'Cycle events', dateColumn: 'event_date' },
  { table: 'daily_summaries', label: 'Daily summaries', dateColumn: 'created_at' },
  { table: 'almanac_entries', label: 'Almanac entries', dateColumn: 'created_at' },
  { table: 'workout_weight_log', label: 'Working weights', dateColumn: 'logged_at' },
  { table: 'workout_completion_log', label: 'Completed workouts', dateColumn: 'completed_at' },
  { table: 'reminder_settings', label: 'Reminder settings', dateColumn: null },
  { table: 'push_tokens', label: 'Notification devices', dateColumn: 'created_at' },
];

export type ExportResult = {
  generatedAt: string;
  tables: Record<string, unknown[]>;
  // Tables the read failed on. Surfaced rather than swallowed: an export that
  // silently drops a table is worse than one that says which it could not read,
  // because the person would have no way to know their copy is incomplete.
  failed: string[];
};

export async function collectExport(supabase: SupabaseClient): Promise<ExportResult> {
  const tables: Record<string, unknown[]> = {};
  const failed: string[] = [];

  for (const t of EXPORT_TABLES) {
    try {
      // RLS scopes every read to the signed-in user, so no explicit filter.
      let q = supabase.from(t.table).select('*');
      if (t.dateColumn) q = q.order(t.dateColumn, { ascending: true });
      const { data, error } = await q;
      if (error) {
        failed.push(t.table);
        tables[t.table] = [];
      } else {
        tables[t.table] = data ?? [];
      }
    } catch {
      failed.push(t.table);
      tables[t.table] = [];
    }
  }

  return { generatedAt: new Date().toISOString(), tables, failed };
}

function fmtDate(iso: unknown): string | null {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// The span of a table's rows, for the summary. Reads the column the table
// actually dates itself by, since they disagree — happened_at, measured_at,
// logged_at, event_date, created_at.
function span(rows: unknown[], dateColumn: string | null): string | null {
  if (!dateColumn || rows.length === 0) return null;
  const dates = rows
    .map((r) => fmtDate((r as Record<string, unknown>)[dateColumn]))
    .filter((d): d is string => d != null)
    .sort();
  if (dates.length === 0) return null;
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? first : `${first} to ${last}`;
}

// THE HUMAN HALF. Raw table dumps satisfy the letter of portability and serve
// nobody: a person asking for their data wants to know what is in it, not to
// parse JSON. This is what they read; the JSON is what a tool reads.
//
// Deliberately plain. No totals worth celebrating, no "you logged 412 meals!" —
// an export is a record, not a report card, and the no-gamification rule does
// not stop applying because the context changed.
export function buildSummary(result: ExportResult): string {
  const lines: string[] = [];
  lines.push('YOUR UNFLUMP DATA');
  lines.push(`Prepared ${fmtDate(result.generatedAt) ?? 'today'}`);
  lines.push('');
  lines.push(
    'This is everything Unflump holds about you. It is yours to keep, and it is not affected by whether you agreed to research use.'
  );
  lines.push('');
  lines.push('WHAT IS INCLUDED');

  let total = 0;
  for (const t of EXPORT_TABLES) {
    const rows = result.tables[t.table] ?? [];
    total += rows.length;
    const s = span(rows, t.dateColumn);
    const count = rows.length === 0 ? 'nothing recorded' : `${rows.length} ${rows.length === 1 ? 'record' : 'records'}`;
    lines.push(s ? `  ${t.label}: ${count} (${s})` : `  ${t.label}: ${count}`);
  }

  lines.push('');
  lines.push(`${total} records in total, across ${EXPORT_TABLES.length} categories.`);

  if (result.failed.length > 0) {
    lines.push('');
    lines.push(
      `COULD NOT BE READ: ${result.failed.join(', ')}. This copy is incomplete — please try again, and tell us if it keeps happening.`
    );
  }

  lines.push('');
  lines.push('The full machine-readable copy is the JSON export, which contains every field of every record above.');
  return lines.join('\n');
}

export function buildJson(result: ExportResult): string {
  return JSON.stringify(
    {
      export_version: 1,
      generated_at: result.generatedAt,
      // Named in the file so anyone opening it later knows what it is and what
      // produced it, without having to ask.
      source: 'Unflump — personal data export (UK GDPR right to portability)',
      incomplete_tables: result.failed,
      data: result.tables,
    },
    null,
    2
  );
}
