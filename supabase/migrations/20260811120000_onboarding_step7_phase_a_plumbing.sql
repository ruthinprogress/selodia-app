-- Build Order step 7 (real onboarding AI conversation), Phase A plumbing

alter table user_profile add column has_tape_measure boolean;

alter table user_profile add constraint onboarding_step_valid check (
  onboarding_step in ('not_started', 'intro', 'equipment', 'goals', 'technical_targets', 'nutrition_targets', 'activity_tdee', 'complete')
);

-- source: distinguishes onboarding turns from regular chat while keeping
-- both visible to the existing Daily/Weekly Roundup theme-extraction logic
alter table chat_messages add column source text not null default 'chat' check (source in ('chat', 'onboarding'));

-- classification: persisted per onboarding assistant turn so the next
-- request can detect "we just asked a clarifying question, interpret this
-- reply in that context" without relying on client-held conversation state
alter table chat_messages add column classification text check (
  classification in ('clear_goal', 'ambiguous_goal', 'ordinary_discouragement', 'ambiguous_distress', 'eating_related_distress', 'acute_crisis')
);
