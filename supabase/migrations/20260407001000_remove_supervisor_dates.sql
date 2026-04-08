-- =============================================
-- Remove date constraints from supervisor_assignments
-- HR assigns/removes supervisors freely, no time-based logic
-- =============================================

-- 1. Drop the date range constraint
ALTER TABLE supervisor_assignments DROP CONSTRAINT IF EXISTS valid_date_range;

-- 2. Make date columns nullable
ALTER TABLE supervisor_assignments ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE supervisor_assignments ALTER COLUMN end_date DROP NOT NULL;

-- 3. Drop the date-based index (no longer needed)
DROP INDEX IF EXISTS idx_supervisor_assignments_dates;

-- 4. Update RLS policy on employees to remove date check
DROP POLICY IF EXISTS "supervisor_read_assigned_employees" ON employees;
CREATE POLICY "supervisor_read_assigned_employees" ON employees
  FOR SELECT USING (
    id IN (
      SELECT sam.employee_id
      FROM supervisor_assignment_members sam
      JOIN supervisor_assignments sa ON sa.id = sam.assignment_id
      WHERE sa.user_id = get_user_id()
        AND sa.status = 'active'
    )
  );

-- 5. Update RLS on supervisor_evaluations if it uses date checks
DROP POLICY IF EXISTS "supervisor_manage_own_evaluations" ON supervisor_evaluations;
CREATE POLICY "supervisor_manage_own_evaluations" ON supervisor_evaluations
  FOR ALL USING (
    supervisor_id = get_user_id()
    AND assignment_id IN (
      SELECT id FROM supervisor_assignments
      WHERE user_id = get_user_id()
        AND status = 'active'
    )
  );

-- 6. Migrate old 'manager' user_type to 'employee'
UPDATE supervisor_assignments SET user_type = 'employee' WHERE user_type = 'manager';

-- 7. Allow 'employee' and 'director' as user_type
ALTER TABLE supervisor_assignments DROP CONSTRAINT IF EXISTS supervisor_assignments_user_type_check;
ALTER TABLE supervisor_assignments ADD CONSTRAINT supervisor_assignments_user_type_check
  CHECK (user_type IN ('employee', 'director'));
