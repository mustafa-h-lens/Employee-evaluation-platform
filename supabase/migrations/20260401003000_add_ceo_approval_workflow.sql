-- =====================================================
-- Migration: Add CEO Approval Workflow
-- Adds 'بانتظار الموافقة', 'موافقة', 'مرفوض' statuses
-- Adds ceo_comment, ceo_reviewed_at, ceo_reviewer_id
-- =====================================================

-- 1. Update evaluations status constraint
DO $$
BEGIN
  ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_status_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE evaluations ADD CONSTRAINT evaluations_status_check
  CHECK (status IN ('مسودة', 'بانتظار الموافقة', 'موافقة', 'مرفوض', 'تم الإرسال', 'اطلع الموظف', 'مغلق'));

-- 2. Add CEO approval columns to evaluations
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS ceo_comment text;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS ceo_reviewed_at timestamptz;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS ceo_reviewer_id uuid REFERENCES users(id);

-- 3. Update director_evaluations status constraint
DO $$
BEGIN
  ALTER TABLE director_evaluations DROP CONSTRAINT IF EXISTS director_evaluations_status_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE director_evaluations ADD CONSTRAINT director_evaluations_status_check
  CHECK (status IN ('مسودة', 'بانتظار الموافقة', 'موافقة', 'مرفوض', 'تم الإرسال', 'اطلع المدير', 'مغلق'));

-- 4. Add CEO approval columns to director_evaluations
ALTER TABLE director_evaluations ADD COLUMN IF NOT EXISTS ceo_comment text;
ALTER TABLE director_evaluations ADD COLUMN IF NOT EXISTS ceo_reviewed_at timestamptz;

-- 5. Migrate existing 'تم الإرسال' evaluations to 'بانتظار الموافقة' (optional: skip if you want existing ones to stay)
-- UPDATE evaluations SET status = 'بانتظار الموافقة' WHERE status = 'تم الإرسال';

-- 6. RLS policies for CEO to update evaluations (approve/reject)
CREATE POLICY "ceo_can_update_evaluations" ON evaluations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role = 'ceo'
    )
  );

CREATE POLICY "ceo_can_read_evaluations" ON evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role = 'ceo'
    )
  );
