/*
  # Add cascade delete to employee-related foreign keys

  1. Changes
    - `evaluations.employee_id` FK: add ON DELETE CASCADE so deleting an employee removes their evaluations
    - `evaluation_scores.evaluation_id` FK: add ON DELETE CASCADE so deleting an evaluation removes its scores
    - `development_plans.evaluation_id` FK: add ON DELETE CASCADE so deleting an evaluation removes its development plans

  2. Why
    - Employees with evaluations could not be deleted because foreign key constraints blocked the operation
    - CASCADE ensures all related records are cleaned up automatically when an employee is deleted
*/

ALTER TABLE evaluation_scores
  DROP CONSTRAINT IF EXISTS evaluation_scores_evaluation_id_fkey,
  ADD CONSTRAINT evaluation_scores_evaluation_id_fkey
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE;

ALTER TABLE development_plans
  DROP CONSTRAINT IF EXISTS development_plans_evaluation_id_fkey,
  ADD CONSTRAINT development_plans_evaluation_id_fkey
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE;

ALTER TABLE evaluations
  DROP CONSTRAINT IF EXISTS evaluations_employee_id_fkey,
  ADD CONSTRAINT evaluations_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
