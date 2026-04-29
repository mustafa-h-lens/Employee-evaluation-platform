-- Employee leaves: HR pauses an employee's evaluation eligibility for one or
-- more months at a time, picking from a small admin-managed catalog of leave
-- types (annual / sick / maternity / unpaid / external assignment / …). Reports
-- exclude the employee from the months a leave covers, so an annual average
-- denominator becomes 9 or 10 instead of 12, and a quarter denominator becomes
-- 1 or 2 instead of 3. "On leave" is derived live from the records — never a
-- column flip on `employees`. That keeps reports honest if an old leave is
-- edited later, and lets the same employee be paused-for-Q2 yet
-- evaluated-for-Q1.

-- 1. Catalog (admin-managed)
CREATE TABLE IF NOT EXISTS employee_leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Per-employee records. start_month / end_month are always the FIRST of
-- their respective months (a CHECK enforces it), end_month is INCLUSIVE.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS employee_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES employee_leave_types(id),
  start_month date NOT NULL,
  end_month date NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_leaves_start_month_first CHECK (start_month = date_trunc('month', start_month)::date),
  CONSTRAINT employee_leaves_end_month_first   CHECK (end_month   = date_trunc('month', end_month)::date),
  CONSTRAINT employee_leaves_range_valid       CHECK (end_month >= start_month),
  -- Two leaves for the same employee can't overlap. Half-open daterange
  -- [start_month, end_month + 1 month) makes the inclusive end_month behave
  -- correctly under &&.
  CONSTRAINT employee_leaves_no_overlap EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_month, (end_month + interval '1 month')::date) WITH &&
  )
);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_employee ON employee_leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_range ON employee_leaves(start_month, end_month);

-- 3. Helpers — every consumer (UI filters, reports, score-insert guard) calls
-- these so the rule is defined once.

CREATE OR REPLACE FUNCTION is_employee_on_leave(p_employee_id uuid, p_month date)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employee_leaves
    WHERE employee_id = p_employee_id
      AND date_trunc('month', p_month)::date BETWEEN start_month AND end_month
  );
$$;

CREATE OR REPLACE FUNCTION evaluable_months(p_employee_id uuid, p_from date, p_to date)
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT count(*)::int FROM generate_series(
    date_trunc('month', p_from)::date,
    date_trunc('month', p_to)::date,
    interval '1 month'
  ) m
  WHERE NOT is_employee_on_leave(p_employee_id, m::date);
$$;

GRANT EXECUTE ON FUNCTION is_employee_on_leave(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluable_months(uuid, date, date) TO authenticated;

-- Look up by users.id (used by director-evaluation flow). Returns false when
-- the user has no corresponding employees row.
CREATE OR REPLACE FUNCTION is_user_on_leave(p_user_id uuid, p_month date)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    JOIN employee_leaves el ON el.employee_id = e.id
    WHERE e.user_id = p_user_id
      AND date_trunc('month', p_month)::date BETWEEN el.start_month AND el.end_month
  );
$$;
GRANT EXECUTE ON FUNCTION is_user_on_leave(uuid, date) TO authenticated;

-- 4. RLS — HR is the only one who writes; everyone authenticated reads (so
-- evaluators can be told "this employee is on إجازة until …").
ALTER TABLE employee_leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_leave_types_read ON employee_leave_types;
CREATE POLICY employee_leave_types_read ON employee_leave_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS employee_leave_types_admin_write ON employee_leave_types;
CREATE POLICY employee_leave_types_admin_write ON employee_leave_types
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

DROP POLICY IF EXISTS employee_leaves_read ON employee_leaves;
CREATE POLICY employee_leaves_read ON employee_leaves
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS employee_leaves_admin_write ON employee_leaves;
CREATE POLICY employee_leaves_admin_write ON employee_leaves
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- 5. Touch updated_at on update.
CREATE OR REPLACE FUNCTION touch_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_leave_types_touch ON employee_leave_types;
CREATE TRIGGER trg_employee_leave_types_touch
  BEFORE UPDATE ON employee_leave_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at_column();

DROP TRIGGER IF EXISTS trg_employee_leaves_touch ON employee_leaves;
CREATE TRIGGER trg_employee_leaves_touch
  BEFORE UPDATE ON employee_leaves
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at_column();

-- 6. Seed the common types so HR has a starting list (idempotent).
INSERT INTO employee_leave_types (name, description, "order") VALUES
  ('إجازة سنوية',         'الإجازة السنوية الاعتيادية',                       1),
  ('إجازة مرضية',         'إجازة بسبب وضع صحي يمنع أداء العمل',              2),
  ('إجازة أمومة',         'إجازة الأمومة قبل وبعد الولادة',                   3),
  ('إجازة أبوّة',          'إجازة الأبوة',                                       4),
  ('إجازة بدون راتب',     'إجازة بدون راتب موافق عليها من إدارة الموارد البشرية', 5),
  ('تكليف خارجي',         'تكليف بمهمة خارج جهة العمل تستثني الموظف من التقييم', 6),
  ('إعارة',               'إعارة للعمل في جهة أخرى',                          7)
ON CONFLICT (name) DO NOTHING;
