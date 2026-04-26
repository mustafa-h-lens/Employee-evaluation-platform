-- One-shot wipe of all evaluation data and rubric configuration so the
-- system can be launched with a clean slate. Truncate is wrapped in a
-- single statement so all child tables (development_plans, etc.) cascade
-- atomically. Schema, RLS, users, employees, directorates, departments,
-- and audit logs are preserved.

TRUNCATE TABLE
  evaluation_scores,
  ceo_evaluation_scores,
  director_evaluation_scores,
  supervisor_evaluation_scores,
  evaluations,
  ceo_evaluations,
  director_evaluations,
  supervisor_evaluations,
  evaluation_criteria,
  department_criteria,
  ceo_evaluation_criteria,
  supervisor_criteria,
  evaluation_periods,
  ceo_evaluation_periods
RESTART IDENTITY CASCADE;
