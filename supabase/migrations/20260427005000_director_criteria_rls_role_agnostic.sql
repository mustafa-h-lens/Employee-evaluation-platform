-- Directors who happen to also be CEOs (their users.role = 'ceo' but they're
-- assigned as a directorate's director_id or secondary_director_id) were
-- being rejected by the department_criteria RLS because the policies
-- required get_user_role() = 'director'. Directorate OWNERSHIP is the real
-- authorization — regardless of whether the user's role label is 'director'
-- or 'ceo'. Drop the role gate; keep the ownership EXISTS check.

-- Drop existing role-gated policies
DROP POLICY IF EXISTS "director_insert_department_criteria" ON department_criteria;
DROP POLICY IF EXISTS "director_update_department_criteria" ON department_criteria;
DROP POLICY IF EXISTS "director_delete_department_criteria" ON department_criteria;
DROP POLICY IF EXISTS "director_insert_directorate_criteria" ON department_criteria;
DROP POLICY IF EXISTS "director_update_directorate_criteria" ON department_criteria;
DROP POLICY IF EXISTS "director_delete_directorate_criteria" ON department_criteria;

-- Recreate: department-scoped (department_id IS NOT NULL) — anyone who owns
-- the parent directorate can manage these.
CREATE POLICY "director_insert_department_criteria"
  ON department_criteria FOR INSERT TO authenticated
  WITH CHECK (
    department_id IS NOT NULL
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
    department_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM departments dep
      JOIN directorates d ON d.id = dep.directorate_id
      WHERE dep.id = department_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  )
  WITH CHECK (
    department_id IS NOT NULL
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
    department_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM departments dep
      JOIN directorates d ON d.id = dep.directorate_id
      WHERE dep.id = department_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );

-- Directorate-scoped (department_id IS NULL, directorate_id NOT NULL)
CREATE POLICY "director_insert_directorate_criteria"
  ON department_criteria FOR INSERT TO authenticated
  WITH CHECK (
    department_id IS NULL
    AND directorate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );

CREATE POLICY "director_update_directorate_criteria"
  ON department_criteria FOR UPDATE TO authenticated
  USING (
    department_id IS NULL
    AND directorate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  )
  WITH CHECK (
    department_id IS NULL
    AND directorate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );

CREATE POLICY "director_delete_directorate_criteria"
  ON department_criteria FOR DELETE TO authenticated
  USING (
    department_id IS NULL
    AND directorate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );
