import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  PLACEMENTS,
  PLACEMENT_LABEL,
  SKILLS_EMPTY,
  skillTitle,
  type PlacementKey,
} from '@/lib/skills-copy';
import { supabase } from '@/lib/supabase';

// SKILLS: A PLACE TO KEEP THE THINGS SHE IS WORKING ON (Ruth, 5 October 2026).
//
//   "Skills is just a place to keep the things someone is working on. The user
//   does not know about progression ladders and does not need to."
//
// WHAT THIS REPLACED. Every skill was a ladder: a list of rungs tagged NOW, NEXT
// and GOAL, each with a "Needs: 5 strict pull-ups first" line, drawn from written
// ladders the app chose by matching her words. It was a lot of structure in front
// of somebody who had typed one sentence, and it could only ever cover the five
// movements the clip library could illustrate.
//
// A CARD IS THREE THINGS NOW: her words, where she is with it, and the date it
// was added. Below that, her own notes, newest first.
//
// NOTHING IS COUNTED. No streak, no total, no "3 of 7 rungs". Her rule for this
// tab twice over, and the reason skill_notes has no column anything could sum:
// the moment a number exists somebody renders it, and then a quiet record of what
// she did becomes a score she can be behind on.
//
// NOTHING LOGS ITSELF. A note is typed by her, here or in chat. There is no tap
// button, no session picker, and no session link - see her point 5: the data to
// reference a Session later is kept, and nothing uses it yet.

type Skill = {
  id: string;
  name: string;
  placement: PlacementKey | null;
  created_at: string;
};

type Note = {
  id: string;
  skill_id: string;
  note: string;
  created_at: string;
  updated_at: string | null;
};

const ADD_SKILL_LABEL = 'Add something you are working on';
const ADD_SKILL_PLACEHOLDER = 'In your own words';
const ADD_NOTE_PLACEHOLDER = 'A note about how it is going';
const PLACEMENT_PROMPT = 'Where are you with it?';

