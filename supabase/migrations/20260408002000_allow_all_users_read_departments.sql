-- Allow all authenticated users to read departments (for org structure visibility)
CREATE POLICY "All authenticated users can read departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (true);
