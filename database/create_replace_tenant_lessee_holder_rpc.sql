-- Supabase RPC: replace_tenant_lessee_holder_no_review
-- Run this in Supabase SQL Editor.
--
-- Purpose:
-- - Replace an active tenant OR lessee holder with a new holder.
-- - Close previous active land_history rows for that role.
-- - Create new active rows for replacement holder on the same parcels.
-- - Update rsbsa_farm_parcels owner-link fields for that role.
--
-- Notes:
-- - This does NOT change registered land ownership.
-- - Uses owner context id to avoid accidental cross-owner replacement.

create or replace function public.replace_tenant_lessee_holder_no_review(
  p_role text,
  p_current_holder_id bigint,
  p_replacement_holder_id bigint,
  p_owner_context_id bigint,
  p_reason text default null,
  p_effective_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(coalesce(p_role, '')));
  v_now date := coalesce(p_effective_date, current_date);
  v_reason text := coalesce(
    nullif(trim(p_reason), ''),
    case
      when lower(trim(coalesce(p_role, ''))) = 'tenant' then 'Tenant replacement'
      else 'Lessee replacement'
    end
  );

  v_current_name text;
  v_replacement_name text;
  v_current_ffrs text;
  v_replacement_ffrs text;

  v_role_change_type text;
  v_tenant_flag boolean;
  v_lessee_flag boolean;

  v_closed_count integer := 0;
  v_inserted_count integer := 0;
  v_parcel_update_count integer := 0;

  v_row record;
