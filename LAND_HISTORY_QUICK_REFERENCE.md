# Land History System - Quick Reference Card

## 📊 Table Structure

```
land_history
├── id (Primary Key)
├── Links
│   ├── rsbsa_submission_id → rsbsa_submission(id)
│   ├── farm_parcel_id → rsbsa_farm_parcels(id)
│   └── previous_record_id → land_history(id)
├── Parcel Info
│   ├── parcel_number
│   ├── farm_location_barangay
│   ├── farm_location_municipality
│   └── total_farm_area_ha
├── Ownership
│   ├── land_owner_name (Legal owner)
│   ├── farmer_name (Person farming)
│   ├── is_registered_owner
│   ├── is_tenant
│   └── is_lessee
├── Time Tracking
│   ├── period_start_date
│   ├── period_end_date (NULL = current)
│   └── is_current (TRUE/FALSE)
└── Audit Trail
    ├── change_type
    ├── created_at
    └── created_by
```

## 🚀 Quick Start Commands

### Installation
```sql
-- 1. Create table and triggers
\i database/land_history_improved.sql

-- 2. Migrate existing data
\i database/migrate_land_history.sql

-- 3. Verify
SELECT COUNT(*) FROM land_history WHERE is_current = TRUE;
```

### Common Queries

#### Get current owner of a parcel
```sql
SELECT land_owner_name, farmer_name, 
       CASE WHEN is_registered_owner THEN 'Owner'
            WHEN is_tenant THEN 'Tenant'
            WHEN is_lessee THEN 'Lessee'
       END as status
FROM land_history
WHERE farm_parcel_id = ? AND is_current = TRUE;
```

#### Get tenant history for dropdown
```sql
SELECT farmer_name, period_start_date, period_end_date,
       is_current
FROM land_history
WHERE farm_parcel_id = ?
  AND (is_tenant = TRUE OR is_lessee = TRUE)
ORDER BY is_current DESC, period_start_date DESC;
```

#### Get all lands owned by person
```sql
SELECT parcel_number, farm_location_barangay, 
       total_farm_area_ha
FROM land_history
WHERE land_owner_name ILIKE '%?%'
  AND is_current = TRUE;
```

## 🔄 Automatic Triggers

### Trigger 1: New Farm Parcel
```
INSERT into rsbsa_farm_parcels
    ↓
Trigger: create_land_history_from_farm_parcel()
    ↓
Creates land_history record
    - change_type = 'NEW'
    - is_current = TRUE
```

### Trigger 2: Ownership Change
```
UPDATE rsbsa_farm_parcels (ownership change)
    ↓
Trigger: update_land_history_from_farm_parcel()
    ↓
1. Old record: is_current = FALSE, period_end_date = TODAY
2. New record: change_type = 'OWNERSHIP_CHANGE', is_current = TRUE
```

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/land-history/parcel/:id/current` | GET | Current ownership |
| `/api/land-history/parcel/:id/history` | GET | Complete history |
| `/api/land-history/parcel/:id/tenants` | GET | Tenant dropdown data |
| `/api/land-history/owner/:name` | GET | All lands by owner |
| `/api/land-history/owners` | GET | List all owners |

## 📱 React Component Pattern

```typescript
// Fetch current ownership
const [owner, setOwner] = useState(null);

useEffect(() => {
    fetch(`/api/land-history/parcel/${parcelId}/current`)
        .then(res => res.json())
        .then(data => setOwner(data));
}, [parcelId]);

// Display
<div>
    <h3>Land Owner: {owner?.land_owner_name}</h3>
    <p>Current Farmer: {owner?.farmer_name}</p>
    <p>Status: {owner?.ownership_status}</p>
</div>
```

## ⚠️ Important Flags

| Flag | Meaning |
|------|---------|
| `is_current = TRUE` | Active/current record |
| `is_current = FALSE` | Historical/past record |
| `period_end_date = NULL` | Still active |
| `period_end_date != NULL` | Ended on that date |

## 🎯 Best Practices

✅ **DO:**
- Always query with `is_current = TRUE` for current data
- Use the automatic triggers (don't manually insert)
- Link to farm_parcel_id, not parcel_number

❌ **DON'T:**
- Don't manually insert into land_history
- Don't delete old records (they're history!)
- Don't have multiple `is_current = TRUE` for same parcel

## 🔍 Data Validation Queries

### Check for issues
```sql
-- Find parcels with no current history
SELECT fp.id, fp.parcel_number
FROM rsbsa_farm_parcels fp
LEFT JOIN land_history lh ON fp.id = lh.farm_parcel_id AND lh.is_current = TRUE
WHERE lh.id IS NULL;

-- Find parcels with multiple current records (ERROR!)
SELECT farm_parcel_id, COUNT(*)
FROM land_history
WHERE is_current = TRUE
GROUP BY farm_parcel_id
HAVING COUNT(*) > 1;
```

## 📈 Performance Tips

- Use indexes on: `farm_parcel_id`, `is_current`, `land_owner_name`
- Filter by `is_current` first in WHERE clause
- Use `EXPLAIN ANALYZE` for slow queries
- Run `VACUUM ANALYZE land_history` weekly

## 🛠️ Troubleshooting

### No automatic history created?
```sql
-- Check triggers
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'rsbsa_farm_parcels';

-- Re-enable if needed
ALTER TABLE rsbsa_farm_parcels 
ENABLE TRIGGER trigger_create_land_history_on_parcel_insert;
```

### Wrong data in history?
```sql
-- Update a specific record (careful!)
UPDATE land_history 
SET farmer_name = 'Correct Name'
WHERE id = ?;
```

## 📞 Common Scenarios

### Scenario 1: Tenant becomes owner
```sql
-- Just update the farm parcel
UPDATE rsbsa_farm_parcels 
SET ownership_type_tenant = FALSE,
    ownership_type_registered_owner = TRUE
WHERE id = ?;
-- Trigger automatically handles the rest!
```

### Scenario 2: New tenant for existing land
```sql
-- Update with new tenant info
UPDATE rsbsa_farm_parcels 
SET ownership_type_tenant = TRUE,
    tenant_land_owner_name = 'Previous Owner Name'
WHERE id = ?;
-- History automatically updated!
```

### Scenario 3: Query 10-year history
```sql
SELECT * FROM land_history
WHERE farm_parcel_id = ?
  AND period_start_date >= CURRENT_DATE - INTERVAL '10 years'
ORDER BY period_start_date DESC;
```

---

**Version:** 1.0  
**Last Updated:** October 20, 2025  
**Database:** PostgreSQL 17.4+  
**For Full Documentation:** See `LAND_HISTORY_IMPLEMENTATION_GUIDE.md`
