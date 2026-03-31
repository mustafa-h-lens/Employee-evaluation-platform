/*
  # Fix audit_logs SELECT policy

  1. Security Changes
    - Drop existing SELECT policy that uses `get_user_role()` function
    - Recreate SELECT policy using `users.auth_id = auth.uid()` pattern

  2. Notes
    - Consistent with the auth_id pattern used across all other tables
    - Only admin users can view the audit log
*/

DROP POLICY IF EXISTS "Admin can view all audit logs" ON audit_logs;

CREATE POLICY "Admin can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));
