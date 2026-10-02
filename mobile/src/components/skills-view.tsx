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
// A RUNG WITH NO DEMONSTRATION IS SHOWN AS TEXT, AND SAYS SO.
//
// The 923-clip library has no handstand, no muscle up, no dead hang, no
// scapular pull and no bar dip - see lib/skill-ladders.ts for the full gap
// list. Ten of the rungs here are in that position, including every rung of
// Ruth's own muscle-up ladder.
//
// Her instruction, 29 September: name, cue, and the "Needs: X first" line. **No
// placeholder image and no broken clip frame.** For these rungs the cue IS the
// demonstration, which is why check-skill-clips.mjs refuses a text-only rung
// that does not carry one - a name on a card with nothing under it is exactly
// what reads as broken.
//
// THE SHORT NOTE STAYS, on her earlier standing decision that a missing
// demonstration should say so: "a blank where every other exercise has a clip
// does not read as 'we cover patterns, not names'; it reads as broken." A quiet
// line of text is not a placeholder image, so the two decisions agree.
//
// WORTH KNOWING: this view renders no clips at all yet, for any rung.
// `clip_match_key` is stored and unused, so "no broken frames" is currently
// true of every rung rather than only the text-only ones. When the player
// arrives here, the null case is already handled.

type Rung = {
  id: string;
  name: string;
  stage: 'now' | 'next' | 'goal';
  target: string | null;
  needs: string | null;
  detail: string | null;
  /** What it builds. Ruth's "Develops:" line. */
  develops: string | null;
  /** How to do it, e.g. a breathing cue. Guidance, never an exclusion. */
  cue: string | null;
  clip_match_key: string | null;
  session_entry_id: string | null;
};

type Skill = {
  id: string;
  name: string;
  /** One note for the whole ladder, e.g. her breathing note. Guidance. */
  ladder_note: string | null;
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
          supabase
            .from('user_skills')
            .select('id, name, ladder_note')
            .order('sort_order', { ascending: true }),
          supabase
            .from('user_skill_rungs')
            .select(
              'id, skill_id, name, stage, target, needs, detail, develops, cue, clip_match_key, session_entry_id'
            )
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
          (
            (skillsRes.error ? [] : (skillsRes.data ?? [])) as Omit<Skill, 'rungs'>[]
          ).map((s) => ({ ...s, rungs: bySkill.get(s.id) ?? [] }))
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
          {/* THE WHOLE-LADDER NOTE, above the rungs it applies to. Ruth's
              muscle-up ladder carries "keep breathing through every rep",
              which is true of all six rungs rather than any one of them.

              IT IS GUIDANCE AND NOT A RULE, which is why it is here and not
              in Rules. Her own note on approving it: "It excludes nothing and
              must NOT be written to user_rules." Rules remove movements; this
              describes how to do one. */}
          {skill.ladder_note ? (
            <ThemedText type="small" themeColor="textSecondary">
              {skill.ladder_note}
            </ThemedText>
          ) : null}

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
      {/* WHY THIS STEP, then WHAT IT BUILDS, then HOW TO DO IT. Three lines
          Ruth wrote as three lines. They were being folded into one
          paragraph, which reads as a wall and loses the distinction she made:
          a reason, an outcome, and a cue are not the same kind of sentence. */}
      {rung.detail ? (
        <ThemedText type="small" themeColor="textSecondary">
          {rung.detail}
        </ThemedText>
      ) : null}
      {rung.develops ? (
        <ThemedText type="small" themeColor="textSecondary">
          Develops: {rung.develops}
        </ThemedText>
      ) : null}
      {rung.cue ? (
        <ThemedText type="small" themeColor="textSecondary">
          {rung.cue}
        </ThemedText>
      ) : null}

      {rung.clip_match_key ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          Written, not filmed yet.
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
