/*
  Allow evaluated persons to read their evaluations and reply with notes.
  - Employees can update employee_note on their own evaluations
  - Directors (as evaluated) can update director_note on their evaluations
  - Managers can read and reply to director_evaluations where they are the evaluated person
*/

-- 1. Employees can update their own evaluation's employee_note
CREATE POLICY "employee_can_reply_to_evaluation" ON evaluations
  FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'employee'
    AND employee_id IN (SELECT id FROM employees WHERE user_id = get_user_id())
  )
  WITH CHECK (
    get_user_role() = 'employee'
    AND employee_id IN (SELECT id FROM employees WHERE user_id = get_user_id())
  );

-- 2. Directors (as evaluated person) can update director_note on their evaluations
CREATE POLICY "director_can_reply_as_evaluated" ON director_evaluations
  FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'director'
    AND director_id = get_user_id()
  )
  WITH CHECK (
    get_user_role() = 'director'
    AND director_id = get_user_id()
  );

-- 3. Managers can read director_evaluations where they are the evaluated person
CREATE POLICY "manager_read_own_director_evaluations" ON director_evaluations
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'manager'
    AND director_id = get_user_id()
    AND evaluation_type = 'director_manager'
  );

-- 4. Managers can update director_note on their own evaluations (reply)
CREATE POLICY "manager_can_reply_to_evaluation" ON director_evaluations
  FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'manager'
    AND director_id = get_user_id()
    AND evaluation_type = 'director_manager'
  )
  WITH CHECK (
    get_user_role() = 'manager'
    AND director_id = get_user_id()
    AND evaluation_type = 'director_manager'
  );

-- 5. Managers can read director_evaluation_scores for their own evaluations
CREATE POLICY "manager_read_own_director_eval_scores" ON director_evaluation_scores
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'manager'
    AND evaluation_id IN (
      SELECT id FROM director_evaluations
      WHERE director_id = get_user_id() AND evaluation_type = 'director_manager'
    )
  );
