-- ═══════════════════════════════════════════════════════════════
-- CEO Evaluation System: Employees evaluate CEOs anonymously
-- ═══════════════════════════════════════════════════════════════

-- 1. Criteria for evaluating CEOs (managed by HR/admin only)
CREATE TABLE ceo_evaluation_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  weight integer NOT NULL CHECK (weight >= 1 AND weight <= 100),
  "order" integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ceo_evaluation_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_ceo_eval_criteria" ON ceo_evaluation_criteria FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "all_read_ceo_eval_criteria" ON ceo_evaluation_criteria FOR SELECT USING (true);
CREATE TRIGGER update_ceo_eval_criteria_ts BEFORE UPDATE ON ceo_evaluation_criteria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Quarterly evaluation periods for CEO evaluations
CREATE TABLE ceo_evaluation_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL CHECK (year >= 2020 AND year <= 2100),
  quarter integer NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'قادمة' CHECK (status IN ('نشطة', 'مغلقة', 'قادمة')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year, quarter)
);

ALTER TABLE ceo_evaluation_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_ceo_eval_periods" ON ceo_evaluation_periods FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "all_read_ceo_eval_periods" ON ceo_evaluation_periods FOR SELECT USING (true);
CREATE TRIGGER update_ceo_eval_periods_ts BEFORE UPDATE ON ceo_evaluation_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Individual CEO evaluations (one per evaluator per CEO per period)
CREATE TABLE ceo_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ceo_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  evaluator_id uuid REFERENCES users(id) NOT NULL,
  period_id uuid REFERENCES ceo_evaluation_periods(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'مسودة' CHECK (status IN ('مسودة', 'تم الإرسال')),
  final_score_500 numeric DEFAULT 0,
  final_score_5 numeric(4,2) DEFAULT 0,
  percentage numeric(5,2) DEFAULT 0,
  general_rating text,
  evaluator_note text,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ceo_id, evaluator_id, period_id)
);

ALTER TABLE ceo_evaluations ENABLE ROW LEVEL SECURITY;

-- Admin sees everything including evaluator names
CREATE POLICY "admin_full_ceo_evaluations" ON ceo_evaluations FOR ALL USING (get_user_role() = 'admin');

-- Non-CEO users manage their own evaluations
CREATE POLICY "evaluator_insert_ceo_eval" ON ceo_evaluations FOR INSERT
  WITH CHECK (get_user_role() IN ('employee', 'director', 'admin') AND evaluator_id = get_user_id());
CREATE POLICY "evaluator_update_ceo_eval" ON ceo_evaluations FOR UPDATE
  USING (evaluator_id = get_user_id() AND get_user_role() != 'ceo')
  WITH CHECK (evaluator_id = get_user_id() AND get_user_role() != 'ceo');
CREATE POLICY "evaluator_delete_ceo_eval" ON ceo_evaluations FOR DELETE
  USING (evaluator_id = get_user_id() AND get_user_role() != 'ceo');
CREATE POLICY "evaluator_read_own_ceo_eval" ON ceo_evaluations FOR SELECT
  USING (evaluator_id = get_user_id());

-- CEO can read evaluations targeting them (will strip evaluator_id in frontend/RPC)
CREATE POLICY "ceo_read_own_ceo_eval" ON ceo_evaluations FOR SELECT
  USING (get_user_role() = 'ceo' AND ceo_id = get_user_id());

CREATE TRIGGER update_ceo_evaluations_ts BEFORE UPDATE ON ceo_evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_ceo_evaluations_ceo ON ceo_evaluations(ceo_id);
CREATE INDEX idx_ceo_evaluations_period ON ceo_evaluations(period_id);
CREATE INDEX idx_ceo_evaluations_evaluator ON ceo_evaluations(evaluator_id);

-- 4. Scores per criterion per evaluation
CREATE TABLE ceo_evaluation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid REFERENCES ceo_evaluations(id) ON DELETE CASCADE NOT NULL,
  criterion_id uuid REFERENCES ceo_evaluation_criteria(id) NOT NULL,
  score_1_to_5 numeric(4,2) NOT NULL CHECK (score_1_to_5 >= 1 AND score_1_to_5 <= 5),
  weighted_result numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ceo_evaluation_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_ceo_eval_scores" ON ceo_evaluation_scores FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "evaluator_manage_ceo_eval_scores" ON ceo_evaluation_scores FOR ALL
  USING (evaluation_id IN (SELECT id FROM ceo_evaluations WHERE evaluator_id = get_user_id()))
  WITH CHECK (evaluation_id IN (SELECT id FROM ceo_evaluations WHERE evaluator_id = get_user_id()));
CREATE POLICY "ceo_read_own_eval_scores" ON ceo_evaluation_scores FOR SELECT
  USING (evaluation_id IN (SELECT id FROM ceo_evaluations WHERE ceo_id = get_user_id()));

CREATE TRIGGER update_ceo_eval_scores_ts BEFORE UPDATE ON ceo_evaluation_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. RPC function for CEO to get anonymous evaluations (hides evaluator_id)
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
  WHERE ce.ceo_id = p_ceo_id
    AND ce.status = 'تم الإرسال'
    AND (p_period_id IS NULL OR ce.period_id = p_period_id)
  ORDER BY p.year DESC, p.quarter DESC, ce.created_at DESC;
$$;
