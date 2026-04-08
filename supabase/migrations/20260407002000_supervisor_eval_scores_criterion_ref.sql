-- =============================================
-- Add supervisor_criterion_id to supervisor_evaluation_scores
-- So supervisor evaluations use supervisor_criteria (not department_criteria)
-- =============================================

ALTER TABLE supervisor_evaluation_scores
  ADD COLUMN IF NOT EXISTS supervisor_criterion_id UUID REFERENCES supervisor_criteria(id);
