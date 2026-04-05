-- =============================================
-- Supervisor Evaluation System
-- =============================================

-- Table: supervisor_assignments
CREATE TABLE IF NOT EXISTS supervisor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('employee', 'manager')),
  team_department_id UUID REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'ended')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Table: supervisor_evaluations
CREATE TABLE IF NOT EXISTS supervisor_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES supervisor_assignments(id) ON DELETE CASCADE NOT NULL,
  supervisor_id UUID REFERENCES users(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  period_id UUID REFERENCES evaluation_periods(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'مسودة' CHECK (status IN ('مسودة', 'تم الإرسال', 'اطلع الموظف', 'مغلق')),
  final_score_500 NUMERIC DEFAULT 0,
  final_score_5 NUMERIC DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  general_rating TEXT,
  supervisor_note TEXT,
  employee_note TEXT,
  submitted_at TIMESTAMPTZ,
  viewed_by_employee_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supervisor_id, employee_id, period_id)
);

-- Table: supervisor_evaluation_scores
CREATE TABLE IF NOT EXISTS supervisor_evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES supervisor_evaluations(id) ON DELETE CASCADE NOT NULL,
  criterion_id UUID REFERENCES evaluation_criteria(id),
  criterion_type TEXT NOT NULL DEFAULT 'general' CHECK (criterion_type IN ('general', 'specific')),
  department_criterion_id UUID REFERENCES department_criteria(id),
  score_1_to_5 NUMERIC NOT NULL CHECK (score_1_to_5 >= 1 AND score_1_to_5 <= 5),
  weighted_result NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_user ON supervisor_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_dept ON supervisor_assignments(team_department_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_status ON supervisor_assignments(status);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_dates ON supervisor_assignments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_supervisor_evaluations_supervisor ON supervisor_evaluations(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_evaluations_employee ON supervisor_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_evaluations_period ON supervisor_evaluations(period_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_eval_scores_evaluation ON supervisor_evaluation_scores(evaluation_id);

-- Updated_at triggers
CREATE TRIGGER update_supervisor_assignments_updated_at
  BEFORE UPDATE ON supervisor_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supervisor_evaluations_updated_at
  BEFORE UPDATE ON supervisor_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supervisor_eval_scores_updated_at
  BEFORE UPDATE ON supervisor_evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE supervisor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_evaluation_scores ENABLE ROW LEVEL SECURITY;

-- supervisor_assignments: Admin full access
CREATE POLICY "admin_full_access_supervisor_assignments" ON supervisor_assignments
  FOR ALL USING (get_user_role() = 'admin');

-- supervisor_assignments: Users read their own
CREATE POLICY "user_read_own_supervisor_assignments" ON supervisor_assignments
  FOR SELECT USING (user_id = get_user_id());

-- supervisor_evaluations: Admin full access
CREATE POLICY "admin_full_access_supervisor_evaluations" ON supervisor_evaluations
  FOR ALL USING (get_user_role() = 'admin');

-- supervisor_evaluations: Supervisor manages own
CREATE POLICY "supervisor_manage_own_evaluations" ON supervisor_evaluations
  FOR ALL USING (supervisor_id = get_user_id())
  WITH CHECK (supervisor_id = get_user_id());

-- supervisor_evaluations: Evaluated employees read own
CREATE POLICY "employee_read_own_supervisor_evaluations" ON supervisor_evaluations
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = get_user_id())
  );

-- supervisor_evaluation_scores: Admin full access
CREATE POLICY "admin_full_access_supervisor_eval_scores" ON supervisor_evaluation_scores
  FOR ALL USING (get_user_role() = 'admin');

-- supervisor_evaluation_scores: Supervisor manages own
CREATE POLICY "supervisor_manage_own_eval_scores" ON supervisor_evaluation_scores
  FOR ALL USING (
    evaluation_id IN (SELECT id FROM supervisor_evaluations WHERE supervisor_id = get_user_id())
  )
  WITH CHECK (
    evaluation_id IN (SELECT id FROM supervisor_evaluations WHERE supervisor_id = get_user_id())
  );

-- supervisor_evaluation_scores: Employee reads own
CREATE POLICY "employee_read_own_supervisor_eval_scores" ON supervisor_evaluation_scores
  FOR SELECT USING (
    evaluation_id IN (
      SELECT id FROM supervisor_evaluations WHERE employee_id IN (
        SELECT id FROM employees WHERE user_id = get_user_id()
      )
    )
  );

-- Allow supervisors to read employees in their assigned departments
CREATE POLICY "supervisor_read_assigned_dept_employees" ON employees
  FOR SELECT USING (
    department_id IN (
      SELECT team_department_id FROM supervisor_assignments
      WHERE user_id = get_user_id()
      AND status = 'active'
      AND CURRENT_DATE BETWEEN start_date AND end_date
    )
  );
