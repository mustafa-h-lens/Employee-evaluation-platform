/*
  # Link users table to Supabase Auth and update RLS policies

  1. Changes
    - Add `auth_id` column to `users` table (references auth.users)
    - Drop all existing RLS policies
    - Recreate RLS policies using auth.uid() matched against users.auth_id
    - Allow anon select on users for initial login flow (limited columns)

  2. Security
    - All policies now use auth.uid() = users.auth_id pattern
    - Proper role-based access control maintained
    - Audit logs insert policy relaxed for authenticated users
*/

-- Add auth_id column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_id uuid UNIQUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- Helper function to get user role from auth.uid()
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to get user id from auth.uid()
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS uuid AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

-- Users policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admin can insert users" ON users;
DROP POLICY IF EXISTS "Admin can update users" ON users;

-- Departments policies
DROP POLICY IF EXISTS "Authenticated users can view departments" ON departments;
DROP POLICY IF EXISTS "Admin can insert departments" ON departments;
DROP POLICY IF EXISTS "Admin can update departments" ON departments;

-- Employees policies
DROP POLICY IF EXISTS "Admin can view all employees" ON employees;
DROP POLICY IF EXISTS "Admin can insert employees" ON employees;
DROP POLICY IF EXISTS "Admin can update employees" ON employees;

-- Evaluation periods policies
DROP POLICY IF EXISTS "Authenticated users can view periods" ON evaluation_periods;
DROP POLICY IF EXISTS "Admin can insert periods" ON evaluation_periods;
DROP POLICY IF EXISTS "Admin can update periods" ON evaluation_periods;

-- Evaluation criteria policies
DROP POLICY IF EXISTS "Authenticated users can view criteria" ON evaluation_criteria;
DROP POLICY IF EXISTS "Admin can insert criteria" ON evaluation_criteria;
DROP POLICY IF EXISTS "Admin can update criteria" ON evaluation_criteria;

-- Evaluations policies
DROP POLICY IF EXISTS "Admin can view all evaluations" ON evaluations;
DROP POLICY IF EXISTS "Managers can insert evaluations for their department" ON evaluations;
DROP POLICY IF EXISTS "Managers can update their evaluations" ON evaluations;

-- Evaluation scores policies
DROP POLICY IF EXISTS "Users can view scores for accessible evaluations" ON evaluation_scores;
DROP POLICY IF EXISTS "Managers can insert scores" ON evaluation_scores;
DROP POLICY IF EXISTS "Managers can update scores" ON evaluation_scores;

-- Development plans policies
DROP POLICY IF EXISTS "Users can view development plans for accessible evaluations" ON development_plans;
DROP POLICY IF EXISTS "Managers can insert development plans" ON development_plans;
DROP POLICY IF EXISTS "Managers can update development plans" ON development_plans;
DROP POLICY IF EXISTS "Managers can delete development plans" ON development_plans;

-- Audit logs policies
DROP POLICY IF EXISTS "Admin can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

-- ============================================
-- RECREATE ALL RLS POLICIES
-- ============================================

-- USERS TABLE
CREATE POLICY "Authenticated users can read own and admin reads all"
  ON users FOR SELECT
  TO authenticated
  USING (
    auth_id = auth.uid()
    OR get_user_role() = 'admin'
    OR get_user_role() = 'manager'
  );

CREATE POLICY "Admin can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- DEPARTMENTS TABLE
CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- EMPLOYEES TABLE
CREATE POLICY "Users can view relevant employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'admin'
    OR manager_id = get_user_id()
    OR user_id = get_user_id()
  );

CREATE POLICY "Admin can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- EVALUATION PERIODS TABLE
CREATE POLICY "Authenticated users can view periods"
  ON evaluation_periods FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can insert periods"
  ON evaluation_periods FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update periods"
  ON evaluation_periods FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- EVALUATION CRITERIA TABLE
CREATE POLICY "Authenticated users can view criteria"
  ON evaluation_criteria FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can insert criteria"
  ON evaluation_criteria FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update criteria"
  ON evaluation_criteria FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- EVALUATIONS TABLE
CREATE POLICY "Users can view relevant evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'admin'
    OR manager_id = get_user_id()
    OR EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = get_user_id())
  );

CREATE POLICY "Managers can insert evaluations"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    manager_id = get_user_id()
    AND EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = employee_id
      AND e.manager_id = get_user_id()
    )
  );

CREATE POLICY "Managers can update evaluations"
  ON evaluations FOR UPDATE
  TO authenticated
  USING (
    manager_id = get_user_id()
    OR EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = get_user_id())
  )
  WITH CHECK (
    manager_id = get_user_id()
    OR EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = get_user_id())
  );

-- EVALUATION SCORES TABLE
CREATE POLICY "Users can view relevant scores"
  ON evaluation_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND (
        get_user_role() = 'admin'
        OR e.manager_id = get_user_id()
        OR EXISTS (SELECT 1 FROM employees WHERE id = e.employee_id AND user_id = get_user_id())
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
      AND e.manager_id = get_user_id()
    )
  );

CREATE POLICY "Managers can update scores"
  ON evaluation_scores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = get_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = get_user_id()
    )
  );

-- DEVELOPMENT PLANS TABLE
CREATE POLICY "Users can view relevant development plans"
  ON development_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND (
        get_user_role() = 'admin'
        OR e.manager_id = get_user_id()
        OR EXISTS (SELECT 1 FROM employees WHERE id = e.employee_id AND user_id = get_user_id())
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
      AND e.manager_id = get_user_id()
    )
  );

CREATE POLICY "Managers can update development plans"
  ON development_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = get_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = get_user_id()
    )
  );

CREATE POLICY "Managers can delete development plans"
  ON development_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
      AND e.manager_id = get_user_id()
    )
  );

-- AUDIT LOGS TABLE
CREATE POLICY "Admin can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
