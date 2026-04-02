/*
  Allow CEO to create specific criteria for director evaluations.
  These are stored in department_criteria with department_id = NULL.
*/

-- 1. Allow NULL department_id for CEO-created criteria
ALTER TABLE department_criteria ALTER COLUMN department_id DROP NOT NULL;

-- 2. CEO can insert criteria with department_id IS NULL
CREATE POLICY "CEO can insert director criteria"
  ON department_criteria FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() = 'ceo'
    AND department_id IS NULL
  );

-- 3. CEO can update their own director criteria
CREATE POLICY "CEO can update director criteria"
  ON department_criteria FOR UPDATE
  TO authenticated
  USING (
    get_user_role() = 'ceo'
    AND department_id IS NULL
  )
  WITH CHECK (
    get_user_role() = 'ceo'
    AND department_id IS NULL
  );

-- 4. CEO can delete their own director criteria
CREATE POLICY "CEO can delete director criteria"
  ON department_criteria FOR DELETE
  TO authenticated
  USING (
    get_user_role() = 'ceo'
    AND department_id IS NULL
  );
