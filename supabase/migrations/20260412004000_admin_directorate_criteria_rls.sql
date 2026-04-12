-- Allow admin to manage directorate-level criteria (directorate_id IS NOT NULL)
CREATE POLICY "admin_insert_directorate_criteria" ON department_criteria
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'admin' AND directorate_id IS NOT NULL
  );

CREATE POLICY "admin_update_directorate_criteria" ON department_criteria
  FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'admin' AND directorate_id IS NOT NULL
  ) WITH CHECK (
    get_user_role() = 'admin' AND directorate_id IS NOT NULL
  );

CREATE POLICY "admin_delete_directorate_criteria" ON department_criteria
  FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin' AND directorate_id IS NOT NULL
  );
