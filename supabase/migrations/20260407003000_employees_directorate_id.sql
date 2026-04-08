-- =============================================
-- Employees now belong directly to directorates (no departments layer)
-- =============================================

-- 1. Add directorate_id to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS directorate_id UUID REFERENCES directorates(id);

-- 2. Migrate existing data from department → directorate chain
UPDATE employees SET directorate_id = d.directorate_id
FROM departments d
WHERE employees.department_id = d.id AND d.directorate_id IS NOT NULL;

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_employees_directorate ON employees(directorate_id);
