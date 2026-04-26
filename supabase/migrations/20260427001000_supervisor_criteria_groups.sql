-- Supervisor criteria groups: a supervisor assignment can have multiple
-- groups of criteria, each scoped to a chosen subset of the assignment's
-- members. Each group has its own weight cap. An employee can be in at
-- most one group per assignment.

CREATE TABLE IF NOT EXISTS supervisor_criteria_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES supervisor_assignments(id) ON DELETE CASCADE,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supervisor_criteria_groups_assignment
  ON supervisor_criteria_groups(assignment_id);

CREATE TABLE IF NOT EXISTS supervisor_criteria_group_members (
  group_id uuid NOT NULL REFERENCES supervisor_criteria_groups(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES supervisor_assignments(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, employee_id)
);

-- An employee can belong to at most one group per assignment
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_group_per_emp_per_assignment
  ON supervisor_criteria_group_members(assignment_id, employee_id);

-- Tag each criterion with the group it belongs to
ALTER TABLE supervisor_criteria
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES supervisor_criteria_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_supervisor_criteria_group ON supervisor_criteria(group_id);

ALTER TABLE supervisor_criteria_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_criteria_group_members ENABLE ROW LEVEL SECURITY;

-- Read: everyone authenticated (admin views, evaluators view)
CREATE POLICY supervisor_criteria_groups_read ON supervisor_criteria_groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY supervisor_criteria_group_members_read ON supervisor_criteria_group_members
  FOR SELECT TO authenticated USING (true);

-- Write: only the supervisor of the assignment, plus admin
CREATE POLICY supervisor_criteria_groups_supervisor_write ON supervisor_criteria_groups
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM supervisor_assignments sa
      WHERE sa.id = assignment_id AND sa.user_id = get_user_id()
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM supervisor_assignments sa
      WHERE sa.id = assignment_id AND sa.user_id = get_user_id()
    )
  );

CREATE POLICY supervisor_criteria_group_members_supervisor_write ON supervisor_criteria_group_members
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM supervisor_assignments sa
      WHERE sa.id = assignment_id AND sa.user_id = get_user_id()
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM supervisor_assignments sa
      WHERE sa.id = assignment_id AND sa.user_id = get_user_id()
    )
  );

-- Backfill: for each existing assignment that has criteria but no groups,
-- create a default "الجميع" group with all current assignment members and
-- migrate the existing criteria into it.
DO $$
DECLARE
  a record;
  g_id uuid;
BEGIN
  FOR a IN
    SELECT DISTINCT sc.assignment_id AS id
    FROM supervisor_criteria sc
    WHERE sc.group_id IS NULL
  LOOP
    INSERT INTO supervisor_criteria_groups (assignment_id, name, "order", is_default)
      VALUES (a.id, 'الجميع', 1, true)
      RETURNING id INTO g_id;

    UPDATE supervisor_criteria
      SET group_id = g_id
      WHERE assignment_id = a.id AND group_id IS NULL;

    INSERT INTO supervisor_criteria_group_members (group_id, assignment_id, employee_id)
      SELECT g_id, a.id, m.employee_id
      FROM supervisor_assignment_members m
      WHERE m.assignment_id = a.id
      ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
