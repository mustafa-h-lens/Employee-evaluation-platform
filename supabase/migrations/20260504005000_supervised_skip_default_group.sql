-- Supervised employees are evaluated by their supervisor, who owns their
-- private criteria too — they must NOT live in the directorate's default
-- "الجميع" group, otherwise the directorate's specific criteria stick to
-- them as well and the page shows them under both supervisor + director.
--
-- Three layers:
-- 1) one-time cleanup: pull every supervised employee out of every
--    default group they're sitting in.
-- 2) auto-remove: when an employee gets added to an active supervisor
--    assignment, drop them from default groups.
-- 3) auto-skip: the previous auto-add triggers (employees /
--    employee_directorates) must NOT re-add a supervised employee, or
--    we'd just bounce them back in. Wrap them in a guard.

-- 1) cleanup
DELETE FROM department_criteria_group_members m
USING department_criteria_groups g,
      supervisor_assignment_members sam,
      supervisor_assignments sa
WHERE m.group_id = g.id
  AND g.is_default = true
  AND sam.employee_id = m.employee_id
  AND sam.assignment_id = sa.id
  AND sa.status = 'active';

-- 2) auto-remove on new supervision
CREATE OR REPLACE FUNCTION private.remove_supervised_from_default_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  -- Only act when the parent assignment is currently active. We re-check
  -- inside so a row inserted while paused doesn't yank membership.
  IF EXISTS (
    SELECT 1 FROM supervisor_assignments sa
    WHERE sa.id = NEW.assignment_id AND sa.status = 'active'
  ) THEN
    DELETE FROM department_criteria_group_members m
    USING department_criteria_groups g
    WHERE m.group_id = g.id
      AND g.is_default = true
      AND m.employee_id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remove_supervised_from_default_groups ON supervisor_assignment_members;
CREATE TRIGGER trg_remove_supervised_from_default_groups
  AFTER INSERT ON supervisor_assignment_members
  FOR EACH ROW
  EXECUTE FUNCTION private.remove_supervised_from_default_groups();

-- 3a) guard the employees-side auto-add (from 20260504003000)
CREATE OR REPLACE FUNCTION private.auto_add_employee_to_default_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.directorate_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.directorate_id IS DISTINCT FROM NEW.directorate_id)
     AND NOT EXISTS (
       SELECT 1
       FROM supervisor_assignment_members sam
       JOIN supervisor_assignments sa ON sa.id = sam.assignment_id
       WHERE sam.employee_id = NEW.id AND sa.status = 'active'
     ) THEN
    INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
    SELECT g.id, NEW.directorate_id, NEW.id
    FROM department_criteria_groups g
    WHERE g.directorate_id = NEW.directorate_id
      AND g.is_default = true
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 3b) guard the junction-side auto-add (from 20260504004000)
CREATE OR REPLACE FUNCTION private.auto_add_junction_employee_to_default_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM supervisor_assignment_members sam
    JOIN supervisor_assignments sa ON sa.id = sam.assignment_id
    WHERE sam.employee_id = NEW.employee_id AND sa.status = 'active'
  ) THEN
    INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
    SELECT g.id, NEW.directorate_id, NEW.employee_id
    FROM department_criteria_groups g
    WHERE g.directorate_id = NEW.directorate_id
      AND g.is_default = true
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 3c) guard the default-group auto-populate (from 20260504003000 / 4000)
CREATE OR REPLACE FUNCTION private.auto_populate_default_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.is_default = true THEN
    INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
    SELECT NEW.id, NEW.directorate_id, e.id
    FROM employees e
    WHERE e.directorate_id = NEW.directorate_id
      AND NOT EXISTS (
        SELECT 1
        FROM supervisor_assignment_members sam
        JOIN supervisor_assignments sa ON sa.id = sam.assignment_id
        WHERE sam.employee_id = e.id AND sa.status = 'active'
      )
    ON CONFLICT DO NOTHING;

    INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
    SELECT NEW.id, NEW.directorate_id, ed.employee_id
    FROM employee_directorates ed
    WHERE ed.directorate_id = NEW.directorate_id
      AND NOT EXISTS (
        SELECT 1
        FROM supervisor_assignment_members sam
        JOIN supervisor_assignments sa ON sa.id = sam.assignment_id
        WHERE sam.employee_id = ed.employee_id AND sa.status = 'active'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
