import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../lib/supabase';

export async function POST(request: NextRequest) {
  const { id, activity_type, duration_min, kcal_burned, happened_at } = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('activity_logs')
    .update({ activity_type, duration_min, kcal_burned, happened_at })
    .eq('id', id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0]);
}