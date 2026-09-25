import { useEffect, useState } from 'react';

import type { BurnFigures } from '@/components/what-you-burn';
import { resolveTDEE } from '@/lib/body-metrics';
import { supabase } from '@/lib/supabase';

// BMR AND TDEE, FOR WHOEVER IS DRAWING THEM (2026-09-25).
//
// The Today screen used to compute these on its way past - it already calls
// resolveTDEE for the calorie target - and hand them to the "What you burn"
// panel. Today no longer carries that panel: the greeting fix freed room for
// the Health Flower and exactly one of the two small things beneath it, and
// Ruth chose the daily line. The panel moved to the Body screen, one tap from
// the Body square it explains.
//
// So the figures needed a home that is not a particular screen. This is it, and
// it is a hook rather than a second copy of the twelve lines Today already had,
// because two copies of an estimate about somebody's body is how the two start
// disagreeing with each other.
//
// NULL MEANS "NOT ENOUGH TO SAY", NOT ZERO. resolveTDEE returns null when
// height, age, sex or a weight is missing, and the panel draws nothing at all
// rather than a dash. An estimate nobody can make is not a figure with a gap in
// it.
export function useBurnFigures(reloadKey?: number): BurnFigures {
  const [figures, setFigures] = useState<BurnFigures>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes both reads to the signed-in person.
      const [{ data: latest }, { data: profile }] = await Promise.all([
        supabase
          .from('body_measurements')
          .select('weight_kg, bmr')
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('user_profile')
          .select('height_cm, date_of_birth, biological_sex, activity_level')
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const row = latest as { weight_kg: number | null; bmr: number | null } | null;
      const p = profile as {
        height_cm: number | null;
        date_of_birth: string | null;
        biological_sex: string | null;
        activity_level: string | null;
      } | null;

      const tdee = resolveTDEE({
        // The scale's own BMR when it took one, which beats any formula.
        scaleBmr: row?.bmr ?? null,
        weightKg: row?.weight_kg ?? null,
        heightCm: p?.height_cm ?? null,
        dateOfBirth: p?.date_of_birth ?? null,
        biologicalSex: p?.biological_sex ?? null,
        activityLevel: p?.activity_level ?? null,
      });

      setFigures(
        tdee
          ? { bmr: tdee.bmrKcal, tdee: tdee.tdeeKcal, estimated: tdee.bmrSource === 'estimated_bmr' }
          : null
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return figures;
}
