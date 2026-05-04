-- The 20260429002000 backfill seeded the "الجميع" default group with the
-- employees that existed in each directorate at the time. Anyone added to
-- a directorate later (e.g. عمرو السبئي in إدارة تطوير الأعمال) stays
-- unassigned, so the criteria-by-group page shows "2 موظفين" when the
-- directorate actually has 3. Two layers of fix:
--
-- 1) one-time backfill catching anyone who slipped through.
-- 2) trigger so future employee→directorate assignments self-heal.

-- 1) Backfill.
INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
SELECT g.id, e.directorate_id, e.id
FROM employees e
JOIN department_criteria_groups g
  ON g.directorate_id = e.directorate_id
 AND g.is_default = true
WHERE e.directorate_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2a) Auto-add an employee to the directorate's default group whenever
--     their directorate_id is set or changed.
CREATE OR REPLACE FUNCTION private.auto_add_employee_to_default_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.directorate_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.directorate_id IS DISTINCT FROM NEW.directorate_id) THEN
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

DROP TRIGGER IF EXISTS trg_auto_add_employee_to_default_group ON employees;
CREATE TRIGGER trg_auto_add_employee_to_default_group
  AFTER INSERT OR UPDATE OF directorate_id ON employees
  FOR EACH ROW
  EXECUTE FUNCTION private.auto_add_employee_to_default_group();

-- 2b) Auto-populate a freshly-created default group with the directorate's
--     existing employees, so a directorate created today doesn't need a
--     follow-up backfill to count its members correctly.
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_populate_default_group ON department_criteria_groups;
CREATE TRIGGER trg_auto_populate_default_group
  AFTER INSERT ON department_criteria_groups
  FOR EACH ROW
  EXECUTE FUNCTION private.auto_populate_default_group();
