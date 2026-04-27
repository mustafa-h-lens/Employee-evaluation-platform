-- Self-service avatar update. The existing users-table UPDATE policy is admin
-- only, so direct UPDATEs from non-admin users were silently rejected by RLS
-- (no rows affected, no error). This RPC bypasses that — restricted to the
-- caller's own row, and only the avatar_url column.

CREATE OR REPLACE FUNCTION set_my_avatar_url(p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE users SET avatar_url = p_url, updated_at = now()
  WHERE auth_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION set_my_avatar_url(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_my_avatar_url(text) TO authenticated;
