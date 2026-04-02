-- =====================================================
-- Migration: Add per-period weight distribution
-- Each evaluation period can have its own general/specific weight split
-- =====================================================

-- Add weight columns to evaluation_periods
ALTER TABLE evaluation_periods
  ADD COLUMN IF NOT EXISTS general_weight integer NOT NULL DEFAULT 50
    CHECK (general_weight >= 0 AND general_weight <= 100),
  ADD COLUMN IF NOT EXISTS specific_weight integer NOT NULL DEFAULT 50
    CHECK (specific_weight >= 0 AND specific_weight <= 100);

-- Copy current global settings to all existing periods
UPDATE evaluation_periods
SET general_weight = COALESCE((SELECT general_weight FROM evaluation_settings LIMIT 1), 50),
    specific_weight = COALESCE((SELECT specific_weight FROM evaluation_settings LIMIT 1), 50);
