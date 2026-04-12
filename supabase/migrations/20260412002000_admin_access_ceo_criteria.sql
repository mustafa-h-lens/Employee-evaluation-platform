-- Allow admin role to manage CEO/director criteria (department_id IS NULL)

-- Drop existing CEO-only policies
DROP POLICY IF EXISTS "CEO can insert director criteria" ON department_criteria;
DROP POLICY IF EXISTS "CEO can update director criteria" ON department_criteria;
DROP POLICY IF EXISTS "CEO can delete director criteria" ON department_criteria;
DROP POLICY IF EXISTS "ceo_insert_director_criteria" ON department_criteria;
DROP POLICY IF EXISTS "ceo_update_director_criteria" ON department_criteria;
DROP POLICY IF EXISTS "ceo_delete_director_criteria" ON department_criteria;

-- Recreate with admin access included
CREATE POLICY "ceo_admin_insert_director_criteria" ON department_criteria
  FOR INSERT WITH CHECK (
    (get_user_role() IN ('ceo', 'admin')) AND department_id IS NULL
  );

CREATE POLICY "ceo_admin_update_director_criteria" ON department_criteria
  FOR UPDATE USING (
    (get_user_role() IN ('ceo', 'admin')) AND department_id IS NULL
  ) WITH CHECK (
    (get_user_role() IN ('ceo', 'admin')) AND department_id IS NULL
  );

CREATE POLICY "ceo_admin_delete_director_criteria" ON department_criteria
  FOR DELETE USING (
    (get_user_role() IN ('ceo', 'admin')) AND department_id IS NULL
  );