begin
  if v_role not in ('tenant', 'lessee') then
    raise exception 'p_role must be tenant or lessee';
  end if;

  if p_current_holder_id is null or p_replacement_holder_id is null then
    raise exception 'Current and replacement holder IDs are required.';
  end if;

  if p_owner_context_id is null then
    raise exception 'Owner context ID is required.';
  end if;

  if p_current_holder_id = p_replacement_holder_id then
    raise exception 'Current and replacement holder must be different.';
  end if;

  if not exists (select 1 from rsbsa_submission where id = p_current_holder_id) then
    raise exception 'Current holder % not found.', p_current_holder_id;
  end if;

  if not exists (select 1 from rsbsa_submission where id = p_replacement_holder_id) then
    raise exception 'Replacement holder % not found.', p_replacement_holder_id;
  end if;

  select
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  into v_current_name, v_current_ffrs
  from rsbsa_submission
  where id = p_current_holder_id;

  select
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  into v_replacement_name, v_replacement_ffrs
  from rsbsa_submission
  where id = p_replacement_holder_id;

  v_role_change_type := case when v_role = 'tenant' then 'TENANT_CHANGE' else 'LESSEE_CHANGE' end;
  v_tenant_flag := (v_role = 'tenant');
  v_lessee_flag := (v_role = 'lessee');

  create temporary table if not exists tmp_role_rows_to_replace on commit drop as
  select
    lh.id,
    lh.land_parcel_id,
    lh.farm_parcel_id,
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.farm_location_municipality,
    lh.total_farm_area_ha,
    lh.land_owner_id,
    lh.land_owner_name,
    lh.land_owner_ffrs_code,
    lh.ownership_document_no,
    lh.agrarian_reform_beneficiary,
    lh.within_ancestral_domain
  from land_history lh
  where false;

  truncate table tmp_role_rows_to_replace;

  insert into tmp_role_rows_to_replace
  select
    lh.id,
    lh.land_parcel_id,
    lh.farm_parcel_id,
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.farm_location_municipality,
    lh.total_farm_area_ha,
    lh.land_owner_id,
    lh.land_owner_name,
    lh.land_owner_ffrs_code,
    lh.ownership_document_no,
    lh.agrarian_reform_beneficiary,
    lh.within_ancestral_domain
  from land_history lh
  where lh.is_current = true
    and lh.farmer_id = p_current_holder_id
    and lh.land_owner_id = p_owner_context_id
    and (
      (v_role = 'tenant' and lh.is_tenant = true)
      or
      (v_role = 'lessee' and lh.is_lessee = true)
    );

  if not exists (select 1 from tmp_role_rows_to_replace) then
    raise exception 'No active % assignment found for current holder % under owner context %.',
      v_role, p_current_holder_id, p_owner_context_id;
  end if;

  update land_history lh
  set
    is_current = false,
    period_end_date = v_now,
    updated_at = now(),
    change_type = v_role_change_type,
    change_reason = coalesce(nullif(lh.change_reason, ''), v_reason),
    notes = coalesce(
      nullif(trim(lh.notes), ''),
      format(
        '%s replacement from farmer %s to %s under owner %s',
        initcap(v_role),
        p_current_holder_id,
        p_replacement_holder_id,
        p_owner_context_id
      )
    )
  where lh.id in (select id from tmp_role_rows_to_replace);

  get diagnostics v_closed_count = row_count;

  insert into land_history (
    land_parcel_id,
    farm_parcel_id,
    farmer_id,
    farmer_name,
    farmer_ffrs_code,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    is_registered_owner,
    is_tenant,
    is_lessee,
    land_owner_id,
    land_owner_name,
    land_owner_ffrs_code,
    is_current,
    period_start_date,
    period_end_date,
    change_type,
    change_reason,
    previous_history_id,
    rsbsa_submission_id,
    ownership_document_no,
    agrarian_reform_beneficiary,
    within_ancestral_domain,
    created_at,
    updated_at,
    notes
  )
  select
    r.land_parcel_id,
    r.farm_parcel_id,
    p_replacement_holder_id,
    v_replacement_name,
    v_replacement_ffrs,
    r.parcel_number,
    r.farm_location_barangay,
    r.farm_location_municipality,
    r.total_farm_area_ha,
    false,
    v_tenant_flag,
    v_lessee_flag,
    r.land_owner_id,
    r.land_owner_name,
    r.land_owner_ffrs_code,
    true,
    v_now,
    null,
    v_role_change_type,
    v_reason,
    r.id,
    p_replacement_holder_id,
    r.ownership_document_no,
    r.agrarian_reform_beneficiary,
    r.within_ancestral_domain,
    now(),
    now(),
    format(
      '%s replacement from farmer %s to %s under owner %s',
      initcap(v_role),
      p_current_holder_id,
      p_replacement_holder_id,
      p_owner_context_id
    )
  from tmp_role_rows_to_replace r;

  get diagnostics v_inserted_count = row_count;

  for v_row in
    select distinct
      farm_parcel_id,
      land_owner_id,
      land_owner_name,
      total_farm_area_ha
    from tmp_role_rows_to_replace
    where farm_parcel_id is not null
  loop
    if v_role = 'tenant' then
      update rsbsa_farm_parcels
      set
        submission_id = p_replacement_holder_id,
        ownership_type_registered_owner = false,
        ownership_type_tenant = true,
        ownership_type_lessee = false,
        ownership_type_others = false,
        tenant_land_owner_id = coalesce(v_row.land_owner_id, p_owner_context_id),
        tenant_land_owner_name = coalesce(v_row.land_owner_name, ''),
        lessee_land_owner_id = null,
        lessee_land_owner_name = null,
        is_current_owner = false,
        total_farm_area_ha = coalesce(v_row.total_farm_area_ha, total_farm_area_ha),
        updated_at = now()
      where id = v_row.farm_parcel_id;
    else
      update rsbsa_farm_parcels
      set
        submission_id = p_replacement_holder_id,
        ownership_type_registered_owner = false,
        ownership_type_tenant = false,
        ownership_type_lessee = true,
        ownership_type_others = false,
        lessee_land_owner_id = coalesce(v_row.land_owner_id, p_owner_context_id),
        lessee_land_owner_name = coalesce(v_row.land_owner_name, ''),
        tenant_land_owner_id = null,
        tenant_land_owner_name = null,
        is_current_owner = false,
        total_farm_area_ha = coalesce(v_row.total_farm_area_ha, total_farm_area_ha),
        updated_at = now()
      where id = v_row.farm_parcel_id;
    end if;

    v_parcel_update_count := v_parcel_update_count + 1;
  end loop;

  return jsonb_build_object(
    'message', format(
      '%s replacement successful: %s -> %s (%s assignment%s).',
      initcap(v_role),
      coalesce(v_current_name, concat('Farmer #', p_current_holder_id::text)),
      coalesce(v_replacement_name, concat('Farmer #', p_replacement_holder_id::text)),
      v_inserted_count,
      case when v_inserted_count = 1 then '' else 's' end
    ),
    'role', v_role,
    'closedRows', v_closed_count,
    'affectedRows', v_inserted_count,
    'updatedParcels', v_parcel_update_count,
    'ownerContextId', p_owner_context_id,
    'currentHolderId', p_current_holder_id,
    'replacementHolderId', p_replacement_holder_id
  );
end;
$$;

grant execute on function public.replace_tenant_lessee_holder_no_review(
  text,
  bigint,
  bigint,
  bigint,
  text,
  date
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
