-- The limiting amino acid, captured per item at log time.
--
-- WHY protein_source WAS NOT ENOUGH. Found live 2026-08-27: the meal commentary
-- told Ruth to add dairy to a breakfast that already contained yoghurt. The
-- immediate cause was per-item reasoning promoted to a meal-level sentence, but
-- the structural one is that {animal, plant, collagen} CANNOT express
-- complementarity. Complementarity is about WHICH amino acid is limiting:
-- legumes are lysine-rich and methionine-limited, grains are the reverse.
-- Lentils + rice is complete; lentils + chickpeas is not. Both are "plant,
-- plant", so no logic over protein_source could ever tell them apart.
--
-- Classified by the parse LLM, which already has the food in front of it - the
-- sodium precedent (Part Four, 2026-08-14) and principle 13's actual argument:
-- capture via understanding at the point the understanding exists, never a
-- downstream keyword list. The MODEL judges the food; the completeness
-- REASONING stays deterministic code, the same split the safety machine draws.
--
-- Unconstrained text, coerced valid-or-null in code exactly like protein_source,
-- so a stray classification can never fail a whole food log.
alter table food_items add column amino_profile text;

-- Mirrored onto the log for the same reason protein_source is: an un-itemised
-- 'simple' log has no food_items rows at all, so a future day-level assessment
-- would silently skip every apple and branded yoghurt without this.
alter table food_logs add column amino_profile text;
