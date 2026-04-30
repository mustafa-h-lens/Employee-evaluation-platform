-- Per-scope weight allocation. Until now, evaluation_periods.general_weight /
-- specific_weight applied to every evaluation in the period. HR couldn't say
-- "design team is 50/50 but engineering is 30/70". This migration moves the
-- weights down to the most-specific scope:
--   * directorate criteria groups → their own (general, specific) pair
--   * supervisor criteria groups  → their own (general, specific) pair
--   * one row for high management (CEO → director evaluations)
-- evaluation_periods.* stays as a fallback default.

-- 1. Per-group weights for directorate criteria groups
ALTER TABLE department_criteria_groups
  ADD COLUMN IF NOT EXISTS general_weight  integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS specific_weight integer NOT NULL DEFAULT 50;

-- Backfill from the currently active period BEFORE the CHECK so any existing
-- skewed periods don't trigger the constraint.
UPDATE department_criteria_groups
   SET general_weight  = COALESCE((SELECT general_weight  FROM evaluation_periods WHERE status = 'نشطة' ORDER BY year DESC, month DESC LIMIT 1), 50),
       specific_weight = COALESCE((SELECT specific_weight FROM evaluation_periods WHERE status = 'نشطة' ORDER BY year DESC, month DESC LIMIT 1), 50);

ALTER TABLE department_criteria_groups
  DROP CONSTRAINT IF EXISTS department_criteria_groups_w_range,
  DROP CONSTRAINT IF EXISTS department_criteria_groups_w_sum,
  ADD CONSTRAINT department_criteria_groups_w_range
    CHECK (general_weight BETWEEN 0 AND 100 AND specific_weight BETWEEN 0 AND 100),
  ADD CONSTRAINT department_criteria_groups_w_sum
    CHECK (general_weight + specific_weight = 100);

-- 2. Per-group weights for supervisor criteria groups
ALTER TABLE supervisor_criteria_groups
  ADD COLUMN IF NOT EXISTS general_weight  integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS specific_weight integer NOT NULL DEFAULT 50;

UPDATE supervisor_criteria_groups
   SET general_weight  = COALESCE((SELECT general_weight  FROM evaluation_periods WHERE status = 'نشطة' ORDER BY year DESC, month DESC LIMIT 1), 50),
       specific_weight = COALESCE((SELECT specific_weight FROM evaluation_periods WHERE status = 'نشطة' ORDER BY year DESC, month DESC LIMIT 1), 50);

ALTER TABLE supervisor_criteria_groups
  DROP CONSTRAINT IF EXISTS supervisor_criteria_groups_w_range,
  DROP CONSTRAINT IF EXISTS supervisor_criteria_groups_w_sum,
  ADD CONSTRAINT supervisor_criteria_groups_w_range
    CHECK (general_weight BETWEEN 0 AND 100 AND specific_weight BETWEEN 0 AND 100),
  ADD CONSTRAINT supervisor_criteria_groups_w_sum
    CHECK (general_weight + specific_weight = 100);

-- 3. Single-row table for high-management (CEO → director) weights
CREATE TABLE IF NOT EXISTS high_management_weight_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  general_weight  integer NOT NULL DEFAULT 50 CHECK (general_weight BETWEEN 0 AND 100),
  specific_weight integer NOT NULL DEFAULT 50 CHECK (specific_weight BETWEEN 0 AND 100),
  CONSTRAINT high_management_w_sum CHECK (general_weight + specific_weight = 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed exactly one row, taking the active period's pair if present
INSERT INTO high_management_weight_settings (general_weight, specific_weight)
  SELECT COALESCE((SELECT general_weight FROM evaluation_periods WHERE status = 'نشطة' ORDER BY year DESC, month DESC LIMIT 1), 50),
         COALESCE((SELECT specific_weight FROM evaluation_periods WHERE status = 'نشطة' ORDER BY year DESC, month DESC LIMIT 1), 50)
  WHERE NOT EXISTS (SELECT 1 FROM high_management_weight_settings);

ALTER TABLE high_management_weight_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS high_mgmt_weights_read ON high_management_weight_settings;
CREATE POLICY high_mgmt_weights_read ON high_management_weight_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS high_mgmt_weights_write ON high_management_weight_settings;
CREATE POLICY high_mgmt_weights_write ON high_management_weight_settings
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

DROP TRIGGER IF EXISTS trg_high_mgmt_weights_touch ON high_management_weight_settings;
CREATE TRIGGER trg_high_mgmt_weights_touch
  BEFORE UPDATE ON high_management_weight_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Lookup helpers — single source of truth for the read path. Each returns
-- exactly one row: the most-specific applicable pair, falling back to the
-- active period and finally to 50/50.

CREATE OR REPLACE FUNCTION get_employee_directorate_weights(p_employee_id uuid)
RETURNS TABLE (general_weight int, specific_weight int)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  g int;
  s int;
BEGIN
  SELECT gr.general_weight, gr.specific_weight INTO g, s
    FROM department_criteria_group_members m
    JOIN department_criteria_groups gr ON gr.id = m.group_id
   WHERE m.employee_id = p_employee_id
   LIMIT 1;
  IF g IS NULL THEN
    SELECT p.general_weight, p.specific_weight INTO g, s
      FROM evaluation_periods p
     WHERE p.status = 'نشطة'
     ORDER BY p.year DESC, p.month DESC
     LIMIT 1;
  END IF;
  general_weight := COALESCE(g, 50);
  specific_weight := COALESCE(s, 50);
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION get_employee_directorate_weights(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION get_employee_supervisor_weights(p_employee_id uuid)
RETURNS TABLE (general_weight int, specific_weight int)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  g int;
  s int;
BEGIN
  SELECT gr.general_weight, gr.specific_weight INTO g, s
    FROM supervisor_criteria_group_members m
    JOIN supervisor_criteria_groups gr ON gr.id = m.group_id
   WHERE m.employee_id = p_employee_id
   LIMIT 1;
  IF g IS NULL THEN
    SELECT p.general_weight, p.specific_weight INTO g, s
      FROM evaluation_periods p
     WHERE p.status = 'نشطة'
     ORDER BY p.year DESC, p.month DESC
     LIMIT 1;
  END IF;
  general_weight := COALESCE(g, 50);
  specific_weight := COALESCE(s, 50);
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION get_employee_supervisor_weights(uuid) TO authenticated;
