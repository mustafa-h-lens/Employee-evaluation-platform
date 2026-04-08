-- Allow all authenticated users to read key tables for org structure
-- Required for org structure page to work identically for all roles

CREATE POLICY "All authenticated users can read users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can read employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can read supervisor_assignments"
  ON supervisor_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can read supervisor_assignment_members"
  ON supervisor_assignment_members FOR SELECT
  TO authenticated
  USING (true);
