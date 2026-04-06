-- Fix infinite recursion in employees RLS policy
-- The supervisor_read_assigned_employees policy causes recursion because
-- supervisor_assignment_members has RLS that checks back into employees

-- Create a SECURITY DEFINER function to bypass RLS for the supervisor check
CREATE OR REPLACE FUNCTION public.get_supervised_employee_ids(supervisor_user_id uuid)
RETURNS SETOF uuid AS $$
  SELECT sam.employee_id
  FROM public.supervisor_assignment_members sam
  JOIN public.supervisor_assignments sa ON sa.id = sam.assignment_id
  WHERE sa.user_id = supervisor_user_id
    AND sa.status = 'active'
    AND CURRENT_DATE BETWEEN sa.start_date AND sa.end_date;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- Drop the recursive policy
DROP POLICY IF EXISTS "supervisor_read_assigned_employees" ON employees;

-- Recreate with the wrapper function (no recursion)
CREATE POLICY "supervisor_read_assigned_employees" ON employees
  FOR SELECT USING (
    id IN (SELECT public.get_supervised_employee_ids(public.get_user_id()))
  );
