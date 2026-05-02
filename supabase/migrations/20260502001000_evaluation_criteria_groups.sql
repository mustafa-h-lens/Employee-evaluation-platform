-- Per-group general criteria. Until now, evaluation_criteria was a flat
-- global list summing to evaluation_settings.general_weight (typically 50%).
-- That worked when every directorate group used the default 50/50 split.
-- Once HR can set per-group weights (20260430001000), a group with
-- general_weight=60 needs general criteria summing to 60% — but the global
-- 50% list can't represent that.
--
-- Resolution: tag each evaluation_criteria row with an optional group_id.
--   * group_id IS NULL → the default "golden" set, used for any group whose
--     general_weight matches the system default.
--   * group_id = X     → custom general criteria for the specific
--     department_criteria_group X. These rows must sum to X.general_weight.
--
-- Cascade delete: removing the group cleans up its custom general criteria.
-- Existing global rows stay untouched (group_id defaults to NULL).

ALTER TABLE evaluation_criteria
  ADD COLUMN IF NOT EXISTS group_id uuid
    REFERENCES department_criteria_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_group
  ON evaluation_criteria(group_id);
