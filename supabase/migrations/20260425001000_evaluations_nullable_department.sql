-- Allow evaluations to be saved for employees who belong to a directorate
-- but not to a specific department. Directorate-only employees were
-- previously blocked by a NOT NULL constraint on evaluations.department_id.

ALTER TABLE evaluations
  ALTER COLUMN department_id DROP NOT NULL;
