-- Allow fractional weights (e.g. 12.5, 22.5) on criteria. The columns were
-- declared as integer with CHECK (weight BETWEEN 1 AND 100), which silently
-- truncated decimals on the JS side (parseInt) and would have been rejected
-- by Postgres if a non-integer ever made it through. Switching to numeric(5,2)
-- preserves halves/quarters; CHECK keeps the 1..100 range.

ALTER TABLE evaluation_criteria
  ALTER COLUMN weight TYPE numeric(5,2) USING weight::numeric(5,2);

ALTER TABLE department_criteria
  DROP CONSTRAINT IF EXISTS department_criteria_weight_check,
  ALTER COLUMN weight TYPE numeric(5,2) USING weight::numeric(5,2),
  ADD CONSTRAINT department_criteria_weight_check CHECK (weight >= 1 AND weight <= 100);

ALTER TABLE supervisor_criteria
  DROP CONSTRAINT IF EXISTS supervisor_criteria_weight_check,
  ALTER COLUMN weight TYPE numeric(5,2) USING weight::numeric(5,2),
  ADD CONSTRAINT supervisor_criteria_weight_check CHECK (weight >= 1 AND weight <= 100);

ALTER TABLE ceo_evaluation_criteria
  DROP CONSTRAINT IF EXISTS ceo_evaluation_criteria_weight_check,
  ALTER COLUMN weight TYPE numeric(5,2) USING weight::numeric(5,2),
  ADD CONSTRAINT ceo_evaluation_criteria_weight_check CHECK (weight >= 1 AND weight <= 100);
