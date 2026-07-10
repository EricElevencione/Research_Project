create or replace view public.farmer_aggregated_unified as
select
  farmer_id,
  max(farmer_name) as farmer_name,
  max(ffrs_code::text) as ffrs_code,
  json_agg(
    json_build_object(
      'id',
      id,
      'land_owner_name',
      land_owner_name,
      'parcel_number',
      parcel_number,
      'farm_location_barangay',
      farm_location_barangay,
      'farm_location_municipality',
      farm_location_municipality,
      'total_farm_area_ha',
      total_farm_area_ha,
      'is_registered_owner',
      is_registered_owner,
      'is_tenant',
      is_tenant,
      'is_lessee',
      is_lessee,
      'tenant_land_owner_name',
      tenant_land_owner_name,
      'lessee_land_owner_name',
      lessee_land_owner_name,
      'is_current_owner',
      is_current_owner
    )
  ) as parcels,
  sum(total_farm_area_ha) as total_farm_area_ha,
  max(last_updated) as last_updated,
  bool_or(is_registered_owner) as has_registered_owner,
  bool_or(is_tenant) as has_tenant,
  bool_or(is_lessee) as has_lessee,
  max(archived_at) as archived_at
from
  unified_parcels
group by
  farmer_id
order by
  (max(farmer_name));
