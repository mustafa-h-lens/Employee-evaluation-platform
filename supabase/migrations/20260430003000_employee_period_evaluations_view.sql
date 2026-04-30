-- Multi-directorate report aggregation. After 20260430002000 added
-- directorate_id to evaluations, an employee assigned to two directorates
-- gets two separate evaluation rows per period — one per directorate. For
-- approval and audit those stay separate. For employee-facing summaries
-- and HR/CEO reports the user wants ONE row per (employee, period)
-- representing the arithmetic mean across submitted directorates.

CREATE OR REPLACE VIEW employee_period_evaluations AS
SELECT
  e.employee_id,
  e.period_id,
  count(*)                                       AS source_count,
  -- The two scoring scales:
  AVG(e.percentage)::numeric(6, 2)               AS percentage,
  AVG(e.final_score_5)::numeric(4, 2)            AS final_score_5,
  AVG(e.final_score_500)::numeric(8, 2)          AS final_score_500,
  -- Recompute rating from the averaged percentage so it stays consistent
  -- with the displayed avg (rather than picking one source row's rating).
  CASE
    WHEN AVG(e.percentage) >= 90 THEN 'ممتاز'
    WHEN AVG(e.percentage) >= 80 THEN 'جيد جدًا'
    WHEN AVG(e.percentage) >= 60 THEN 'جيد'
    ELSE 'يحتاج تحسين'
  END                                            AS general_rating,
  array_agg(DISTINCT e.directorate_id)
    FILTER (WHERE e.directorate_id IS NOT NULL)  AS directorate_ids,
  array_agg(e.id)                                AS source_evaluation_ids,
  max(e.submitted_at)                            AS submitted_at,
  max(e.created_at)                              AS created_at
FROM evaluations e
WHERE e.status IN ('موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق', 'مكتمل', 'بانتظار الموافقة')
GROUP BY e.employee_id, e.period_id;

GRANT SELECT ON employee_period_evaluations TO authenticated;

-- Companion: how many directorates the employee is currently assigned to,
-- so the UI can render "X من Y إدارات" (e.g. "1 من 2") to flag partial
-- submissions. Single source of truth, used by every summary consumer.
CREATE OR REPLACE FUNCTION employee_directorate_count(p_employee_id uuid)
RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(
    (SELECT count(DISTINCT directorate_id)::int FROM employee_directorates WHERE employee_id = p_employee_id),
    CASE WHEN EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id AND directorate_id IS NOT NULL) THEN 1 ELSE 0 END
  );
$$;
GRANT EXECUTE ON FUNCTION employee_directorate_count(uuid) TO authenticated;
