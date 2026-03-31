/*
  # Add admin delete policy for evaluation_periods

  1. Security Changes
    - Add DELETE policy on `evaluation_periods` for admin users
    - Allows admin to delete evaluation periods that have no associated evaluations

  2. Notes
    - Only admins can delete periods
    - This complements existing SELECT, INSERT, UPDATE policies
*/

CREATE POLICY "Admin can delete periods"
  ON evaluation_periods FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
