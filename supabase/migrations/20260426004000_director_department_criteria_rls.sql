-- Allow directors (primary or secondary) to manage department-scoped private
-- criteria — i.e., rows on department_criteria where department_id IS NOT NULL.
-- The directorate ownership is looked up indirectly via departments.directorate_id.
-- Existing policies for department_id IS NULL rows (directorate-level criteria)
-- and admin-only policies remain in effect.

CREATE POLICY "director_insert_department_criteria"
  ON department_criteria FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'director'
    AND department_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM departments dep
      JOIN directorates d ON d.id = dep.directorate_id
      WHERE dep.id = department_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );

CREATE POLICY "director_update_department_criteria"
  ON department_criteria FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'director'
    AND department_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM departments dep
      JOIN directorates d ON d.id = dep.directorate_id
      WHERE dep.id = department_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  )
  WITH CHECK (
    get_user_role() = 'director'
    AND department_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM departments dep
      JOIN directorates d ON d.id = dep.directorate_id
      WHERE dep.id = department_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );

CREATE POLICY "director_delete_department_criteria"
  ON department_criteria FOR DELETE TO authenticated
  USING (
    get_user_role() = 'director'
    AND department_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM departments dep
      JOIN directorates d ON d.id = dep.directorate_id
      WHERE dep.id = department_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );
