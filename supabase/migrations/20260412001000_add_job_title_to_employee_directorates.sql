-- Add per-directorate job title to employee_directorates junction table
ALTER TABLE employee_directorates ADD COLUMN IF NOT EXISTS job_title TEXT;
