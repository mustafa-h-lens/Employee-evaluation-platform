/*
  # نظام معايير التقييم العامة والخاصة

  ## التغييرات:
  1. جدول إعدادات التقييم (evaluation_settings) - لتحديد نسب الأوزان العامة والخاصة
  2. جدول معايير الأقسام (department_criteria) - المعايير الخاصة بكل قسم
  3. تحديث جدول درجات التقييم لدعم النوعين
*/

-- Evaluation settings table (singleton - one row)
CREATE TABLE IF NOT EXISTS evaluation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  general_weight integer NOT NULL DEFAULT 50 CHECK (general_weight >= 0 AND general_weight <= 100),
  specific_weight integer NOT NULL DEFAULT 50 CHECK (specific_weight >= 0 AND specific_weight <= 100),
  CHECK (general_weight + specific_weight = 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE evaluation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings"
  ON evaluation_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert settings"
  ON evaluation_settings FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update settings"
  ON evaluation_settings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Insert default settings (50/50 split)
INSERT INTO evaluation_settings (general_weight, specific_weight) VALUES (50, 50);

-- Department-specific criteria table
CREATE TABLE IF NOT EXISTS department_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  weight integer NOT NULL CHECK (weight >= 1 AND weight <= 100),
  "order" integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE department_criteria ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_department_criteria_department ON department_criteria(department_id);
CREATE INDEX IF NOT EXISTS idx_department_criteria_created_by ON department_criteria(created_by);

-- Everyone authenticated can view department criteria
CREATE POLICY "Authenticated users can view department criteria"
  ON department_criteria FOR SELECT
  TO authenticated
  USING (true);

-- Managers can insert criteria for their own department
CREATE POLICY "Managers can insert department criteria"
  ON department_criteria FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM departments d
      JOIN users u ON u.id = d.manager_id
      WHERE d.id = department_id
      AND u.auth_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Managers can update criteria for their own department
CREATE POLICY "Managers can update department criteria"
  ON department_criteria FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM departments d
      JOIN users u ON u.id = d.manager_id
      WHERE d.id = department_id
      AND u.auth_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM departments d
      JOIN users u ON u.id = d.manager_id
      WHERE d.id = department_id
      AND u.auth_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Managers can delete criteria for their own department
CREATE POLICY "Managers can delete department criteria"
  ON department_criteria FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM departments d
      JOIN users u ON u.id = d.manager_id
      WHERE d.id = department_id
      AND u.auth_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Add criterion_type to evaluation_scores to distinguish general vs specific
ALTER TABLE evaluation_scores ADD COLUMN IF NOT EXISTS criterion_type text DEFAULT 'general' CHECK (criterion_type IN ('general', 'specific'));

-- Add department_criterion_id for specific criteria scores
ALTER TABLE evaluation_scores ADD COLUMN IF NOT EXISTS department_criterion_id uuid REFERENCES department_criteria(id);

-- Make criterion_id nullable (specific criteria scores won't have it)
ALTER TABLE evaluation_scores ALTER COLUMN criterion_id DROP NOT NULL;

-- Add constraint: must have either criterion_id (general) or department_criterion_id (specific)
ALTER TABLE evaluation_scores ADD CONSTRAINT check_criterion_reference
  CHECK (
    (criterion_type = 'general' AND criterion_id IS NOT NULL) OR
    (criterion_type = 'specific' AND department_criterion_id IS NOT NULL)
  );

-- Add triggers for updated_at
CREATE TRIGGER update_evaluation_settings_updated_at BEFORE UPDATE ON evaluation_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_department_criteria_updated_at BEFORE UPDATE ON department_criteria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
