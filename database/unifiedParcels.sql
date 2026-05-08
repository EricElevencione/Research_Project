create view public.unified_parcels as
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
  GREATEST(p.updated_at, lh.updated_at) as last_updated
from
  rsbsa_farm_parcels p
  left join rsbsa_submission s on p.submission_id = s.id
  left join land_history lh on (
    lh.farm_parcel_id = p.id
    or lh.land_parcel_id = p.id
  )
  and lh.is_current = true
where
  COALESCE(p.is_current_owner, false) = true
  or COALESCE(p.ownership_type_tenant, false) = true
  or COALESCE(p.ownership_type_lessee, false) = true
union
select
  lh.id,
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
  lh.updated_at as last_updated
from
  land_history lh
  left join rsbsa_farm_parcels p on p.id = lh.farm_parcel_id
  or p.id = lh.land_parcel_id
where
  lh.is_current = true
  and (
    p.id is null
    or COALESCE(p.is_current_owner, false) = false
    and COALESCE(p.ownership_type_tenant, false) = false
    and COALESCE(p.ownership_type_lessee, false) = false
  );