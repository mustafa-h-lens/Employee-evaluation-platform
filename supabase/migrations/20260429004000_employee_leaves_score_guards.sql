-- Defense-in-depth for the employee_leaves feature: even if the UI lets a
-- score-insert through (stale session, manual API call, future refactor that
-- forgets the filter), the DB itself rejects writes that target a paused
-- employee. The picker filters in the UI are the friendly UX; this is the
-- hard guarantee.

CREATE OR REPLACE FUNCTION reject_score_for_paused_employee()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee_id uuid;
  v_period_start date;
BEGIN
  IF TG_TABLE_NAME = 'evaluation_scores' THEN
    SELECT e.employee_id, p.start_date
      INTO v_employee_id, v_period_start
    FROM evaluations e
    JOIN evaluation_periods p ON p.id = e.period_id
    WHERE e.id = NEW.evaluation_id;
  ELSIF TG_TABLE_NAME = 'supervisor_evaluation_scores' THEN
    SELECT se.employee_id, p.start_date
      INTO v_employee_id, v_period_start
    FROM supervisor_evaluations se
    JOIN evaluation_periods p ON p.id = se.period_id
    WHERE se.id = NEW.evaluation_id;
  ELSIF TG_TABLE_NAME = 'director_evaluation_scores' THEN
    -- director_id points to users.id; resolve to employees.id via user_id join.
    SELECT emp.id, p.start_date
      INTO v_employee_id, v_period_start
    FROM director_evaluations de
    JOIN evaluation_periods p ON p.id = de.period_id
    LEFT JOIN employees emp ON emp.user_id = de.director_id
    WHERE de.id = NEW.evaluation_id;
  END IF;

  IF v_employee_id IS NOT NULL
     AND v_period_start IS NOT NULL
     AND is_employee_on_leave(v_employee_id, v_period_start) THEN
    RAISE EXCEPTION
      'Cannot insert score: target employee is on leave for this period (employee_id=%, month=%)',
      v_employee_id, v_period_start
      USING HINT = 'هذا الموظف في إجازة خلال هذا الشهر — لا يمكن تقييمه.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluation_scores_leave_guard ON evaluation_scores;
CREATE TRIGGER trg_evaluation_scores_leave_guard
  BEFORE INSERT ON evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION reject_score_for_paused_employee();

DROP TRIGGER IF EXISTS trg_supervisor_evaluation_scores_leave_guard ON supervisor_evaluation_scores;
CREATE TRIGGER trg_supervisor_evaluation_scores_leave_guard
  BEFORE INSERT ON supervisor_evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION reject_score_for_paused_employee();

DROP TRIGGER IF EXISTS trg_director_evaluation_scores_leave_guard ON director_evaluation_scores;
CREATE TRIGGER trg_director_evaluation_scores_leave_guard
  BEFORE INSERT ON director_evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION reject_score_for_paused_employee();
