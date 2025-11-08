# FFRS System Re-Implementation Guide

## Overview
This guide will help you re-implement the FFRS (Farmers and Fisherfolk Registry System) ID generation system that generates unique identifiers in the format: **`06-30-18-012-000147`**

### ID Format Structure:
- **06** = Region (Western Visayas - fixed)
- **30** = Province (Iloilo - fixed)
- **18** = Municipality (Dumangas - fixed)
- **012** = Barangay code (3 digits, variable by barangay)
- **000147** = Sequential farmer number within barangay (6 digits, auto-incremented)

---

## Step-by-Step Implementation

### Step 1: Run the Database Setup Script

Execute the SQL script to set up the FFRS system:

```bash
# Connect to your PostgreSQL database
psql -U your_username -d your_database_name -f database/update_ffrs_system.sql
```

Or run it directly in your database client (e.g., pgAdmin, DBeaver).

**What this script does:**
1. ✅ Creates/updates the `generate_ffrs_code()` function with correct Dumangas barangay codes
2. ✅ Creates the `ffrs_counter` table to track sequential numbers per barangay
3. ✅ Adds trigger to auto-generate FFRS codes for new farmer registrations
4. ✅ Regenerates FFRS codes for all existing records in chronological order
5. ✅ Ensures uniqueness and proper sequencing

### Step 2: Verify Database Setup

Check that the FFRS codes were generated correctly:

```sql
-- View sample FFRS codes
SELECT id, "BARANGAY", "FFRS_CODE", "FIRST NAME", "LAST NAME"
FROM rsbsa_submission
WHERE "FFRS_CODE" IS NOT NULL
ORDER BY "FFRS_CODE"
LIMIT 20;

-- Count farmers per barangay
SELECT 
    "BARANGAY",
    COUNT(*) as total_farmers,
    MIN("FFRS_CODE") as first_code,
    MAX("FFRS_CODE") as last_code
FROM rsbsa_submission
WHERE "FFRS_CODE" IS NOT NULL
GROUP BY "BARANGAY"
ORDER BY "BARANGAY";

-- View the counter table
SELECT * FROM ffrs_counter ORDER BY barangay_code;
```

### Step 3: Backend Integration (Already Updated)

The backend has been updated to:
- ✅ Include `FFRS_CODE` in the API query
- ✅ Return FFRS code as `referenceNumber` in the API response
- ✅ Fallback to `RSBSA-{id}` format if FFRS code is missing

**File modified:** `backend/server.cjs`

### Step 4: Frontend Integration (Already Updated)

The frontend TechMasterlist component already:
- ✅ Displays FFRS code in the "FFRS System Generated" column
- ✅ Uses FFRS code in print reports
- ✅ Includes FFRS code in filtered exports

**File checked:** `src/screens/technicians/TechMasterlist.tsx`

### Step 5: Test the System

#### Test 1: View Existing Records
1. Navigate to the Technician Masterlist page
2. Verify that all farmers have FFRS codes in the format `06-30-18-XXX-YYYYYY`
3. Check that farmers from the same barangay have sequential numbers

#### Test 2: Create New Farmer
1. Go to RSBSA form submission page
2. Fill out the form with a new farmer
3. Submit the form
4. Check the database to verify the FFRS code was auto-generated
5. Verify the code appears in the masterlist

#### Test 3: Print Functionality
1. Go to Technician Masterlist
2. Click "Print Active Farmers"
3. Select a filter (e.g., by barangay)
4. Verify FFRS codes appear in the printed report

---

## Barangay Codes Reference

| Barangay | Code | Barangay | Code |
|----------|------|----------|------|
| Balabag | 001 | Ilaya 1st | 013 |
| Bantud Fabrica | 002 | Ilaya 2nd | 014 |
| Bantud Ilaud | 003 | Jardin | 015 |
| Bantud Ilaya | 004 | Lonoy | 016 |
| Bilao | 005 | Manggalag | 017 |
| Bolilao | 006 | Mauguic | 018 |
| Calao | 007 | Pandan | 019 |
| Capaliz | 008 | Poblacion | 020 |
| Cayos | 009 | Sapao | 021 |
| Dacutan | 010 | Sua | 022 |
| Dulangan | 011 | Suguidan | 023 |
| Dungon | 012 | Tabucan | 024 |
| Talusan | 025 | Tigbawan | 026 |
| Tuburan | 027 | Tumcon Ilaya | 028 |
| Tumcon Ilawod | 029 | | |

---

