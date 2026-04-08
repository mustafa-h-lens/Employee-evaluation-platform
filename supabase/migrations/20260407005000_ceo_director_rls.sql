-- RLS policies for CEO users acting as department directors
-- Allows CEOs assigned as director/secondary_director to evaluate employees

CREATE POLICY ceo_director_can_insert_evaluations ON evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'ceo'
    AND EXISTS (
      SELECT 1 FROM directorates d
      JOIN employees e ON e.directorate_id = d.id
      WHERE e.id = evaluations.employee_id
      AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );

CREATE POLICY ceo_director_can_update_evaluations ON evaluations
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'ceo' AND manager_id = get_user_id())
  WITH CHECK (get_user_role() = 'ceo' AND manager_id = get_user_id());

CREATE POLICY ceo_can_manage_eval_scores ON evaluation_scores
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'ceo'
    AND EXISTS (SELECT 1 FROM evaluations e WHERE e.id = evaluation_scores.evaluation_id AND e.manager_id = get_user_id())
  )
  WITH CHECK (
    get_user_role() = 'ceo'
    AND EXISTS (SELECT 1 FROM evaluations e WHERE e.id = evaluation_scores.evaluation_id AND e.manager_id = get_user_id())
  );
