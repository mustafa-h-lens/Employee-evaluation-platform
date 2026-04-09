-- ============================================================
-- employee_directorates: allow an employee to belong to
-- multiple directorates, each with an optional department.
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_directorates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE CASCADE,
  department_id  UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, directorate_id)
);

-- Index for fast lookups
CREATE INDEX idx_emp_dir_employee ON employee_directorates(employee_id);
CREATE INDEX idx_emp_dir_directorate ON employee_directorates(directorate_id);

-- ── Migrate existing data ──────────────────────────────────
INSERT INTO employee_directorates (employee_id, directorate_id, department_id, is_primary)
SELECT id, directorate_id, department_id, true
FROM employees
WHERE directorate_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE employee_directorates ENABLE ROW LEVEL SECURITY;

-- Everyone can read (same as employees table)
CREATE POLICY "Allow all authenticated users to read employee_directorates"
  ON employee_directorates FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admin insert employee_directorates"
  ON employee_directorates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin update employee_directorates"
  ON employee_directorates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin delete employee_directorates"
  ON employee_directorates FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );
