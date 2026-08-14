-- Sodium capture for the Body Measurement Interpretation Layer's salty-food /
-- water-retention flag (Part Nine). Estimated by the parse-food LLM at log time,
-- like the other macros. Nullable: older rows and any parse that omits it stay null.
alter table food_logs add column sodium_mg numeric;
