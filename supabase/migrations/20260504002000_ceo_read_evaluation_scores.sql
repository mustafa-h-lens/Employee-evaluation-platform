-- The CEO needs to see every employee evaluation's criteria-level scores
-- in اعتمادية التقييمات (the approval queue). The existing CEO score
-- policy `ceo_can_manage_eval_scores` only grants access for evals the
-- CEO themselves manages, so for any director-authored evaluation the
-- CEO opens, the criteria tables came back empty.
--
-- Add a read-only CEO policy mirroring the existing `ceo_read_evaluations`
-- on the parent table.

CREATE POLICY "ceo_read_evaluation_scores" ON evaluation_scores
  FOR SELECT USING (get_user_role() = 'ceo');
