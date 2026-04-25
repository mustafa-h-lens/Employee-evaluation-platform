-- Co-directors of the same directorate need to read each other's evaluations
-- so the UI can show "بانتظار <peer name>" / "بانتظار الاعتماد" labels.
-- Without this, the existing SELECT policy hides the peer row and the
-- director list always shows "بانتظار التقييم".

CREATE POLICY co_director_read_peer_evaluations ON evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM directorates d
      JOIN employees e ON e.directorate_id = d.id
      WHERE e.id = evaluations.employee_id
        AND (d.director_id = get_user_id() OR d.secondary_director_id = get_user_id())
    )
  );
