-- Supabase RPC: create_ownership_transfer_no_review
-- Run this in Supabase SQL Editor to fix:
-- 404 Not Found on /rest/v1/rpc/create_ownership_transfer_no_review
--
-- Notes:
-- - SECURITY DEFINER is used so the function can run even when table RLS is strict.
-- - This function supports full and partial transfers from p_items payload.

-- Ensure ownership_transfers has required columns used by the RPC.
-- Safe to re-run.
create table if not exists public.ownership_transfers (
  id bigserial primary key,
  from_farmer_id bigint not null,
  to_farmer_id bigint not null,
  transfer_date date not null default current_date,
  transfer_type text,
  transfer_reason text,
  documents jsonb default '[]'::jsonb,
  notes text,
  created_at timestamp without time zone default now()
);

alter table public.ownership_transfers
  add column if not exists from_farmer_id bigint;
alter table public.ownership_transfers
  add column if not exists to_farmer_id bigint;
alter table public.ownership_transfers
  add column if not exists transfer_date date;
alter table public.ownership_transfers
  add column if not exists transfer_type text;
alter table public.ownership_transfers
  add column if not exists transfer_reason text;
alter table public.ownership_transfers
  add column if not exists documents jsonb default '[]'::jsonb;
alter table public.ownership_transfers
  add column if not exists notes text;
alter table public.ownership_transfers
  add column if not exists created_at timestamp without time zone default now();

