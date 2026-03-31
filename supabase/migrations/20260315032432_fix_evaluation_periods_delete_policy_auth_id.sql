/*
  # Fix evaluation_periods DELETE policy to use auth_id

  1. Security Changes
    - Drop existing DELETE policy on `evaluation_periods` that incorrectly checks `users.id = auth.uid()`
    - Recreate DELETE policy checking `users.auth_id = auth.uid()` instead

  2. Notes
    - The `users` table uses a separate `auth_id` column to link to Supabase Auth
    - `auth.uid()` returns the Supabase Auth user ID, which maps to `users.auth_id`, not `users.id`
    - This fix allows admin users to successfully delete evaluation periods
*/

DROP POLICY IF EXISTS "Admin can delete periods" ON evaluation_periods;

CREATE POLICY "Admin can delete periods"
  ON evaluation_periods FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));
