/*
  Enable directors to evaluate department managers using the director_evaluations table.
  Adds evaluation_type to distinguish CEO→director vs director→manager evaluations.
  Updates RLS policies and constraints accordingly.
*/

-- 1. Add evaluation_type column
ALTER TABLE director_evaluations ADD COLUMN IF NOT EXISTS evaluation_type text DEFAULT 'ceo_director'
  CHECK (evaluation_type IN ('ceo_director', 'director_manager'));

-- 2. Replace unique constraint: allow different evaluators per period
ALTER TABLE director_evaluations DROP CONSTRAINT IF EXISTS director_evaluations_director_id_period_id_key;
ALTER TABLE director_evaluations ADD CONSTRAINT director_evaluations_unique_eval
  UNIQUE (director_id, evaluator_id, period_id);

-- 3. Directors can insert/update/delete their own evaluations (where they are the evaluator)
CREATE POLICY "director_manage_own_evaluations" ON director_evaluations
  FOR ALL TO authenticated
  USING (get_user_role() = 'director' AND evaluator_id = auth.uid())
  WITH CHECK (get_user_role() = 'director' AND evaluator_id = auth.uid());

-- 4. Directors can manage their own evaluation scores
CREATE POLICY "director_manage_own_eval_scores" ON director_evaluation_scores
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'director'
    AND evaluation_id IN (
      SELECT id FROM director_evaluations WHERE evaluator_id = auth.uid()
    )
  )
  WITH CHECK (
    get_user_role() = 'director'
    AND evaluation_id IN (
      SELECT id FROM director_evaluations WHERE evaluator_id = auth.uid()
    )
  );

-- 5. Directors can manage their own specific criteria (department_id IS NULL, created_by = self)
CREATE POLICY "Director can insert own criteria"
  ON department_criteria FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'director' AND department_id IS NULL AND created_by = auth.uid());

CREATE POLICY "Director can update own criteria"
  ON department_criteria FOR UPDATE TO authenticated
  USING (get_user_role() = 'director' AND department_id IS NULL AND created_by = auth.uid())
  WITH CHECK (get_user_role() = 'director' AND department_id IS NULL AND created_by = auth.uid());

CREATE POLICY "Director can delete own criteria"
  ON department_criteria FOR DELETE TO authenticated
  USING (get_user_role() = 'director' AND department_id IS NULL AND created_by = auth.uid());
