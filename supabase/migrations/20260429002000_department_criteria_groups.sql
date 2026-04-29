-- Directorate criteria groups: a directorate can be split into named groups
-- (e.g. "تصميم", "تطوير"), each bundling a chosen subset of the directorate's
-- employees plus a custom set of criteria. Each group is weight-capped
-- independently. An employee can be in at most one group per directorate.
--
-- Mirrors supervisor_criteria_groups (20260427001000). Going forward the
-- department_id distinction on department_criteria becomes obsolete; every
-- criterion is reached via group_id. We leave department_id in place for
-- historical/audit purposes but no code reads it after this migration.

CREATE TABLE IF NOT EXISTS department_criteria_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directorate_id uuid NOT NULL REFERENCES directorates(id) ON DELETE CASCADE,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_department_criteria_groups_directorate
  ON department_criteria_groups(directorate_id);

CREATE TABLE IF NOT EXISTS department_criteria_group_members (
  group_id uuid NOT NULL REFERENCES department_criteria_groups(id) ON DELETE CASCADE,
  directorate_id uuid NOT NULL REFERENCES directorates(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, employee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_group_per_emp_per_directorate
  ON department_criteria_group_members(directorate_id, employee_id);

ALTER TABLE department_criteria
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES department_criteria_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_department_criteria_group ON department_criteria(group_id);

ALTER TABLE department_criteria_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_criteria_group_members ENABLE ROW LEVEL SECURITY;

-- Read: everyone authenticated (HR overview, evaluators, reports all need this)
DROP POLICY IF EXISTS department_criteria_groups_read ON department_criteria_groups;
CREATE POLICY department_criteria_groups_read ON department_criteria_groups
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS department_criteria_group_members_read ON department_criteria_group_members;
CREATE POLICY department_criteria_group_members_read ON department_criteria_group_members
  FOR SELECT TO authenticated USING (true);

-- Write: admin OR the directorate's director (primary or secondary).
-- Role-agnostic ownership check, matching 20260427005000.
DROP POLICY IF EXISTS department_criteria_groups_owner_write ON department_criteria_groups;
CREATE POLICY department_criteria_groups_owner_write ON department_criteria_groups
  FOR ALL TO authenticated
  USING (
    private.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  )
  WITH CHECK (
    private.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  );

DROP POLICY IF EXISTS department_criteria_group_members_owner_write ON department_criteria_group_members;
CREATE POLICY department_criteria_group_members_owner_write ON department_criteria_group_members
  FOR ALL TO authenticated
  USING (
    private.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  )
  WITH CHECK (
    private.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM directorates d
      WHERE d.id = directorate_id
        AND (d.director_id = private.get_user_id() OR d.secondary_director_id = private.get_user_id())
    )
  );

-- Backfill. Two passes:
--   (a) Every directorate-scoped criterion (department_id IS NULL,
--       directorate_id NOT NULL) → one default "الجميع" group per directorate
--       containing all that directorate's employees.
--   (b) Every department-scoped criterion (department_id NOT NULL) → one
--       group per department, named after the department, containing that
--       department's employees. Preserves today's behavior exactly so each
--       employee continues to see the same criteria they saw before.
DO $$
DECLARE
  d record;
  dep record;
  g_id uuid;
BEGIN
  -- (a) directorate-scoped → "الجميع"
  FOR d IN
    SELECT DISTINCT directorate_id AS id
    FROM department_criteria
    WHERE department_id IS NULL
      AND directorate_id IS NOT NULL
      AND group_id IS NULL
  LOOP
    INSERT INTO department_criteria_groups (directorate_id, name, "order", is_default)
      VALUES (d.id, 'الجميع', 1, true)
      RETURNING id INTO g_id;

    UPDATE department_criteria
      SET group_id = g_id
      WHERE directorate_id = d.id
        AND department_id IS NULL
        AND group_id IS NULL;

    INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
      SELECT g_id, d.id, e.id
      FROM employees e
      WHERE e.directorate_id = d.id
      ON CONFLICT DO NOTHING;
  END LOOP;

  -- (b) department-scoped → one group per (directorate, department)
  FOR dep IN
    SELECT DISTINCT dc.directorate_id AS dir_id, dc.department_id AS dep_id, dept.name AS dep_name
    FROM department_criteria dc
    JOIN departments dept ON dept.id = dc.department_id
    WHERE dc.department_id IS NOT NULL
      AND dc.group_id IS NULL
  LOOP
    INSERT INTO department_criteria_groups (directorate_id, name, "order", is_default)
      VALUES (dep.dir_id, dep.dep_name, 1, false)
      RETURNING id INTO g_id;

    UPDATE department_criteria
      SET group_id = g_id
      WHERE directorate_id = dep.dir_id
        AND department_id = dep.dep_id
        AND group_id IS NULL;

    INSERT INTO department_criteria_group_members (group_id, directorate_id, employee_id)
      SELECT g_id, dep.dir_id, e.id
      FROM employees e
      WHERE e.department_id = dep.dep_id
      ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
