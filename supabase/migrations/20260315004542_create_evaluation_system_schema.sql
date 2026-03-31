/*
  # منصة التقييم الوظيفي الربع سنوي - HALF LENS
  
  ## Overview
  Complete schema for quarterly employee performance evaluation system with Arabic support and RTL layout.
  
  ## New Tables
  
  ### 1. `users`
  System users with role-based access (admin, manager, employee)
  - `id` (uuid, primary key)
  - `email` (text, unique)
  - `password_hash` (text)
  - `full_name` (text)
  - `role` (text) - 'admin', 'manager', 'employee'
  - `status` (text) - 'active', 'inactive'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 2. `departments`
  Organization departments
  - `id` (uuid, primary key)
  - `name` (text, unique)
  - `manager_id` (uuid, references users)
  - `status` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 3. `employees`
  Employee records linked to departments and managers
  - `id` (uuid, primary key)
  - `user_id` (uuid, references users)
  - `employee_number` (text, unique)
  - `full_name` (text)
  - `email` (text)
  - `phone` (text)
  - `job_title` (text)
  - `department_id` (uuid, references departments)
  - `manager_id` (uuid, references users)
  - `hire_date` (date)
  - `status` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 4. `evaluation_periods`
  Quarterly evaluation periods
  - `id` (uuid, primary key)
  - `year` (integer)
  - `quarter` (integer) - 1, 2, 3, 4
  - `start_date` (date)
  - `end_date` (date)
  - `status` (text) - 'نشطة', 'مغلقة', 'قادمة'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 5. `evaluation_criteria`
  Evaluation criteria with weights
  - `id` (uuid, primary key)
  - `title` (text)
  - `description` (text)
  - `weight` (integer)
  - `order` (integer)
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 6. `evaluations`
  Main evaluation records
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references employees)
  - `manager_id` (uuid, references users)
  - `department_id` (uuid, references departments)
  - `period_id` (uuid, references evaluation_periods)
  - `status` (text) - 'مسودة', 'تم الإرسال', 'اطلع الموظف', 'مغلق'
  - `final_score_500` (numeric)
  - `final_score_5` (numeric)
  - `percentage` (numeric)
  - `general_rating` (text) - 'ممتاز', 'جيد جدًا', 'جيد', 'يحتاج تحسين'
  - `manager_note` (text)
  - `employee_note` (text)
  - `submitted_at` (timestamptz)
  - `viewed_by_employee_at` (timestamptz)
  - `closed_at` (timestamptz)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 7. `evaluation_scores`
  Individual criterion scores for each evaluation
  - `id` (uuid, primary key)
  - `evaluation_id` (uuid, references evaluations)
  - `criterion_id` (uuid, references evaluation_criteria)
  - `score_1_to_5` (integer) - 1 to 5
  - `weighted_result` (numeric)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 8. `development_plans`
  Development plan items for each evaluation
  - `id` (uuid, primary key)
  - `evaluation_id` (uuid, references evaluations)
  - `item_order` (integer)
  - `development_goal` (text)
  - `action_plan` (text)
  - `duration` (text)
  - `notes` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 9. `audit_logs`
  Comprehensive audit trail
  - `id` (uuid, primary key)
  - `user_id` (uuid, references users)
  - `action` (text)
  - `entity_type` (text)
  - `entity_id` (uuid)
  - `details` (jsonb)
  - `created_at` (timestamptz)
  
  ## Security
  - Enable RLS on all tables
  - Admin can view all data (read-only for evaluations)
  - Managers can only access their department data
  - Employees can only view their own data
  - Strict policies for data modification based on role and status
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  manager_id uuid REFERENCES users(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  employee_number text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  job_title text NOT NULL,
  department_id uuid REFERENCES departments(id),
  manager_id uuid REFERENCES users(id),
  hire_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR manager_id = auth.uid()
    OR user_id = auth.uid()
  );

CREATE POLICY "Admin can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Evaluation periods table
CREATE TABLE IF NOT EXISTS evaluation_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter IN (1, 2, 3, 4)),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'قادمة' CHECK (status IN ('نشطة', 'مغلقة', 'قادمة')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year, quarter)
);

ALTER TABLE evaluation_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view periods"
  ON evaluation_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert periods"
  ON evaluation_periods FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update periods"
  ON evaluation_periods FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Evaluation criteria table
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  weight integer NOT NULL,
  "order" integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE evaluation_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view criteria"
  ON evaluation_criteria FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert criteria"
  ON evaluation_criteria FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update criteria"
  ON evaluation_criteria FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) NOT NULL,
  manager_id uuid REFERENCES users(id) NOT NULL,
  department_id uuid REFERENCES departments(id) NOT NULL,
  period_id uuid REFERENCES evaluation_periods(id) NOT NULL,
  status text DEFAULT 'مسودة' CHECK (status IN ('مسودة', 'تم الإرسال', 'اطلع الموظف', 'مغلق')),
  final_score_500 numeric(6,2) DEFAULT 0,
  final_score_5 numeric(3,2) DEFAULT 0,
  percentage numeric(5,2) DEFAULT 0,
  general_rating text,
  manager_note text,
  employee_note text,
  submitted_at timestamptz,
  viewed_by_employee_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR manager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = auth.uid())
  );

CREATE POLICY "Managers can insert evaluations for their department"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    manager_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = employee_id
      AND e.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update their evaluations"
  ON evaluations FOR UPDATE
  TO authenticated
  USING (
    manager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = auth.uid())
  )
  WITH CHECK (
    manager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = auth.uid())
  );

-- Evaluation scores table
CREATE TABLE IF NOT EXISTS evaluation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid REFERENCES evaluations(id) ON DELETE CASCADE NOT NULL,
  criterion_id uuid REFERENCES evaluation_criteria(id) NOT NULL,
  score_1_to_5 integer CHECK (score_1_to_5 >= 1 AND score_1_to_5 <= 5),
  weighted_result numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(evaluation_id, criterion_id)
);

ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scores for accessible evaluations"
  ON evaluation_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
        OR e.manager_id = auth.uid()
        OR EXISTS (SELECT 1 FROM employees WHERE id = e.employee_id AND user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Managers can insert scores"
  ON evaluation_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update scores"
  ON evaluation_scores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = auth.uid()
    )
  );

-- Development plans table
CREATE TABLE IF NOT EXISTS development_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid REFERENCES evaluations(id) ON DELETE CASCADE NOT NULL,
  item_order integer NOT NULL,
  development_goal text NOT NULL,
  action_plan text NOT NULL,
  duration text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE development_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view development plans for accessible evaluations"
  ON development_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
        OR e.manager_id = auth.uid()
        OR EXISTS (SELECT 1 FROM employees WHERE id = e.employee_id AND user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Managers can insert development plans"
  ON development_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update development plans"
  ON development_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can delete development plans"
  ON development_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = auth.uid()
    )
  );

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_employee ON evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_manager ON evaluations(manager_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_department ON evaluations(department_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_period ON evaluations(period_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_scores_evaluation ON evaluation_scores(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_development_plans_evaluation ON development_plans(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_periods_updated_at BEFORE UPDATE ON evaluation_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_criteria_updated_at BEFORE UPDATE ON evaluation_criteria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_scores_updated_at BEFORE UPDATE ON evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_development_plans_updated_at BEFORE UPDATE ON development_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();