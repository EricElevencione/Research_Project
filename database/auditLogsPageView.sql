create view public.audit_logs_page_view as
select
  al.id,
  al."timestamp",
  al.user_id,
  al.user_name,
  al.user_role,
  al.action,
  al.module,
  al.record_id,
  al.record_type,
  al.description,
  al.old_values,
  al.new_values,
  al.ip_address,
  al.session_id,
  al.metadata,
  al.created_at,
  u.email,
  u.role,
  u.first_name,
  u.last_name
from
  audit_logs al
  left join users u on al.user_id = u.id;