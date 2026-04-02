-- Add ceo_reviewer_id to director_evaluations for approval workflow
ALTER TABLE director_evaluations ADD COLUMN IF NOT EXISTS ceo_reviewer_id uuid REFERENCES users(id);