## Example FFRS Codes

- **First farmer in Calao:** `06-30-18-007-000001`
- **Second farmer in Calao:** `06-30-18-007-000002`
- **First farmer in Poblacion:** `06-30-18-020-000001`
- **100th farmer in Sapao:** `06-30-18-021-000100`

---

## How It Works

### For New Farmers:
1. Farmer submits RSBSA form
2. Database trigger activates on INSERT
3. System extracts barangay name from form data
4. Looks up barangay code (e.g., "Calao" → "007")
5. Increments counter for that barangay in `ffrs_counter` table
6. Generates FFRS code: `06-30-18-007-000023`
7. Saves code to `FFRS_CODE` column

### For Existing Farmers:
1. Migration script processes all records ordered by `created_at` (oldest first)
2. Resets all counters to zero
3. Generates codes sequentially for each barangay
4. First registered farmer in each barangay gets number 000001
5. Ensures historical registration order is preserved

---

## Troubleshooting

### Issue: "Column FFRS_CODE does not exist"

**Solution:**
```sql
ALTER TABLE rsbsa_submission
ADD COLUMN IF NOT EXISTS "FFRS_CODE" VARCHAR(50) UNIQUE;
```

### Issue: "FFRS codes are not generating for new farmers"

**Solution:**
Check if the trigger is installed:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_generate_ffrs_code';
```

If missing, recreate it by running the update script again.

### Issue: "Duplicate FFRS codes"

**Solution:**
Reset the counters and regenerate:
```sql
SELECT update_all_ffrs_codes();
```

### Issue: "FFRS codes don't appear in masterlist"

**Solution:**
1. Check backend is returning FFRS_CODE in API:
   ```
   http://localhost:5000/api/rsbsa_submission
   ```
2. Verify the column exists in database
3. Restart the backend server

### Issue: "Wrong barangay codes"

**Solution:**
The barangay name must match exactly. Check for:
- Extra spaces
- Spelling differences
- Case sensitivity (the function uses LOWER() to handle this)

Update the mapping in the SQL function if needed.

---

## Benefits of This System

✅ **Unique Identification** - Each farmer has a globally unique, traceable ID  
✅ **Geographic Tracking** - Easy to identify municipality and barangay from ID  
✅ **Sequential Ordering** - Maintains registration order within each barangay  
✅ **Scalable** - Supports up to 999,999 farmers per barangay  
✅ **Government Standard** - Follows FFRS standard format  
✅ **Automatic** - No manual intervention needed for new registrations  
✅ **Historical Integrity** - Preserves registration sequence for existing records  

---

## Database Schema Changes

### New Tables:
- `ffrs_counter` - Tracks the next sequential number for each barangay

### New Columns:
- `rsbsa_submission.FFRS_CODE` - Stores the unique FFRS identifier

### New Functions:
- `generate_ffrs_code(barangay_name)` - Generates a new FFRS code
- `update_all_ffrs_codes()` - Batch regeneration for existing records
- `generate_ffrs_code_trigger()` - Auto-generates code on INSERT

### New Triggers:
- `trigger_generate_ffrs_code` - Fires before INSERT on rsbsa_submission

---

## Files Modified/Created

1. **database/update_ffrs_system.sql** - Complete FFRS setup script (NEW)
2. **backend/server.cjs** - Updated to include FFRS_CODE in API response (MODIFIED)
3. **src/screens/technicians/TechMasterlist.tsx** - Already displays FFRS codes (NO CHANGE NEEDED)
4. **FFRS_REIMPLEMENTATION_GUIDE.md** - This guide (NEW)

---

## Next Steps

After implementing the FFRS system:

1. ✅ **Test thoroughly** with new farmer registrations
2. ✅ **Verify** all existing records have FFRS codes
3. ✅ **Update other pages** that display farmer information to show FFRS codes
4. ✅ **Add FFRS code search** functionality to find farmers by their code
5. ✅ **Include FFRS codes** in all reports and exports
6. ✅ **Document** for your team how to use the FFRS codes

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify database connection and permissions
3. Review PostgreSQL logs for errors
4. Ensure all SQL functions are created successfully
5. Check that the trigger is active

---

## Summary

The FFRS system is now fully re-implemented and will:
- ✅ Auto-generate unique codes for all new farmers
- ✅ Maintain sequential numbering per barangay
- ✅ Display codes in the masterlist
- ✅ Include codes in printed reports
- ✅ Preserve historical registration order

**You're all set! The FFRS system is ready to use.** 🎉
