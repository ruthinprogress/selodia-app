import type { SupabaseClient } from '@supabase/supabase-js';

// The Almanac write path (build item 15). Mirrors the [REMEMBER] -> user_context
// pattern: the model emits a structured save via the classify tool, and the
// route persists it here. Confirm-first ("Should we save this to your Almanac?")
// is handled at the PROMPT level - the model only emits a save after the person
// has agreed - so this simply persists on emit. Re-confirmation / instance-count
// lifecycle is deferred (this does a clean insert). Everything is coerced so
// malformed model output can never crash a save.

export type AlmanacContent = Record<string, unknown>;

export type AlmanacEntry = {
  id: string;
  kind: string;
  title: string;
  category: string | null;
  content: AlmanacContent;
  status: string;
  instance_count: number;
  last_confirmed_at: string;
  created_at: string;
  updated_at: string;
};

// The raw fields the model emits; all loose so bad output is handled, not thrown.
export type AlmanacSaveInput = {
  kind?: unknown;
  title?: unknown;
  category?: unknown;
  content?: unknown;
};

const trimStr = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

// content must land as a plain JSON object. A model that emits a bare string is
// wrapped as { summary } so nothing is lost; arrays/null/other collapse to {}.
function coerceContent(v: unknown): AlmanacContent {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? { summary: t } : {};
  }
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    return v as AlmanacContent;
  }
  return {};
}

// Validate + coerce a proposed save into insert-ready fields, or null when it
// isn't a real save (kind or title missing). kind stays open text; title is
// required; content becomes a JSON object.
export function prepareAlmanacEntry(input: AlmanacSaveInput): {
  kind: string;
  title: string;
  category: string | null;
  content: AlmanacContent;
} | null {
  const kind = trimStr(input.kind);
  const title = trimStr(input.title);
  if (!kind || !title) return null;
  return {
    kind,
    title,
    category: trimStr(input.category),
    content: coerceContent(input.content),
  };
}

// Persist a proposed Almanac save. Returns the stored row, or null when the
// input isn't a real save or the insert fails - so the caller only ever confirms
// a save that actually happened (the storage-honesty rule).
export async function saveAlmanacEntry(
  supabase: SupabaseClient,
  userId: string,
  input: AlmanacSaveInput
): Promise<AlmanacEntry | null> {
  const prepared = prepareAlmanacEntry(input);
  if (!prepared) return null;
  const { data, error } = await supabase
    .from('almanac_entries')
    .insert({ user_id: userId, ...prepared })
    .select()
    .single();
  if (error) {
    console.log('almanac_entries insert failed:', error.message);
    return null;
  }
  return data as AlmanacEntry;
}
