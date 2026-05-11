const express = require("express");
const router = express.Router();
const { createPool } = require("../config/db.cjs");
const pool = createPool();

// GET /api/reports/landowner-tenant-associations
router.get("/landowner-tenant-associations", async (req, res) => {
  try {
    const { barangay, ownerStatus, tenantStatus, search } = req.query;

    let query = `
      WITH owner_parcels AS (
        -- Parcels where the farmer is the registered owner (owner-cultivated or potentially with tenants)
        SELECT 
          fp.submission_id AS owner_id,
          CONCAT_WS(' ', o."FIRST NAME", o."MIDDLE NAME", o."LAST NAME", o."EXT NAME") AS owner_name,
          o."FFRS_CODE" AS owner_ffrs,
          o."BARANGAY" AS owner_barangay,
          o.archived_at AS owner_archived_at,
          fp.id AS parcel_id,
          fp.parcel_number,
          fp.farm_location_barangay AS parcel_barangay,
          fp.total_farm_area_ha AS parcel_area,
          -- For owner-cultivated parcels
          fp.submission_id AS cultivator_id,
          CONCAT_WS(' ', o."FIRST NAME", o."MIDDLE NAME", o."LAST NAME", o."EXT NAME") AS cultivator_name,
          o."FFRS_CODE" AS cultivator_ffrs,
          'Registered Owner' AS cultivator_type,
          fp.is_cultivating,
          NULL AS unlinked_owner_name
        FROM rsbsa_farm_parcels fp
        JOIN rsbsa_submission o ON fp.submission_id = o.id
        WHERE fp.ownership_type_registered_owner = true

        UNION ALL

        -- Parcels where the farmer is a tenant
        SELECT 
          fp.tenant_land_owner_id AS owner_id,
          CONCAT_WS(' ', t_o."FIRST NAME", t_o."MIDDLE NAME", t_o."LAST NAME", t_o."EXT NAME") AS owner_name,
          t_o."FFRS_CODE" AS owner_ffrs,
          t_o."BARANGAY" AS owner_barangay,
          t_o.archived_at AS owner_archived_at,
          fp.id AS parcel_id,
          fp.parcel_number,
          fp.farm_location_barangay AS parcel_barangay,
          fp.total_farm_area_ha AS parcel_area,
          fp.submission_id AS cultivator_id,
          CONCAT_WS(' ', t_c."FIRST NAME", t_c."MIDDLE NAME", t_c."LAST NAME", t_c."EXT NAME") AS cultivator_name,
          t_c."FFRS_CODE" AS cultivator_ffrs,
          'Tenant' AS cultivator_type,
          fp.is_cultivating,
          fp.tenant_land_owner_name AS unlinked_owner_name
        FROM rsbsa_farm_parcels fp
        JOIN rsbsa_submission t_c ON fp.submission_id = t_c.id
        LEFT JOIN rsbsa_submission t_o ON fp.tenant_land_owner_id = t_o.id
        WHERE fp.ownership_type_tenant = true

        UNION ALL

        -- Parcels where the farmer is a lessee
        SELECT 
          fp.lessee_land_owner_id AS owner_id,
          CONCAT_WS(' ', l_o."FIRST NAME", l_o."MIDDLE NAME", l_o."LAST NAME", l_o."EXT NAME") AS owner_name,
          l_o."FFRS_CODE" AS owner_ffrs,
          l_o."BARANGAY" AS owner_barangay,
          l_o.archived_at AS owner_archived_at,
          fp.id AS parcel_id,
          fp.parcel_number,
          fp.farm_location_barangay AS parcel_barangay,
          fp.total_farm_area_ha AS parcel_area,
          fp.submission_id AS cultivator_id,
          CONCAT_WS(' ', l_c."FIRST NAME", l_c."MIDDLE NAME", l_c."LAST NAME", l_c."EXT NAME") AS cultivator_name,
          l_c."FFRS_CODE" AS cultivator_ffrs,
          'Lessee' AS cultivator_type,
          fp.is_cultivating,
          fp.lessee_land_owner_name AS unlinked_owner_name
        FROM rsbsa_farm_parcels fp
        JOIN rsbsa_submission l_c ON fp.submission_id = l_c.id
        LEFT JOIN rsbsa_submission l_o ON fp.lessee_land_owner_id = l_o.id
        WHERE fp.ownership_type_lessee = true
      )
      SELECT * FROM owner_parcels
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Optional filters can be applied here or processed in JS.
    // For simplicity and grouping, we'll fetch all and group in JS, allowing search/filters there.
    
    const result = await pool.query(query, params);
    let rows = result.rows;

    // Group by owner
    const ownersMap = new Map();
    let unlinkedCounter = -1;

    rows.forEach(row => {
      const isUnlinked = !row.owner_id && row.unlinked_owner_name;
      const effectiveOwnerId = row.owner_id ? row.owner_id.toString() : `unlinked_${row.unlinked_owner_name || unlinkedCounter--}`;
      
      if (!ownersMap.has(effectiveOwnerId)) {
        ownersMap.set(effectiveOwnerId, {
          owner_id: row.owner_id,
          owner_name: row.owner_name || row.unlinked_owner_name || 'Unknown Owner',
          owner_ffrs: row.owner_ffrs || null,
          owner_barangay: row.owner_barangay || null,
          is_active: row.owner_archived_at ? false : true,
          is_unlinked: isUnlinked,
          total_area: 0,
          parcels: [],
          has_tenants: false,
          has_lessees: false
        });
      }

      const owner = ownersMap.get(effectiveOwnerId);
      
      // Check if parcel already added (owner could be registered owner AND someone else tenant, avoid double area)
      const existingParcel = owner.parcels.find(p => p.parcel_id === row.parcel_id);
      
      if (!existingParcel) {
        owner.parcels.push({
          parcel_id: row.parcel_id,
          parcel_number: row.parcel_number,
          parcel_barangay: row.parcel_barangay,
          parcel_area: parseFloat(row.parcel_area) || 0,
          cultivators: []
        });
        owner.total_area += parseFloat(row.parcel_area) || 0;
      }
      
      const parcelToUpdate = owner.parcels.find(p => p.parcel_id === row.parcel_id);
      
      // Add cultivator if not the owner themselves (or if we want to show owner-cultivated)
      if (row.cultivator_type !== 'Registered Owner') {
        parcelToUpdate.cultivators.push({
          cultivator_id: row.cultivator_id,
          cultivator_name: row.cultivator_name,
          cultivator_ffrs: row.cultivator_ffrs,
          type: row.cultivator_type,
          is_active: row.is_cultivating !== false
        });

        if (row.cultivator_type === 'Tenant') owner.has_tenants = true;
        if (row.cultivator_type === 'Lessee') owner.has_lessees = true;
      } else {
        // Owner cultivated
        parcelToUpdate.cultivators.push({
          cultivator_id: row.cultivator_id,
          cultivator_name: row.cultivator_name,
          cultivator_ffrs: row.cultivator_ffrs,
          type: 'Owner-cultivated',
          is_active: row.is_cultivating !== false
        });
      }
    });

    let groupedOwners = Array.from(ownersMap.values());

    // Apply filters
    if (barangay && barangay !== 'all') {
      groupedOwners = groupedOwners.filter(o => 
        (o.owner_barangay && o.owner_barangay.toLowerCase() === barangay.toLowerCase()) ||
        o.parcels.some(p => p.parcel_barangay && p.parcel_barangay.toLowerCase() === barangay.toLowerCase())
      );
    }

    if (ownerStatus && ownerStatus !== 'all') {
      if (ownerStatus === 'active') groupedOwners = groupedOwners.filter(o => o.is_active);
      if (ownerStatus === 'inactive') groupedOwners = groupedOwners.filter(o => !o.is_active);
    }

    if (search) {
      const q = search.toLowerCase();
      groupedOwners = groupedOwners.filter(o => 
        o.owner_name.toLowerCase().includes(q) || 
        (o.owner_ffrs && o.owner_ffrs.toLowerCase().includes(q)) ||
        o.parcels.some(p => p.cultivators.some(c => c.cultivator_name.toLowerCase().includes(q)))
      );
    }

    if (tenantStatus && tenantStatus !== 'all') {
       if (tenantStatus === 'active') {
         groupedOwners = groupedOwners.filter(o => o.parcels.some(p => p.cultivators.some(c => c.type !== 'Owner-cultivated' && c.is_active)));
       } else if (tenantStatus === 'inactive') {
         groupedOwners = groupedOwners.filter(o => o.parcels.some(p => p.cultivators.some(c => c.type !== 'Owner-cultivated' && !c.is_active)));
       }
    }

    // Sort by name
    groupedOwners.sort((a, b) => a.owner_name.localeCompare(b.owner_name));

    // Compute summary stats
    const stats = {
      totalLandowners: groupedOwners.length,
      totalTenants: 0,
      totalLessees: 0,
      totalArea: 0,
      unlinkedOwners: groupedOwners.filter(o => o.is_unlinked).length
    };

    const uniqueTenants = new Set();
    const uniqueLessees = new Set();

    groupedOwners.forEach(o => {
      stats.totalArea += o.total_area;
      o.parcels.forEach(p => {
        p.cultivators.forEach(c => {
          if (c.type === 'Tenant') uniqueTenants.add(c.cultivator_id);
          if (c.type === 'Lessee') uniqueLessees.add(c.cultivator_id);
        });
      });
    });

    stats.totalTenants = uniqueTenants.size;
    stats.totalLessees = uniqueLessees.size;

    res.json({
      success: true,
      stats,
      data: groupedOwners
    });
  } catch (error) {
    console.error("Error fetching landowner-tenant associations:", error);
    res.status(500).json({ error: "Failed to fetch report data" });
  }
});

module.exports = router;
