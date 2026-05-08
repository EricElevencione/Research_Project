create view public.v_tenant_lessee_relationships as
select
  fp.id as parcel_id,
  fp.submission_id as farmer_id,
  concat_ws(
    ' '::text,
    farmer."FIRST NAME",
    farmer."MIDDLE NAME",
    farmer."LAST NAME"
  ) as farmer_name,
  farmer."BARANGAY" as farmer_barangay,
  case
    when fp.ownership_type_tenant then 'Tenant'::text
    when fp.ownership_type_lessee then 'Lessee'::text
    when fp.ownership_type_registered_owner then 'Registered Owner'::text
    else 'Other'::text
  end as ownership_type,
  fp.tenant_land_owner_id,
  fp.tenant_land_owner_name as tenant_land_owner_name_text,
  concat_ws(
    ' '::text,
    tenant_owner."FIRST NAME",
    tenant_owner."MIDDLE NAME",
    tenant_owner."LAST NAME"
  ) as tenant_land_owner_name_linked,
  fp.lessee_land_owner_id,
  fp.lessee_land_owner_name as lessee_land_owner_name_text,
  concat_ws(
    ' '::text,
    lessee_owner."FIRST NAME",
    lessee_owner."MIDDLE NAME",
    lessee_owner."LAST NAME"
  ) as lessee_land_owner_name_linked,
  fp.farm_location_barangay,
  fp.total_farm_area_ha
from
  rsbsa_farm_parcels fp
  join rsbsa_submission farmer on fp.submission_id = farmer.id
  left join rsbsa_submission tenant_owner on fp.tenant_land_owner_id = tenant_owner.id
  left join rsbsa_submission lessee_owner on fp.lessee_land_owner_id = lessee_owner.id
where
  fp.ownership_type_tenant = true
  or fp.ownership_type_lessee = true;