-- Switch employee→leadership evaluations from per-CEO submissions to a single
-- collective row representing الإدارة العليا as a whole. ceo_id becomes
-- nullable; collective rows have ceo_id IS NULL. The legacy per-CEO unique
-- constraint is replaced by a partial unique index that enforces one
-- collective row per evaluator per period.

ALTER TABLE ceo_evaluations ALTER COLUMN ceo_id DROP NOT NULL;

ALTER TABLE ceo_evaluations
  DROP CONSTRAINT IF EXISTS ceo_evaluations_ceo_id_evaluator_id_period_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS ceo_evaluations_collective_unique
  ON ceo_evaluations (evaluator_id, period_id)
  WHERE ceo_id IS NULL;

-- CEO read RLS — any CEO can read collective rows. The legacy per-target
-- policy stays in place for any historical per-CEO rows.
DROP POLICY IF EXISTS "ceo_read_collective_ceo_eval" ON ceo_evaluations;
CREATE POLICY "ceo_read_collective_ceo_eval" ON ceo_evaluations FOR SELECT
  USING (get_user_role() = 'ceo' AND ceo_id IS NULL);

DROP POLICY IF EXISTS "ceo_read_collective_eval_scores" ON ceo_evaluation_scores;
CREATE POLICY "ceo_read_collective_eval_scores" ON ceo_evaluation_scores FOR SELECT
  USING (
    get_user_role() = 'ceo'
    AND evaluation_id IN (SELECT id FROM ceo_evaluations WHERE ceo_id IS NULL)
  );

-- RPC now ignores p_ceo_id and returns all submitted collective rows for the
-- (optionally filtered) period. Every CEO sees the same numbers because the
-- evaluation is about the leadership team as a unit.
CREATE OR REPLACE FUNCTION get_ceo_evaluations_anonymous(p_ceo_id uuid, p_period_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  ceo_id uuid,
  period_id uuid,
  status text,
  final_score_5 numeric,
  percentage numeric,
  general_rating text,
  evaluator_note text,
  submitted_at timestamptz,
  created_at timestamptz,
  quarter integer,
  year integer
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ce.id, ce.ceo_id, ce.period_id, ce.status,
    ce.final_score_5, ce.percentage, ce.general_rating,
    ce.evaluator_note, ce.submitted_at, ce.created_at,
    p.quarter, p.year
  FROM ceo_evaluations ce
  JOIN ceo_evaluation_periods p ON p.id = ce.period_id
  WHERE ce.status = 'تم الإرسال'
    AND ce.ceo_id IS NULL
    AND (p_period_id IS NULL OR ce.period_id = p_period_id)
  ORDER BY p.year DESC, p.quarter DESC, ce.created_at DESC;
$$;
