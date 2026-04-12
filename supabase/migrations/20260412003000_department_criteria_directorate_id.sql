-- Add directorate_id to department_criteria so criteria can be linked to directorates
ALTER TABLE department_criteria ADD COLUMN IF NOT EXISTS directorate_id UUID REFERENCES directorates(id) ON DELETE CASCADE;

-- Migrate existing department-level criteria: set directorate_id from parent department
UPDATE department_criteria dc
SET directorate_id = d.directorate_id
FROM departments d
WHERE dc.department_id = d.id
  AND dc.department_id IS NOT NULL
  AND d.directorate_id IS NOT NULL;

-- Index for fast lookup by directorate
CREATE INDEX IF NOT EXISTS idx_department_criteria_directorate ON department_criteria(directorate_id);
