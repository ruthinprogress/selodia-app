import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// SKILLS: Now, Next, Goal. Nothing else.
//
// NO TIMEFRAMES, against her own prototype and on her own instruction. The
// prototype has "INTERMEDIATE - MONTHS 3-6" and "GOALS - MONTHS 6-18"; the brief
// says "Now / Next / Goal only, no timeframes". A month range on a skill is a
// deadline with better manners, and a woman still on the first rung in month
// seven has been handed a way to feel behind at something she took up for fun.
//
// EVERY RUNG CARRIES EITHER A TARGET OR A PREREQUISITE, which is the brief's
// rule and is also what makes a ladder different from a list: "Needs: 5 strict
// pull-ups first" tells her why a rung is not hers yet, and that it will be.
//
// A RUNG WITH NO DEMONSTRATION SAYS SO. The 923-clip library cannot show a
// handstand, a muscle up, a dead hang or a scapular pull - see
// lib/skill-ladders.ts for the full gap list - so a rung whose clip is missing
// states that rather than showing an empty box. An app that silently omits the
// demonstration teaches people the feature is broken.

type Rung = {
  id: string;
  name: string;
  stage: 'now' | 'next' | 'goal';
  target: string | null;
  needs: string | null;
  detail: string | null;
  clip_match_key: string | null;
  session_entry_id: string | null;
};

type Skill = {
  id: string;
  name: string;
  rungs: Rung[];
};

export const SKILLS_EMPTY = 'No skills yet';
export const SKILLS_EMPTY_BODY =
  'Tell Selodía what you would like to be able to do, and it will work out what to practise now, what comes next, and what it builds towards.';

const STAGE_LABEL: Record<Rung['stage'], string> = {
  now: 'NOW',
  next: 'NEXT',
  goal: 'GOAL',
};

export function SkillsView({ onOpenSession }: { onOpenSession?: (entryId: string) => void }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [skillsRes, rungsRes] = await Promise.all([
          supabase.from('user_skills').select('id, name').order('sort_order', { ascending: true }),
          supabase
            .from('user_skill_rungs')
            .select('id, skill_id, name, stage, target, needs, detail, clip_match_key, session_entry_id')
            .order('sort_order', { ascending: true }),
        ]);
        if (cancelled) return;

        const rows = (rungsRes.error ? [] : (rungsRes.data ?? [])) as (Rung & { skill_id: string })[];
        const bySkill = new Map<string, Rung[]>();
        for (const row of rows) {
          const list = bySkill.get(row.skill_id) ?? [];
          list.push(row);
          bySkill.set(row.skill_id, list);
        }

        setSkills(
          ((skillsRes.error ? [] : (skillsRes.data ?? [])) as { id: string; name: string }[]).map(
            (s) => ({ ...s, rungs: bySkill.get(s.id) ?? [] })
          )
        );
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (!loaded) return null;

  if (skills.length === 0) {
    return (
      <Pressable
        onPress={() => router.push('/')}
        accessibilityRole="link"
        accessibilityLabel={`${SKILLS_EMPTY}. ${SKILLS_EMPTY_BODY}`}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{SKILLS_EMPTY}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {SKILLS_EMPTY_BODY}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.block}>
      {skills.map((skill) => (
        <ThemedView key={skill.id} style={styles.skill}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
            {skill.name}
          </ThemedText>
          {skill.rungs.map((rung) => (
            <RungRow key={rung.id} rung={rung} onOpenSession={onOpenSession} />
          ))}
        </ThemedView>
      ))}

      <ThemedText type="small" themeColor="textSecondary">
        There are no dates on any of this. A rung moves when you are ready for it, and you can say
        so in chat whenever that is.
      </ThemedText>
    </ThemedView>
  );
}

function RungRow({
  rung,
  onOpenSession,
}: {
  rung: Rung;
  onOpenSession?: (entryId: string) => void;
}) {
  const theme = useTheme();
  const openable = Boolean(rung.session_entry_id && onOpenSession);

  const body = (
    <ThemedView
      type={rung.stage === 'goal' ? 'backgroundElement' : 'backgroundSelected'}
      style={[styles.rung, rung.stage === 'now' && { borderColor: theme.accentDeep }]}>
      <View style={styles.rungTop}>
        <ThemedText type="small" style={styles.rungName}>
          {rung.name}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor={rung.stage === 'now' ? 'accentDeep' : 'textSecondary'}>
          {STAGE_LABEL[rung.stage]}
        </ThemedText>
      </View>

      {/* A TARGET OR A PREREQUISITE, never neither. "Needs: X first" is what
          makes a ladder a ladder rather than a wish list. */}
      {rung.target ? (
        <ThemedText type="small" themeColor="accentDeep">
          Target: {rung.target}
        </ThemedText>
      ) : null}
      {rung.needs ? (
        <ThemedText type="small" themeColor="accentDeep">
          Needs: {rung.needs} first
        </ThemedText>
      ) : null}
      {rung.detail ? (
        <ThemedText type="small" themeColor="textSecondary">
          {rung.detail}
        </ThemedText>
      ) : null}

      {rung.clip_match_key ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          No demonstration for this one yet.
        </ThemedText>
      )}
    </ThemedView>
  );

  return openable ? (
    <Pressable
      onPress={() => onOpenSession?.(rung.session_entry_id as string)}
      accessibilityRole="link"
      accessibilityLabel={`${rung.name}, ${STAGE_LABEL[rung.stage]}, open the session that trains it`}
      style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.three },
  skill: { gap: Spacing.two },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
  rung: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: Spacing.one,
  },
  rungTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rungName: { flexShrink: 1 },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  pressed: { opacity: 0.7 },
});
