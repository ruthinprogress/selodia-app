import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../lib/supabase';

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();

  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}