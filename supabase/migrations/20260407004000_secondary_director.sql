-- Add secondary director support for departments
-- Allows assigning two directors (e.g. both CEOs) to one department
ALTER TABLE directorates ADD COLUMN IF NOT EXISTS secondary_director_id UUID REFERENCES users(id) ON DELETE SET NULL;
