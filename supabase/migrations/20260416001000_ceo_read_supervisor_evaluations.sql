-- Allow CEO to read supervisor evaluations and scores (needed for اعتمادية التقييمات page)

CREATE POLICY "ceo_read_supervisor_evaluations" ON supervisor_evaluations
  FOR SELECT USING (get_user_role() = 'ceo');

CREATE POLICY "ceo_read_supervisor_evaluation_scores" ON supervisor_evaluation_scores
  FOR SELECT USING (get_user_role() = 'ceo');

-- Also allow CEO to update supervisor evaluations (for approve/reject actions)
CREATE POLICY "ceo_update_supervisor_evaluations" ON supervisor_evaluations
  FOR UPDATE USING (get_user_role() = 'ceo');
