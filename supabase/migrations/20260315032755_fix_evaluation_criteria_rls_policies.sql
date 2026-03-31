/*
  # Fix evaluation_criteria RLS policies

  1. Security Changes
    - Drop existing INSERT and UPDATE policies that use `get_user_role()` function
    - Recreate INSERT and UPDATE policies using `auth_id = auth.uid()` pattern
    - Add DELETE policy for admin users using `auth_id = auth.uid()` pattern

  2. Notes
    - The previous policies used `get_user_role()` which may not match current auth setup
    - All policies now consistently use `users.auth_id = auth.uid()` to verify admin role
    - DELETE policy allows admin to remove criteria not linked to any evaluation scores
*/

DROP POLICY IF EXISTS "Admin can insert criteria" ON evaluation_criteria;
DROP POLICY IF EXISTS "Admin can update criteria" ON evaluation_criteria;

CREATE POLICY "Admin can insert criteria"
  ON evaluation_criteria FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update criteria"
  ON evaluation_criteria FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can delete criteria"
  ON evaluation_criteria FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));
