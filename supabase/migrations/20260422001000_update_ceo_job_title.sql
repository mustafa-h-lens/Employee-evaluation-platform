-- Update CEO job title to use definite article form
UPDATE users
SET job_title = 'الرئيس التنفيذي'
WHERE job_title = 'رئيس تنفيذي'
  AND role = 'ceo';
