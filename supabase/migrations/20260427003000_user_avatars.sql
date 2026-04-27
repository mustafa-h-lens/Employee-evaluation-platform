-- User avatars: per-user profile pictures uploaded to Supabase Storage.
-- Each user manages their own avatar (self-service). avatar_url stores the
-- public URL of the uploaded image; NULL = use initials fallback in the UI.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Public-read avatars bucket. Reads are open so <img src> binds directly to
-- the public URL; writes are gated by storage RLS below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read; users can write/replace/delete only inside their own
-- auth.uid() folder. Path pattern: avatars/{auth_uid}/avatar-{timestamp}.jpg
DROP POLICY IF EXISTS "avatar_read_public" ON storage.objects;
CREATE POLICY "avatar_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_user_insert_own" ON storage.objects;
CREATE POLICY "avatar_user_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_user_update_own" ON storage.objects;
CREATE POLICY "avatar_user_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_user_delete_own" ON storage.objects;
CREATE POLICY "avatar_user_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
