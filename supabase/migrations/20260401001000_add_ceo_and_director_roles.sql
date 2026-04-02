-- =====================================================
-- Migration: Add CEO and Director roles
-- =====================================================

-- 1. Update role check constraint on users table to allow new roles
-- First drop the existing constraint if any, then add new one
DO $$
BEGIN
  -- Try to drop existing role constraint
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Add updated role constraint (admin=HR, director=مدير إدارة, manager=مدير قسم, employee=موظف, ceo=الإدارة العليا)
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'director', 'manager', 'employee', 'ceo'));

-- 2. Create director_evaluations table (CEO evaluates directors)
CREATE TABLE IF NOT EXISTS director_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  evaluator_id uuid REFERENCES users(id) NOT NULL,
  period_id uuid REFERENCES evaluation_periods(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'مسودة' CHECK (status IN ('مسودة', 'تم الإرسال', 'اطلع المدير', 'مغلق')),
  final_score_500 numeric DEFAULT 0,
  final_score_5 numeric DEFAULT 0,
  percentage numeric DEFAULT 0,
  general_rating text,
  evaluator_note text,
  director_note text,
  submitted_at timestamptz,
  viewed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(director_id, period_id)
);

-- 3. Create director_evaluation_scores table
CREATE TABLE IF NOT EXISTS director_evaluation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid REFERENCES director_evaluations(id) ON DELETE CASCADE NOT NULL,
  criterion_id uuid REFERENCES evaluation_criteria(id),
  criterion_type text NOT NULL DEFAULT 'general' CHECK (criterion_type IN ('general', 'specific')),
  department_criterion_id uuid REFERENCES department_criteria(id),
  score_1_to_5 integer NOT NULL CHECK (score_1_to_5 >= 1 AND score_1_to_5 <= 5),
  weighted_result numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE director_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE director_evaluation_scores ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for director_evaluations
CREATE POLICY "admin_full_access_director_evaluations" ON director_evaluations
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "ceo_full_access_director_evaluations" ON director_evaluations
  FOR ALL USING (get_user_role() = 'ceo');

CREATE POLICY "director_read_own_evaluations" ON director_evaluations
  FOR SELECT USING (director_id = get_user_id());

-- 6. RLS Policies for director_evaluation_scores
CREATE POLICY "admin_full_access_director_eval_scores" ON director_evaluation_scores
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "ceo_full_access_director_eval_scores" ON director_evaluation_scores
  FOR ALL USING (get_user_role() = 'ceo');

CREATE POLICY "director_read_own_eval_scores" ON director_evaluation_scores
  FOR SELECT USING (
    evaluation_id IN (
      SELECT id FROM director_evaluations WHERE director_id = get_user_id()
    )
  );

-- 7. Update existing RLS policies to allow CEO read access to key tables

-- CEO can read departments
CREATE POLICY "ceo_read_departments" ON departments
  FOR SELECT USING (get_user_role() = 'ceo');

-- CEO can read users (directors/managers)
CREATE POLICY "ceo_read_users" ON users
  FOR SELECT USING (get_user_role() = 'ceo');

-- CEO can read evaluation_periods
CREATE POLICY "ceo_read_evaluation_periods" ON evaluation_periods
  FOR SELECT USING (get_user_role() = 'ceo');

-- CEO can read evaluation_criteria
CREATE POLICY "ceo_read_evaluation_criteria" ON evaluation_criteria
  FOR SELECT USING (get_user_role() = 'ceo');

-- CEO can read evaluations (for reports)
CREATE POLICY "ceo_read_evaluations" ON evaluations
  FOR SELECT USING (get_user_role() = 'ceo');

-- CEO can read evaluation_settings
CREATE POLICY "ceo_read_evaluation_settings" ON evaluation_settings
  FOR SELECT USING (get_user_role() = 'ceo');

-- CEO can write audit_logs
CREATE POLICY "ceo_insert_audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (get_user_role() = 'ceo');

-- CEO can read audit_logs
CREATE POLICY "ceo_read_audit_logs" ON audit_logs
  FOR SELECT USING (get_user_role() = 'ceo');

-- Director can read departments
CREATE POLICY "director_read_departments" ON departments
  FOR SELECT USING (get_user_role() = 'director');

-- Director can read users
CREATE POLICY "director_read_users" ON users
  FOR SELECT USING (get_user_role() = 'director');

-- Director can read evaluation_periods
CREATE POLICY "director_read_evaluation_periods" ON evaluation_periods
  FOR SELECT USING (get_user_role() = 'director');

-- Director can read evaluation_criteria
CREATE POLICY "director_read_evaluation_criteria" ON evaluation_criteria
  FOR SELECT USING (get_user_role() = 'director');

-- Director can read evaluation_settings
CREATE POLICY "director_read_evaluation_settings" ON evaluation_settings
  FOR SELECT USING (get_user_role() = 'director');

-- Director can read evaluations for their departments
CREATE POLICY "director_read_evaluations" ON evaluations
  FOR SELECT USING (get_user_role() = 'director');

-- Director can read employees
CREATE POLICY "director_read_employees" ON employees
  FOR SELECT USING (get_user_role() = 'director');
