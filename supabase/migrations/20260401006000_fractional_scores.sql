-- Change score columns from integer to numeric to support fractional values (e.g., 4.25, 4.5, 4.75)
ALTER TABLE evaluation_scores ALTER COLUMN score_1_to_5 TYPE numeric(4,2) USING score_1_to_5::numeric;
ALTER TABLE director_evaluation_scores ALTER COLUMN score_1_to_5 TYPE numeric(4,2) USING score_1_to_5::numeric;
