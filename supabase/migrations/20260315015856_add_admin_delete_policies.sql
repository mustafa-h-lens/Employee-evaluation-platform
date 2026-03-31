/*
  # Add delete policies for admin

  1. Security Changes
    - Add DELETE policy on `users` table for admin role
    - Add DELETE policy on `departments` table for admin role
    - Add DELETE policy on `employees` table for admin role

  2. Notes
    - Only admin can delete records
    - Uses the existing get_user_role() helper function
*/

CREATE POLICY "Admin can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');
