-- One-shot cleanup: delete مصطفى السيد's evaluation row(s) for the
-- إدارة تطوير الأعمال directorate so the مدير مباشر there can re-evaluate
-- after the multi-directorate group-membership bug is fixed in code.
--
-- evaluation_scores cascades via FK ON DELETE CASCADE, so we only need
-- to delete from `evaluations`.
--
-- Run this once in the Supabase SQL editor (NOT a migration — we don't
-- want it replaying). Inspect the SELECT first, then run the DELETE.

-- 1. Inspect: confirm the row(s) match before deleting.
SELECT
  ev.id,
  ev.status,
  ev.percentage,
  ev.submitted_at,
  e.full_name AS employee_name,
  d.name      AS directorate_name,
  p.year, p.month
FROM evaluations ev
JOIN employees e   ON e.id = ev.employee_id
JOIN directorates d ON d.id = ev.directorate_id
LEFT JOIN evaluation_periods p ON p.id = ev.period_id
WHERE e.full_name LIKE '%مصطفى%السيد%'
  AND d.name = 'إدارة تطوير الأعمال';

-- 2. Delete (uncomment after verifying the SELECT returned exactly the
--    rows you expect — typically one row, or two if it was already
--    submitted under both supervisors of a co-directorate).
--
-- DELETE FROM evaluations
-- WHERE id IN (
--   SELECT ev.id
--   FROM evaluations ev
--   JOIN employees e   ON e.id = ev.employee_id
--   JOIN directorates d ON d.id = ev.directorate_id
--   WHERE e.full_name LIKE '%مصطفى%السيد%'
--     AND d.name = 'إدارة تطوير الأعمال'
-- );
