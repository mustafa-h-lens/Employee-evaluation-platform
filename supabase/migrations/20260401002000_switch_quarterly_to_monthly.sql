-- =====================================================
-- Migration: Switch from quarterly to monthly evaluations
-- =====================================================

-- 1. Rename 'quarter' column to 'month'
ALTER TABLE evaluation_periods RENAME COLUMN quarter TO month;

-- 2. Drop old constraints
ALTER TABLE evaluation_periods DROP CONSTRAINT IF EXISTS evaluation_periods_quarter_check;
ALTER TABLE evaluation_periods DROP CONSTRAINT IF EXISTS evaluation_periods_year_quarter_key;

-- 3. Add new month constraint (1-12)
ALTER TABLE evaluation_periods ADD CONSTRAINT evaluation_periods_month_check
  CHECK (month >= 1 AND month <= 12);

-- 4. Add unique constraint for year + month
ALTER TABLE evaluation_periods ADD CONSTRAINT evaluation_periods_year_month_key
  UNIQUE (year, month);
