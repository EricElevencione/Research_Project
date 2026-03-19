-- ============================================================================
-- FIX AUDIT LOGS RLS POLICIES
-- ============================================================================
-- Problem: RLS is enabled on audit_logs but the policies use auth.jwt()
-- which returns NULL because this app uses custom auth (localStorage),
-- not Supabase Auth. This silently blocks ALL inserts and reads.
--
-- Solution: Replace with permissive policies since this is a desktop
-- Electron app (not publicly accessible).
-- ============================================================================

-- Step 1: Drop any existing restrictive policies
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Enable insert for all users" ON audit_logs;
DROP POLICY IF EXISTS "Enable read for all users" ON audit_logs;

-- Step 2: Ensure RLS is enabled (it likely already is)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 3: Create permissive policies
-- Allow all authenticated/anon users to INSERT audit logs
CREATE POLICY "Allow insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Allow all authenticated/anon users to READ audit logs
CREATE POLICY "Allow read audit logs" ON audit_logs
    FOR SELECT USING (true);

-- Step 4: Verify by inserting a test record
INSERT INTO audit_logs (user_name, user_role, action, module, description)
VALUES ('SYSTEM', 'system', 'CREATE', 'SYSTEM', 'RLS policy test - audit logging enabled');

-- Step 5: Verify the test record exists
SELECT id, timestamp, user_name, action, module, description
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 5;
