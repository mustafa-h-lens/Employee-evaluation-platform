-- Allow directors (primary or secondary) to manage criteria scoped to a
-- directorate they manage. Replaces the old policy that required
-- `created_by = auth.uid()`, which broke when criteria were shared between
-- co-directors (and which compared auth.uid() to public.users.id anyway).

DROP POLICY IF EXISTS "Director can insert own criteria" ON department_criteria;
DROP POLICY IF EXISTS "Director can update own criteria" ON department_criteria;
DROP POLICY IF EXISTS "Director can delete own criteria" ON department_criteria;

CREATE POLICY "director_insert_directorate_criteria"
  ON department_criteria FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'director'
    AND department_id IS NULL
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
    get_user_role() = 'director'
    AND department_id IS NULL
    AND directorate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  )
  WITH CHECK (
    get_user_role() = 'director'
    AND department_id IS NULL
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
    get_user_role() = 'director'
    AND department_id IS NULL
    AND directorate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );
