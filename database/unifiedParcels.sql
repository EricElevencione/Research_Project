create or replace view public.unified_parcels as
select
  p.id,
  p.submission_id as farmer_id,
  p.parcel_number,
  p.farm_location_barangay,
  p.farm_location_municipality,
  p.total_farm_area_ha,
  COALESCE(s."FFRS_CODE", lh.farmer_ffrs_code) as ffrs_code,
  concat_ws(
    ' '::text,
    s."FIRST NAME",
    s."MIDDLE NAME",
    s."LAST NAME",
    s."EXT NAME"
  ) as farmer_name,
  p.ownership_type_registered_owner as is_registered_owner,
  p.ownership_type_tenant as is_tenant,
  p.ownership_type_lessee as is_lessee,
  p.within_ancestral_domain,
  p.agrarian_reform_beneficiary,
  lh.change_type,
  lh.change_reason,
  GREATEST(p.updated_at, lh.updated_at) as last_updated,
  COALESCE(
    NULLIF(
      concat_ws(
        ' '::text,
        tenant_owner."FIRST NAME",
        tenant_owner."MIDDLE NAME",
        tenant_owner."LAST NAME",
        tenant_owner."EXT NAME"
      ),
      ''
    ),
    p.tenant_land_owner_name::text
  ) as tenant_land_owner_name,
  COALESCE(
    NULLIF(
      concat_ws(
        ' '::text,
        lessee_owner."FIRST NAME",
        lessee_owner."MIDDLE NAME",
        lessee_owner."LAST NAME",
        lessee_owner."EXT NAME"
      ),
      ''
    ),
    p.lessee_land_owner_name::text
  ) as lessee_land_owner_name,
  case
    when p.ownership_type_tenant then COALESCE(
      NULLIF(
        concat_ws(
          ' '::text,
          tenant_owner."FIRST NAME",
          tenant_owner."MIDDLE NAME",
          tenant_owner."LAST NAME",
          tenant_owner."EXT NAME"
        ),
        ''
      ),
      p.tenant_land_owner_name::text
    )
    when p.ownership_type_lessee then COALESCE(
      NULLIF(
        concat_ws(
          ' '::text,
          lessee_owner."FIRST NAME",
          lessee_owner."MIDDLE NAME",
          lessee_owner."LAST NAME",
          lessee_owner."EXT NAME"
        ),
        ''
      ),
      p.lessee_land_owner_name::text
    )
    else concat_ws(
      ' '::text,
      s."FIRST NAME",
      s."MIDDLE NAME",
      s."LAST NAME",
      s."EXT NAME"
    )
  end as land_owner_name,
  s.archived_at,
  COALESCE(p.is_current_owner, false) as is_current_owner
from
  rsbsa_farm_parcels p
  left join rsbsa_submission s on p.submission_id = s.id
  left join rsbsa_submission tenant_owner on p.tenant_land_owner_id = tenant_owner.id
  left join rsbsa_submission lessee_owner on p.lessee_land_owner_id = lessee_owner.id
  left join land_history lh on lh.farm_parcel_id = p.id
  and lh.is_current = true
where
  COALESCE(p.is_current_owner, false) = true
  or COALESCE(p.ownership_type_tenant, false) = true
  or COALESCE(p.ownership_type_lessee, false) = true
union
select
  lh.id + 100000000::bigint as id,
  lh.rsbsa_submission_id as farmer_id,
  lh.parcel_number,
  lh.farm_location_barangay,
  lh.farm_location_municipality,
  lh.total_farm_area_ha,
  lh.farmer_ffrs_code as ffrs_code,
  lh.farmer_name,
  lh.is_registered_owner,
  lh.is_tenant,
  lh.is_lessee,
  lh.within_ancestral_domain::text as within_ancestral_domain,
  lh.agrarian_reform_beneficiary::text as agrarian_reform_beneficiary,
  lh.change_type,
  lh.change_reason,
  lh.updated_at as last_updated,
  null::text as tenant_land_owner_name,
  null::text as lessee_land_owner_name,
  lh.land_owner_name,
  s_hist.archived_at,
  false as is_current_owner
from
  land_history lh
  left join rsbsa_farm_parcels p on p.id = lh.farm_parcel_id
  join rsbsa_submission s_hist on lh.rsbsa_submission_id = s_hist.id
where
  lh.is_current = true
  and (
    p.id is null
    or COALESCE(p.is_current_owner, false) = false
    and COALESCE(p.ownership_type_tenant, false) = false
    and COALESCE(p.ownership_type_lessee, false) = false
  );