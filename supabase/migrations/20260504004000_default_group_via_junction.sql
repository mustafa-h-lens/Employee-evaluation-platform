-- 20260504003000 only walked employees.directorate_id; multi-directorate
-- employees linked via employee_directorates were still skipped. Extend
-- both the backfill and the auto-add behavior to cover the junction.

-- Backfill: pick up everyone reachable via employee_directorates that
-- isn't already in their directorate's default group.
INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
SELECT g.id, ed.directorate_id, ed.employee_id
FROM employee_directorates ed
JOIN department_criteria_groups g
  ON g.directorate_id = ed.directorate_id
 AND g.is_default = true
ON CONFLICT DO NOTHING;

-- Trigger: when an employee_directorates row is inserted, auto-add the
-- employee to that directorate's default group (mirrors the employees
-- trigger from 20260504003000).
CREATE OR REPLACE FUNCTION private.auto_add_junction_employee_to_default_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
  SELECT g.id, NEW.directorate_id, NEW.employee_id
  FROM department_criteria_groups g
  WHERE g.directorate_id = NEW.directorate_id
    AND g.is_default = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_junction_employee_to_default_group ON employee_directorates;
CREATE TRIGGER trg_auto_add_junction_employee_to_default_group
  AFTER INSERT ON employee_directorates
  FOR EACH ROW
  EXECUTE FUNCTION private.auto_add_junction_employee_to_default_group();

-- Update auto_populate_default_group from 20260504003000 so a freshly
-- created default group also pulls from the junction, not just the
-- legacy primary directorate column.
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
    ON CONFLICT DO NOTHING;

    INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
    SELECT NEW.id, NEW.directorate_id, ed.employee_id
    FROM employee_directorates ed
    WHERE ed.directorate_id = NEW.directorate_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
