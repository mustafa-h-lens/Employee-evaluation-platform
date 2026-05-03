-- Allow CEO to read supervisor_criteria so the approval detail modal
-- can render the specific-criteria table. Previously supervisor_criteria
-- only had admin / supervisor / employee read policies, which made the
-- `sup_criterion:supervisor_criteria(...)` join return null for the CEO
-- and collapsed the criteria sections in اعتمادية التقييمات.

CREATE POLICY "ceo_read_supervisor_criteria" ON supervisor_criteria
  FOR SELECT USING (get_user_role() = 'ceo');
