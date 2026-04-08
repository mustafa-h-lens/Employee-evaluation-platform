-- Supervisor-specific criteria table
CREATE TABLE IF NOT EXISTS supervisor_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES supervisor_assignments(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight >= 1 AND weight <= 100),
  "order" INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supervisor_criteria_assignment ON supervisor_criteria(assignment_id);

-- Trigger
CREATE TRIGGER update_supervisor_criteria_updated_at
  BEFORE UPDATE ON supervisor_criteria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE supervisor_criteria ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_access_supervisor_criteria" ON supervisor_criteria
  FOR ALL USING (get_user_role() = 'admin');

-- Supervisor manages own criteria
CREATE POLICY "supervisor_manage_own_criteria" ON supervisor_criteria
  FOR ALL USING (
    assignment_id IN (SELECT id FROM supervisor_assignments WHERE user_id = get_user_id())
  )
  WITH CHECK (
    assignment_id IN (SELECT id FROM supervisor_assignments WHERE user_id = get_user_id())
  );

-- Employees can read criteria for their assignments
CREATE POLICY "employee_read_supervisor_criteria" ON supervisor_criteria
  FOR SELECT USING (
    assignment_id IN (
      SELECT sam.assignment_id FROM supervisor_assignment_members sam
      JOIN employees e ON e.id = sam.employee_id
      WHERE e.user_id = get_user_id()
    )
  );
