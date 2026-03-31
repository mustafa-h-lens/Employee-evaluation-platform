/*
  # Add admin delete policies for evaluation-related tables

  1. Security Changes
    - Add DELETE policy on `evaluations` for admin users
    - Add DELETE policy on `evaluation_scores` for admin users
    - Add DELETE policy on `development_plans` for admin users (if not covered)

  2. Why
    - CASCADE delete from employees table requires the authenticated user to also have
      delete permission on child tables due to RLS
    - Without these policies, admin users cannot delete employees that have evaluations
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'evaluations' AND policyname = 'Admin can delete evaluations'
  ) THEN
    CREATE POLICY "Admin can delete evaluations"
      ON evaluations FOR DELETE TO authenticated
      USING (get_user_role() = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'evaluation_scores' AND policyname = 'Admin can delete evaluation scores'
  ) THEN
    CREATE POLICY "Admin can delete evaluation scores"
      ON evaluation_scores FOR DELETE TO authenticated
      USING (get_user_role() = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'development_plans' AND policyname = 'Admin can delete development plans'
  ) THEN
    CREATE POLICY "Admin can delete development plans"
      ON development_plans FOR DELETE TO authenticated
      USING (get_user_role() = 'admin');
  END IF;
END $$;
