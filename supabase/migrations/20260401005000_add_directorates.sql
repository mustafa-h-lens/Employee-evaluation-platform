-- Create directorates table
CREATE TABLE IF NOT EXISTS directorates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  director_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add directorate_id to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS directorate_id UUID REFERENCES directorates(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE directorates ENABLE ROW LEVEL SECURITY;

-- RLS policies for directorates (uses get_user_role() like other tables)
CREATE POLICY "directorates_select_all" ON directorates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "directorates_insert_admin" ON directorates FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "directorates_update_admin" ON directorates FOR UPDATE USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "directorates_delete_admin" ON directorates FOR DELETE USING (get_user_role() = 'admin');
