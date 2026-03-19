-- ============================================================================
-- SUPABASE MIGRATION: AUDIT LOG PAGE CONTEXT + ANONYMOUS ACTORS
-- Date: 2026-02-16
-- ============================================================================
-- Purpose:
-- 1) Stop strict dependency on user_name/user_role values.
-- 2) Normalize old records with NULL/unknown actor data.
-- 3) Improve route/page context lookup from metadata.
-- ============================================================================

ALTER TABLE IF EXISTS public.audit_logs
    ALTER COLUMN user_name DROP NOT NULL,
    ALTER COLUMN user_role DROP NOT NULL;

ALTER TABLE IF EXISTS public.audit_logs
    ALTER COLUMN user_name SET DEFAULT 'Anonymous',
    ALTER COLUMN user_role SET DEFAULT 'anonymous',
    ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.audit_logs
SET user_name = 'Anonymous'
WHERE user_name IS NULL
   OR BTRIM(user_name) = ''
   OR LOWER(BTRIM(user_name)) = 'unknown';

UPDATE public.audit_logs
SET user_role = 'anonymous'
WHERE user_role IS NULL
   OR BTRIM(user_role) = ''
   OR LOWER(BTRIM(user_role)) = 'unknown';

UPDATE public.audit_logs
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_route_path
ON public.audit_logs
(
    (
        COALESCE(
            NULLIF(metadata->>'route_path', ''),
            NULLIF(metadata->>'route_full_path', ''),
            NULLIF(metadata->>'path', ''),
            NULLIF(metadata->>'pathname', ''),
            NULLIF(metadata->>'route', ''),
            NULLIF(metadata->>'page', '')
        )
    )
);

CREATE OR REPLACE VIEW public.audit_logs_page_view AS
SELECT
    id,
    timestamp,
    user_id,
    COALESCE(NULLIF(BTRIM(user_name), ''), 'Anonymous') AS actor_name,
    COALESCE(NULLIF(BTRIM(user_role), ''), 'anonymous') AS actor_role,
    action,
    module,
    record_id,
    record_type,
    description,
    old_values,
    new_values,
    ip_address,
    session_id,
    metadata,
    COALESCE(
        NULLIF(metadata->>'route_path', ''),
        NULLIF(REGEXP_REPLACE(metadata->>'route_full_path', '^(https?://[^/]+)?([^?#]+).*$', '\\2'), ''),
        NULLIF(metadata->>'path', ''),
        NULLIF(metadata->>'pathname', ''),
        NULLIF(metadata->>'route', ''),
        NULLIF(metadata->>'page', '')
    ) AS page_path
FROM public.audit_logs;

COMMENT ON VIEW public.audit_logs_page_view IS
'Normalized audit logs with anonymous actor fallback and extracted page path for UI/reporting.';

-- Optional verification query:
-- SELECT id, timestamp, actor_name, actor_role, page_path, action, module
-- FROM public.audit_logs_page_view
-- ORDER BY timestamp DESC
-- LIMIT 25;
