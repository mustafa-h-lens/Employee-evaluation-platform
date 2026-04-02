/*
  Allow CEO to read all employees (needed for PendingApprovals joined queries).
*/
CREATE POLICY "ceo_read_all_employees" ON employees
  FOR SELECT TO authenticated
  USING (get_user_role() = 'ceo');