create or replace function public.create_ownership_transfer_no_review(
  p_transfer_mode text,
  p_from_farmer_id bigint,
  p_to_farmer_id bigint,
  p_source_role text default null,
  p_area_mode text default null,
  p_area_requested_ha numeric default null,
  p_area_available_ha numeric default null,
  p_transfer_reason text default null,
  p_transfer_date date default current_date,
  p_is_deceased_confirmed boolean default false,
  p_items jsonb default '[]'::jsonb,
  p_proofs jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_id bigint;
  v_item jsonb;
  v_now date := coalesce(p_transfer_date, current_date);
  v_reason text := coalesce(nullif(trim(p_transfer_reason), ''), case when lower(coalesce(p_transfer_mode, '')) = 'inheritance' then 'Inheritance' else 'Voluntary Transfer' end);

  v_from_name text;
  v_to_name text;
  v_from_ffrs text;
  v_to_ffrs text;

  v_farm_parcel_id bigint;
  v_transfer_area numeric(10,2);
  v_parcel_area numeric(10,2);
  v_remaining_area numeric(10,2);
  v_new_parcel_id bigint;
  v_next_parcel_no integer;

  v_barangay text;
  v_municipality text;
  v_within_domain text;
  v_ownership_doc text;
  v_arb text;

  v_from_total numeric(10,2);
  v_to_total numeric(10,2);
begin
  if p_from_farmer_id is null or p_to_farmer_id is null then
    raise exception 'Both source and recipient farmer IDs are required.';
  end if;

  if p_from_farmer_id = p_to_farmer_id then
    raise exception 'Source and recipient farmers must be different.';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'At least one transfer item is required.';
  end if;

  -- Lock farmer records and resolve names/codes
  select
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  into v_from_name, v_from_ffrs
  from rsbsa_submission
  where id = p_from_farmer_id
  for update;

  if v_from_name is null then
    raise exception 'Source farmer % not found.', p_from_farmer_id;
  end if;

  select
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  into v_to_name, v_to_ffrs
  from rsbsa_submission
  where id = p_to_farmer_id
  for update;

  if v_to_name is null then
    raise exception 'Recipient farmer % not found.', p_to_farmer_id;
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_farm_parcel_id := nullif(v_item->>'land_parcel_id', '')::bigint;
    v_transfer_area := round(coalesce(nullif(v_item->>'transferred_area_ha', '')::numeric, 0)::numeric, 2);

    if v_farm_parcel_id is null or v_transfer_area <= 0 then
      raise exception 'Invalid transfer item payload: %', v_item::text;
    end if;

    -- Lock donor parcel and read copy fields for transfer/split.
    select
      round(coalesce(total_farm_area_ha, 0)::numeric, 2),
      farm_location_barangay,
      farm_location_municipality,
      within_ancestral_domain,
      ownership_document_no,
      agrarian_reform_beneficiary
    into
      v_parcel_area,
      v_barangay,
      v_municipality,
      v_within_domain,
      v_ownership_doc,
      v_arb
    from rsbsa_farm_parcels
    where id = v_farm_parcel_id
      and submission_id = p_from_farmer_id
    for update;

    if v_parcel_area is null then
      raise exception 'Parcel % is not owned by source farmer %.', v_farm_parcel_id, p_from_farmer_id;
    end if;

    if v_transfer_area > (v_parcel_area + 0.0001) then
      raise exception 'Transfer area %.2f exceeds parcel %.2f (parcel_id=%).', v_transfer_area, v_parcel_area, v_farm_parcel_id;
    end if;

    -- FULL transfer of this parcel
    if v_transfer_area >= (v_parcel_area - 0.0001) then
      update rsbsa_farm_parcels
      set
        submission_id = p_to_farmer_id,
        ownership_type_registered_owner = true,
        ownership_type_tenant = false,
        ownership_type_lessee = false,
        ownership_type_others = false,
        tenant_land_owner_name = null,
        lessee_land_owner_name = null,
        tenant_land_owner_id = null,
        lessee_land_owner_id = null,
        updated_at = now()
      where id = v_farm_parcel_id;

      -- Close ALL current rows for this parcel first.
      update land_history
      set
        is_current = false,
        period_end_date = v_now,
        updated_at = now()
      where farm_parcel_id = v_farm_parcel_id
        and is_current = true;

      -- Insert ONE clean current row for the new owner.
      insert into land_history (
        rsbsa_submission_id,
        farm_parcel_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        land_owner_id,
        land_owner_name,
        land_owner_ffrs_code,
        farmer_id,
        farmer_name,
        farmer_ffrs_code,
        is_tenant,
        is_lessee,
        is_registered_owner,
        ownership_document_no,
        agrarian_reform_beneficiary,
        within_ancestral_domain,
        period_start_date,
        is_current,
        change_type,
        change_reason,
        notes,
        created_at,
        updated_at
      )
      select
        p_to_farmer_id,
        fp.id,
        fp.parcel_number,
        fp.farm_location_barangay,
        fp.farm_location_municipality,
        fp.total_farm_area_ha,
        p_to_farmer_id,
        v_to_name,
        v_to_ffrs,
        p_to_farmer_id,
        v_to_name,
        v_to_ffrs,
        false,
        false,
        true,
        fp.ownership_document_no,
        case when coalesce(fp.agrarian_reform_beneficiary, 'No') = 'Yes' then true else false end,
        case when coalesce(fp.within_ancestral_domain, 'No') = 'Yes' then true else false end,
        v_now,
        true,
        'TRANSFER',
        v_reason,
        format('Full transfer from farmer %s to %s', p_from_farmer_id, p_to_farmer_id),
        now(),
        now()
      from rsbsa_farm_parcels fp
      where fp.id = v_farm_parcel_id;

    -- PARTIAL transfer: reduce donor parcel + create recipient parcel
    else
      v_remaining_area := round((v_parcel_area - v_transfer_area)::numeric, 2);

      update rsbsa_farm_parcels
      set
        total_farm_area_ha = v_remaining_area,
        updated_at = now()
      where id = v_farm_parcel_id;

      -- Update donor current history to the reduced area
      update land_history
      set
        rsbsa_submission_id = p_from_farmer_id,
        farmer_id = p_from_farmer_id,
        farmer_name = v_from_name,
        farmer_ffrs_code = v_from_ffrs,
        land_owner_id = p_from_farmer_id,
        land_owner_name = v_from_name,
        land_owner_ffrs_code = v_from_ffrs,
        total_farm_area_ha = v_remaining_area,
        is_registered_owner = true,
        is_tenant = false,
        is_lessee = false,
        change_type = 'TRANSFER_PARTIAL',
        change_reason = v_reason,
        notes = format('Partial transfer %.2f ha to farmer %s', v_transfer_area, p_to_farmer_id),
        updated_at = now()
      where farm_parcel_id = v_farm_parcel_id
        and is_current = true;

      if not found then
        insert into land_history (
          rsbsa_submission_id,
          farm_parcel_id,
          parcel_number,
          farm_location_barangay,
          farm_location_municipality,
          total_farm_area_ha,
          land_owner_id,
          land_owner_name,
          land_owner_ffrs_code,
          farmer_id,
          farmer_name,
          farmer_ffrs_code,
          is_tenant,
          is_lessee,
          is_registered_owner,
          ownership_document_no,
          agrarian_reform_beneficiary,
          within_ancestral_domain,
          period_start_date,
          is_current,
          change_type,
          change_reason,
          notes,
          created_at,
          updated_at
        )
        select
          p_from_farmer_id,
          fp.id,
          fp.parcel_number,
          fp.farm_location_barangay,
          fp.farm_location_municipality,
          v_remaining_area,
          p_from_farmer_id,
          v_from_name,
          v_from_ffrs,
          p_from_farmer_id,
          v_from_name,
          v_from_ffrs,
          false,
          false,
          true,
          fp.ownership_document_no,
          case when coalesce(fp.agrarian_reform_beneficiary, 'No') = 'Yes' then true else false end,
          case when coalesce(fp.within_ancestral_domain, 'No') = 'Yes' then true else false end,
          v_now,
          true,
          'TRANSFER_PARTIAL',
          v_reason,
          format('Partial transfer %.2f ha to farmer %s', v_transfer_area, p_to_farmer_id),
          now(),
          now()
        from rsbsa_farm_parcels fp
        where fp.id = v_farm_parcel_id;
      end if;

      -- Next parcel number for recipient
      select
        coalesce(
          max(case when parcel_number ~ '^[0-9]+$' then parcel_number::int else null end),
          0
        ) + 1
      into v_next_parcel_no
      from rsbsa_farm_parcels
      where submission_id = p_to_farmer_id;

      insert into rsbsa_farm_parcels (
        submission_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        within_ancestral_domain,
        ownership_document_no,
        agrarian_reform_beneficiary,
        ownership_type_registered_owner,
        ownership_type_tenant,
        ownership_type_lessee,
        ownership_type_others,
        tenant_land_owner_name,
        lessee_land_owner_name,
        tenant_land_owner_id,
        lessee_land_owner_id,
        created_at,
        updated_at
      )
      values (
        p_to_farmer_id,
        v_next_parcel_no::text,
        v_barangay,
        v_municipality,
        v_transfer_area,
        v_within_domain,
        v_ownership_doc,
        v_arb,
        true,
        false,
        false,
        false,
        null,
        null,
        null,
        null,
        now(),
        now()
      )
      returning id into v_new_parcel_id;

      insert into land_history (
        rsbsa_submission_id,
        farm_parcel_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        land_owner_id,
        land_owner_name,
        land_owner_ffrs_code,
        farmer_id,
        farmer_name,
        farmer_ffrs_code,
        is_tenant,
        is_lessee,
        is_registered_owner,
        ownership_document_no,
        agrarian_reform_beneficiary,
        within_ancestral_domain,
        period_start_date,
        is_current,
        change_type,
        change_reason,
        notes,
        created_at,
        updated_at
      )
      values (
        p_to_farmer_id,
        v_new_parcel_id,
        v_next_parcel_no::text,
        v_barangay,
        v_municipality,
        v_transfer_area,
        p_to_farmer_id,
        v_to_name,
        v_to_ffrs,
        p_to_farmer_id,
        v_to_name,
        v_to_ffrs,
        false,
        false,
        true,
        v_ownership_doc,
        case when coalesce(v_arb, 'No') = 'Yes' then true else false end,
        case when coalesce(v_within_domain, 'No') = 'Yes' then true else false end,
        v_now,
        true,
        'TRANSFER_PARTIAL',
        v_reason,
        format('Partial transfer %.2f ha from farmer %s', v_transfer_area, p_from_farmer_id),
        now(),
        now()
      );
    end if;
  end loop;

  -- Recompute farmer totals and statuses
  select round(coalesce(sum(total_farm_area_ha), 0)::numeric, 2)
  into v_from_total
  from rsbsa_farm_parcels
  where submission_id = p_from_farmer_id;

  select round(coalesce(sum(total_farm_area_ha), 0)::numeric, 2)
  into v_to_total
  from rsbsa_farm_parcels
  where submission_id = p_to_farmer_id;

  update rsbsa_submission
  set
    "TOTAL FARM AREA" = v_from_total,
    "OWNERSHIP_TYPE_REGISTERED_OWNER" = (v_from_total > 0),
    status = case when v_from_total > 0 then 'Active Farmer' else 'No Parcels' end,
    updated_at = now()
  where id = p_from_farmer_id;

  update rsbsa_submission
  set
    "TOTAL FARM AREA" = v_to_total,
    "OWNERSHIP_TYPE_REGISTERED_OWNER" = true,
    "OWNERSHIP_TYPE_TENANT" = false,
    "OWNERSHIP_TYPE_LESSEE" = false,
    status = 'Active Farmer',
    updated_at = now()
  where id = p_to_farmer_id;

  -- Transfer audit row
  insert into ownership_transfers (
    from_farmer_id,
    to_farmer_id,
    transfer_date,
    transfer_type,
    transfer_reason,
    documents,
    notes,
    created_at
  )
  values (
    p_from_farmer_id,
    p_to_farmer_id,
    v_now,
    lower(coalesce(p_transfer_mode, 'voluntary')),
    v_reason,
    coalesce(p_proofs, '[]'::jsonb),
    format(
      'source_role=%s | area_mode=%s | area_requested=%s | area_available=%s | is_deceased_confirmed=%s',
      coalesce(p_source_role, ''),
      coalesce(p_area_mode, ''),
      coalesce(p_area_requested_ha::text, ''),
      coalesce(p_area_available_ha::text, ''),
      coalesce(p_is_deceased_confirmed::text, 'false')
    ),
    now()
  )
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;

grant execute on function public.create_ownership_transfer_no_review(
  text, bigint, bigint, text, text, numeric, numeric, text, date, boolean, jsonb, jsonb
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
