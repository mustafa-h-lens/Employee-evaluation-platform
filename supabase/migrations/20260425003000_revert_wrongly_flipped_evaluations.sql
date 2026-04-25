-- Revert evaluations that were auto-flipped to "اطلع الموظف" on employee view
-- before the CEO actually approved them. The signal is: status says viewed
-- but ceo_reviewed_at is NULL.

UPDATE evaluations
SET status = 'تم الإرسال',
    viewed_by_employee_at = NULL
WHERE status = 'اطلع الموظف'
  AND ceo_reviewed_at IS NULL;