/** "Added 5 October", which is the only date on a card. */
function added(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `Added ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
}

function noteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function SkillsView() {
  const theme = useTheme();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const [newSkill, setNewSkill] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setFailed(true);
      setLoaded(true);
      return;
    }
    const [skillsRes, notesRes] = await Promise.all([
      supabase
        .from('user_skills')
        .select('id, name, placement, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('skill_notes')
        .select('id, skill_id, note, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);
    setFailed(Boolean(skillsRes.error || notesRes.error));
    setSkills((skillsRes.data ?? []) as Skill[]);
    setNotes((notesRes.data ?? []) as Note[]);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function addSkill() {
    const name = skillTitle(newSkill);
    if (!name) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setNewSkill('');
    const { error } = await supabase.from('user_skills').insert({ user_id: user.id, name });
    if (error) setFailed(true);
    await load();
  }

  async function setPlacement(skill: Skill, key: PlacementKey) {
    // A TAP, AND IT IS HERS TO CHANGE. Her point 2: "where she is with it (the
    // three choices above, changeable by a tap)".
    const next = skill.placement === key ? null : key;
    setSkills((list) => list.map((s) => (s.id === skill.id ? { ...s, placement: next } : s)));
    const { error } = await supabase
      .from('user_skills')
      .update({ placement: next })
      .eq('id', skill.id);
    if (error) {
      setFailed(true);
      await load();
    }
  }

  async function addNote(skill: Skill) {
    const text = (draft[skill.id] ?? '').trim();
    if (!text) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setDraft((d) => ({ ...d, [skill.id]: '' }));
    const { error } = await supabase
      .from('skill_notes')
      .insert({ user_id: user.id, skill_id: skill.id, note: text });
    if (error) setFailed(true);
    await load();
  }

  async function saveEdit(note: Note) {
    const text = editText.trim();
    if (!text) return;
    setEditing(null);
    const { error } = await supabase
      .from('skill_notes')
      .update({ note: text, updated_at: new Date().toISOString() })
      .eq('id', note.id);
    if (error) setFailed(true);
    await load();
  }

  async function removeNote(note: Note) {
    setConfirmRemove(null);
    const { error } = await supabase.from('skill_notes').delete().eq('id', note.id);
    if (error) setFailed(true);
    await load();
  }

  if (!loaded) return null;

  return (
    <View style={styles.wrap}>
      {/* ADDING ONE IS THE FIRST THING ON THE TAB, not behind a button. There is
          one kind of thing here and one way to make one. */}
      <View style={styles.group}>
        <ThemedText type="small">{ADD_SKILL_LABEL}</ThemedText>
        <View style={styles.addRow}>
          <TextInput
            value={newSkill}
            onChangeText={setNewSkill}
            placeholder={ADD_SKILL_PLACEHOLDER}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={ADD_SKILL_LABEL}
            onSubmitEditing={() => void addSkill()}
            returnKeyType="done"
            style={[
              styles.entry,
              styles.grow,
              { color: theme.text, borderColor: theme.backgroundSelected },
            ]}
          />
          <Pressable
            onPress={() => void addSkill()}
            disabled={!newSkill.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText
              type="smallBold"
              themeColor={newSkill.trim() ? 'accentDeep' : 'textSecondary'}>
              Add
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {skills.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {SKILLS_EMPTY}
        </ThemedText>
      )}

      {skills.map((skill) => {
        const mine = notes.filter((n) => n.skill_id === skill.id);
        return (
          <ThemedView key={skill.id} type="backgroundElement" style={styles.card}>
            {/* HER WORDS, AND THE DATE. Nothing else on the head of a card. */}
            <ThemedText type="smallBold">{skill.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {added(skill.created_at)}
              {skill.placement ? ` · ${PLACEMENT_LABEL[skill.placement]}` : ''}
            </ThemedText>

            <ThemedText type="small" themeColor="textSecondary" style={styles.prompt}>
              {PLACEMENT_PROMPT}
            </ThemedText>
            <View style={styles.chips}>
              {PLACEMENTS.map((p) => {
                const on = skill.placement === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => void setPlacement(skill, p.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={p.label}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor: on ? theme.backgroundSelected : theme.background,
                          borderColor: on ? theme.accentDeep : 'transparent',
                        },
                      ]}>
                      <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                        {p.label}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* THE QUICK LOG: text, a date, and nothing else. Newest first. */}
            <View style={styles.addRow}>
              <TextInput
                value={draft[skill.id] ?? ''}
                onChangeText={(t) => setDraft((d) => ({ ...d, [skill.id]: t }))}
                placeholder={ADD_NOTE_PLACEHOLDER}
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel={`A note about ${skill.name}`}
                onSubmitEditing={() => void addNote(skill)}
                returnKeyType="done"
                style={[
                  styles.entry,
                  styles.grow,
                  { color: theme.text, borderColor: theme.backgroundSelected },
                ]}
              />
              <Pressable
                onPress={() => void addNote(skill)}
                disabled={!(draft[skill.id] ?? '').trim()}
                accessibilityRole="button"
                accessibilityLabel="Save this note"
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText
                  type="smallBold"
                  themeColor={(draft[skill.id] ?? '').trim() ? 'accentDeep' : 'textSecondary'}>
                  Save
                </ThemedText>
              </Pressable>
            </View>

            {mine.map((note) => (
              <View key={note.id} style={styles.note}>
                <ThemedText type="small" themeColor="textSecondary">
                  {noteDate(note.created_at)}
                  {note.updated_at ? ' · edited' : ''}
                </ThemedText>
                {editing === note.id ? (
                  <View style={styles.addRow}>
                    <TextInput
                      value={editText}
                      onChangeText={setEditText}
                      accessibilityLabel="Edit this note"
                      onSubmitEditing={() => void saveEdit(note)}
                      returnKeyType="done"
                      style={[
                        styles.entry,
                        styles.grow,
                        { color: theme.text, borderColor: theme.backgroundSelected },
                      ]}
                    />
                    <Pressable
                      onPress={() => void saveEdit(note)}
                      accessibilityRole="button"
                      accessibilityLabel="Save the change"
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="smallBold" themeColor="accentDeep">
                        Save
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <ThemedText type="small">{note.note}</ThemedText>
                )}

                {/* REMOVING ASKS FIRST, like every other removal in this app.
                    A note is something she wrote; a stray tap should not take it. */}
                {confirmRemove === note.id ? (
                  <View style={styles.chips}>
                    <Pressable
                      onPress={() => void removeNote(note)}
                      accessibilityRole="button"
                      accessibilityLabel="Yes, remove this note"
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="smallBold" themeColor="danger">
                        Yes, remove it
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setConfirmRemove(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Keep this note"
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="smallBold" themeColor="accentDeep">
                        Keep it
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  editing !== note.id && (
                    <View style={styles.chips}>
                      <Pressable
                        onPress={() => {
                          setEditing(note.id);
                          setEditText(note.note);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Change this note"
                        style={({ pressed }) => pressed && styles.pressed}>
                        <ThemedText type="small" themeColor="accentDeep">
                          Change this
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmRemove(note.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Remove this note"
                        style={({ pressed }) => pressed && styles.pressed}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Remove
                        </ThemedText>
                      </Pressable>
                    </View>
                  )
                )}
              </View>
            ))}
          </ThemedView>
        );
      })}

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  group: { gap: Spacing.two },
  card: { borderRadius: CardRadius, padding: Spacing.four, gap: Spacing.two },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  grow: { flex: 1, minWidth: 0 },
  entry: {
    borderWidth: 1,
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  prompt: { paddingTop: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  note: { gap: Spacing.one, paddingTop: Spacing.two },
  pressed: { opacity: 0.6 },
});
