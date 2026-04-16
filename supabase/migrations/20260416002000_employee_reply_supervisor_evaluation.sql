-- Allow employees to update their own supervisor evaluations (to save their reply)
CREATE POLICY employee_reply_supervisor_evaluation
  ON supervisor_evaluations
  FOR UPDATE
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = get_user_id()))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = get_user_id()));
