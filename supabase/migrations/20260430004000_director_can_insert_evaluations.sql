-- The evaluations table had INSERT policies for managers (legacy
-- employees.manager_id link) and for CEOs acting as directors, but no
-- INSERT policy for users with role='director'. After we shipped
-- directorate-scoped evaluations (20260430002000) directors saving an
-- evaluation hit "new row violates row-level security policy" because
-- nothing matched. Add INSERT + UPDATE policies that authorize the
-- director(s) of the evaluation's directorate (primary OR secondary).

DROP POLICY IF EXISTS director_can_insert_evaluations ON evaluations;
CREATE POLICY director_can_insert_evaluations ON evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    private.get_user_role() = 'director'
    AND manager_id = private.get_user_id()
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = evaluations.directorate_id
        AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  );

DROP POLICY IF EXISTS director_can_update_evaluations ON evaluations;
CREATE POLICY director_can_update_evaluations ON evaluations
  FOR UPDATE TO authenticated
  USING (
    private.get_user_role() = 'director'
    AND manager_id = private.get_user_id()
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = evaluations.directorate_id
        AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  )
  WITH CHECK (
    private.get_user_role() = 'director'
    AND manager_id = private.get_user_id()
    AND EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = evaluations.directorate_id
        AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  );

-- Same gap exists on evaluation_scores: directors need to be able to
-- insert their own evaluation's scores. The existing policies cover
-- managers and CEOs. Add a director-scoped one keyed on the parent
-- evaluation's directorate ownership.
DROP POLICY IF EXISTS director_can_insert_evaluation_scores ON evaluation_scores;
CREATE POLICY director_can_insert_evaluation_scores ON evaluation_scores
  FOR INSERT TO authenticated
  WITH CHECK (
    private.get_user_role() = 'director'
    AND EXISTS (
      SELECT 1
        FROM evaluations e
        JOIN directorates d ON d.id = e.directorate_id
       WHERE e.id = evaluation_scores.evaluation_id
         AND e.manager_id = private.get_user_id()
         AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  );

DROP POLICY IF EXISTS director_can_update_evaluation_scores ON evaluation_scores;
CREATE POLICY director_can_update_evaluation_scores ON evaluation_scores
  FOR UPDATE TO authenticated
  USING (
    private.get_user_role() = 'director'
    AND EXISTS (
      SELECT 1
        FROM evaluations e
        JOIN directorates d ON d.id = e.directorate_id
       WHERE e.id = evaluation_scores.evaluation_id
         AND e.manager_id = private.get_user_id()
         AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  )
  WITH CHECK (
    private.get_user_role() = 'director'
    AND EXISTS (
      SELECT 1
        FROM evaluations e
        JOIN directorates d ON d.id = e.directorate_id
       WHERE e.id = evaluation_scores.evaluation_id
         AND e.manager_id = private.get_user_id()
         AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  );

DROP POLICY IF EXISTS director_can_delete_evaluation_scores ON evaluation_scores;
CREATE POLICY director_can_delete_evaluation_scores ON evaluation_scores
  FOR DELETE TO authenticated
  USING (
    private.get_user_role() = 'director'
    AND EXISTS (
      SELECT 1
        FROM evaluations e
        JOIN directorates d ON d.id = e.directorate_id
       WHERE e.id = evaluation_scores.evaluation_id
         AND e.manager_id = private.get_user_id()
         AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  );
