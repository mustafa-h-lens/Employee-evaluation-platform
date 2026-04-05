-- =============================================
-- Supervisor Assignment: Switch from department-based to employee-based
-- =============================================

-- 1. Drop the old RLS policy that used department-based logic
DROP POLICY IF EXISTS "supervisor_read_assigned_dept_employees" ON employees;

-- 2. Remove department column from supervisor_assignments
ALTER TABLE supervisor_assignments DROP COLUMN IF EXISTS team_department_id;

-- 3. Create the members junction table
CREATE TABLE IF NOT EXISTS supervisor_assignment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES supervisor_assignments(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, employee_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_assignment_members_assignment ON supervisor_assignment_members(assignment_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignment_members_employee ON supervisor_assignment_members(employee_id);

-- 5. RLS
ALTER TABLE supervisor_assignment_members ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_access_supervisor_assignment_members" ON supervisor_assignment_members
  FOR ALL USING (get_user_role() = 'admin');

-- Supervisor reads own assignment members
CREATE POLICY "supervisor_read_own_assignment_members" ON supervisor_assignment_members
  FOR SELECT USING (
    assignment_id IN (
      SELECT id FROM supervisor_assignments WHERE user_id = get_user_id()
    )
  );

-- Employee reads own membership
CREATE POLICY "employee_read_own_membership" ON supervisor_assignment_members
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = get_user_id())
  );

-- 6. New policy: Supervisors read employees they are assigned to (replaces department-based policy)
CREATE POLICY "supervisor_read_assigned_employees" ON employees
  FOR SELECT USING (
    id IN (
      SELECT sam.employee_id
      FROM supervisor_assignment_members sam
      JOIN supervisor_assignments sa ON sa.id = sam.assignment_id
      WHERE sa.user_id = get_user_id()
        AND sa.status = 'active'
        AND CURRENT_DATE BETWEEN sa.start_date AND sa.end_date
    )
  );

-- 7. Update supervisor_evaluations: employee_id should now reference employees assigned via members
--    (no schema change needed, just the RLS and app logic change)

-- Drop old department-related index
DROP INDEX IF EXISTS idx_supervisor_assignments_dept;
