-- Job ladder (career path) tables. Replaces the hardcoded list inside
-- OrgStructure.tsx so HR can manage departments, titles, order, and
-- per-department palette directly from the UI.

CREATE TABLE IF NOT EXISTS job_ladder_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  palette text NOT NULL DEFAULT 'teal',
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_ladder_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES job_ladder_departments(id) ON DELETE CASCADE,
  title text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_ladder_titles_department ON job_ladder_titles(department_id);

ALTER TABLE job_ladder_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_ladder_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_ladder_departments_read ON job_ladder_departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY job_ladder_titles_read ON job_ladder_titles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY job_ladder_departments_admin ON job_ladder_departments
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY job_ladder_titles_admin ON job_ladder_titles
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Seed only if empty
DO $$
DECLARE
  d_proj uuid; d_creative uuid; d_business uuid; d_finance uuid; d_production uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM job_ladder_departments) THEN
    RETURN;
  END IF;

  INSERT INTO job_ladder_departments (name, palette, "order")
    VALUES ('إدارة المشاريع', 'teal', 1) RETURNING id INTO d_proj;
  INSERT INTO job_ladder_departments (name, palette, "order")
    VALUES ('إدارة المحتوى الإبداعي', 'purple', 2) RETURNING id INTO d_creative;
  INSERT INTO job_ladder_departments (name, palette, "order")
    VALUES ('إدارة تطوير الأعمال', 'blue', 3) RETURNING id INTO d_business;
  INSERT INTO job_ladder_departments (name, palette, "order")
    VALUES ('إدارة المالية والشؤون الإدارية', 'green', 4) RETURNING id INTO d_finance;
  INSERT INTO job_ladder_departments (name, palette, "order")
    VALUES ('إدارة الإنتاج', 'amber', 5) RETURNING id INTO d_production;

  INSERT INTO job_ladder_titles (department_id, title, "order") VALUES
    (d_proj, 'مدير إدارة المشاريع', 1),
    (d_proj, 'مدير حساب', 2),
    (d_proj, 'مدير مشروع أول', 3),
    (d_proj, 'مدير مشروع', 4),
    (d_proj, 'مساعد مدير مشروع', 5),
    (d_creative, 'مدير إدارة المحتوى الإبداعي', 1),
    (d_creative, 'مشرف قسم', 2),
    (d_creative, 'كاتب محتوى إبداعي أول', 3),
    (d_creative, 'كاتب محتوى إبداعي', 4),
    (d_business, 'مدير إدارة تطوير الأعمال', 1),
    (d_business, 'مشرف قسم', 2),
    (d_business, 'أخصائي أول تطوير أعمال', 3),
    (d_business, 'أخصائي أول تسويق', 4),
    (d_business, 'أخصائي أول مبيعات', 5),
    (d_business, 'أخصائي أول تواصل', 6),
    (d_business, 'أخصائي تطوير أعمال', 7),
    (d_business, 'أخصائي تسويق', 8),
    (d_business, 'أخصائي مبيعات', 9),
    (d_business, 'أخصائي تواصل داخلي', 10),
    (d_finance, 'مدير إدارة المالية والشؤون الإدارية', 1),
    (d_finance, 'مشرف قسم', 2),
    (d_finance, 'محاسب عام', 3),
    (d_finance, 'محاسب', 4),
    (d_finance, 'أخصائي موارد بشرية أول', 5),
    (d_finance, 'أخصائي موارد بشرية', 6),
    (d_finance, 'أخصائي لوجستي أول', 7),
    (d_finance, 'أخصائي لوجستي', 8),
    (d_production, 'مدير إدارة الإنتاج', 1),
    (d_production, 'مشرف قسم', 2),
    (d_production, 'مصور فيديو', 3),
    (d_production, 'مصور سينمائي', 4),
    (d_production, 'مصور فوتوغرافي', 5),
    (d_production, 'مصمم جرافيك أول', 6),
    (d_production, 'مصمم جرافيك', 7),
    (d_production, 'محرر فيديو أول', 8),
    (d_production, 'محرر فيديو', 9),
    (d_production, 'مصمم رسوم متحركة أول', 10),
    (d_production, 'مصمم رسوم متحركة', 11),
    (d_production, 'رسام أول', 12),
    (d_production, 'رسام', 13);
END $$;
