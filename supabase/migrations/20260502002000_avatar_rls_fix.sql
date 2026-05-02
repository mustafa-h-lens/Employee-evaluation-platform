-- Avatar upload was failing with "new row violates row-level security policy"
-- because the original policies (20260427003000_user_avatars.sql) gated
-- writes on `(storage.foldername(name))[1] = auth.uid()::text`. That helper
-- can return an empty array when the path is interpreted oddly by the
-- storage service, and the [1] subscript on an empty array yields NULL,
-- which makes the equality NULL → RLS rejects the row.
--
-- Replace with a simple, robust LIKE-prefix check on the path. Same
-- security guarantee (a user can only write under their own UID folder)
-- without relying on the storage.foldername helper.

DROP POLICY IF EXISTS "avatar_read_public" ON storage.objects;
CREATE POLICY "avatar_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_user_insert_own" ON storage.objects;
CREATE POLICY "avatar_user_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND name LIKE auth.uid()::text || '/%'
  );

DROP POLICY IF EXISTS "avatar_user_update_own" ON storage.objects;
CREATE POLICY "avatar_user_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND name LIKE auth.uid()::text || '/%'
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND name LIKE auth.uid()::text || '/%'
  );

DROP POLICY IF EXISTS "avatar_user_delete_own" ON storage.objects;
CREATE POLICY "avatar_user_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND name LIKE auth.uid()::text || '/%'
  );

-- Ensure the bucket exists and is public-read.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
