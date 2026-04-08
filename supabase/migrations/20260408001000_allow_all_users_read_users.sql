-- Allow all authenticated users to read the users table
-- Required for org structure page to work for all roles (employee, director, ceo, admin)
CREATE POLICY "All authenticated users can read users"
  ON users FOR SELECT
  TO authenticated
  USING (true);
