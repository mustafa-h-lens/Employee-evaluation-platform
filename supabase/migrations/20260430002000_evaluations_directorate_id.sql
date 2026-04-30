-- Mustafa is assigned to two directorates and HR/CEO + the directors of
-- both want to evaluate him separately for each role. Today the
-- evaluations table only stores (employee_id, manager_id, period_id) so
-- there's no way to distinguish "this is Mustafa's evaluation as project
-- manager" from "this is Mustafa's evaluation as business-development
-- specialist" — both would collapse into one row. Add directorate_id so
-- evaluations are per-directorate.

ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS directorate_id uuid REFERENCES directorates(id);

CREATE INDEX IF NOT EXISTS idx_evaluations_directorate ON evaluations(directorate_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_emp_dir_period
  ON evaluations(employee_id, directorate_id, period_id);
