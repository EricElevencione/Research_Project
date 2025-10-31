# 🔧 Land History Troubleshooting Guide

## ❌ Problem: Farm Parcels Not Creating Land History Automatically

### **Root Cause Found:**

Your RSBSA submission endpoint was inserting farm parcels into the **wrong table name**, so the database triggers never fired!

---

## 🔍 The Issue Explained

### **What Was Happening:**

```javascript
// ❌ BEFORE (BROKEN):
INSERT INTO farm_parcels (...)  // Wrong table name!
```

```sql
-- Your trigger was set up for:
CREATE TRIGGER trigger_create_land_history_on_parcel_insert
    AFTER INSERT ON rsbsa_farm_parcels  -- Correct table name
```

**Result:** Trigger never fires because table names don't match! ❌

### **Table Name Mismatch:**

| Your Code Inserted Into | Trigger Monitored |
|--------------------------|-------------------|
| `farm_parcels` ❌ | `rsbsa_farm_parcels` ✅ |
| **No Match = No Trigger!** | **Trigger Never Fires!** |

---

## ✅ The Fix Applied

### **Changes Made to `server.cjs`:**

#### **1. Fixed Table Name**

```javascript
// ✅ AFTER (FIXED):
INSERT INTO rsbsa_farm_parcels (...)  // Correct table name!
```

#### **2. Fixed Data Type Issues**

**Before:**
```javascript
parcel.withinAncestralDomain === 'Yes' || false,  // ❌ Returns boolean
parcel.agrarianReformBeneficiary === 'Yes' || false,  // ❌ Returns boolean
```

**After:**
```javascript
parcel.withinAncestralDomain === 'Yes' ? 'Yes' : 'No',  // ✅ Returns 'Yes'/'No' string
parcel.agrarianReformBeneficiary === 'Yes' ? 'Yes' : 'No',  // ✅ Returns 'Yes'/'No' string
```

**Why?** The `rsbsa_farm_parcels` table expects VARCHAR with CHECK constraint:
```sql
within_ancestral_domain VARCHAR(10) CHECK (within_ancestral_domain IN ('Yes', 'No'))
```

---

## 🧪 How to Test If It's Working Now

### **Step 1: Ensure Database is Set Up**

First, make sure you've run these scripts:

```sql
-- 1. Create the land_history table and triggers
\i c:/Users/dblaz/Research-Project/database/land_history_improved.sql

-- 2. Check that triggers exist
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'rsbsa_farm_parcels';
```

**Expected Output:**
```
trigger_name                                    | event_manipulation | event_object_table
------------------------------------------------|--------------------|-----------------
trigger_create_land_history_on_parcel_insert   | INSERT             | rsbsa_farm_parcels
trigger_update_land_history_on_parcel_update   | UPDATE             | rsbsa_farm_parcels
```

### **Step 2: Restart Your Server**

```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd backend
node server.cjs
```

You should see:
```
Backend server listening on port 5000
✅ All API endpoints registered successfully
✅ Land History API endpoints are active
✅ Land History API endpoints loaded successfully
```

### **Step 3: Submit a Test Farmer**

Use your frontend to submit a new RSBSA form with farm parcels.

### **Step 4: Verify Land History Was Created**

Run this query in your database:

```sql
-- Check if land_history records were created
SELECT 
    lh.id,
    lh.farm_parcel_id,
    lh.parcel_number,
    lh.land_owner_name,
    lh.farmer_name,
    lh.is_current,
    lh.change_type,
    lh.created_at
FROM land_history lh
ORDER BY lh.created_at DESC
LIMIT 5;
```

**Expected Result:**
- You should see NEW records with `change_type = 'NEW'`
- `is_current = TRUE`
- `farmer_name` populated
- `created_at` matches when you submitted the form

### **Step 5: Verify the Connection**

```sql
-- Check that farm parcels and land_history are linked
SELECT 
    fp.id as parcel_id,
    fp.parcel_number,
    fp.farm_location_barangay,
    lh.id as history_id,
    lh.farmer_name,
    lh.is_current
FROM rsbsa_farm_parcels fp
LEFT JOIN land_history lh ON fp.id = lh.farm_parcel_id
WHERE lh.is_current = TRUE
ORDER BY fp.created_at DESC
LIMIT 5;
```

**Expected Result:**
- Every `rsbsa_farm_parcels` record should have a matching `land_history` record
- No NULL values in `history_id` column

---

## 🐛 Common Issues and Solutions

### **Issue 1: Still No Land History Created**

**Check:**
```sql
-- Are triggers enabled?
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'rsbsa_farm_parcels'::regclass;
```

**Solution:**
```sql
-- Enable triggers if disabled
ALTER TABLE rsbsa_farm_parcels ENABLE TRIGGER ALL;
```

---

### **Issue 2: Error "relation 'land_history' does not exist"**

**Problem:** You haven't created the `land_history` table yet.

**Solution:**
```sql
\i c:/Users/dblaz/Research-Project/database/land_history_improved.sql
```

---

### **Issue 3: Error "function create_land_history_from_farm_parcel does not exist"**

**Problem:** Trigger function wasn't created.

**Solution:** Re-run the setup script:
```sql
DROP TRIGGER IF EXISTS trigger_create_land_history_on_parcel_insert ON rsbsa_farm_parcels;
DROP FUNCTION IF EXISTS create_land_history_from_farm_parcel();

\i c:/Users/dblaz/Research-Project/database/land_history_improved.sql
```

---

### **Issue 4: Parcels Created But Wrong Table**

**Problem:** Old code might have created records in `farm_parcels` table.

**Check:**
```sql
-- Check if you have both tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('farm_parcels', 'rsbsa_farm_parcels');
```

**Solution:** Migrate data from old table to new:
```sql
-- Copy data from farm_parcels to rsbsa_farm_parcels
INSERT INTO rsbsa_farm_parcels (
    submission_id, parcel_number, farm_location_barangay, 
    farm_location_municipality, total_farm_area_ha, ...
)
SELECT 
    submission_id, parcel_number, farm_location_barangay,
    farm_location_municipality, total_farm_area_ha, ...
FROM farm_parcels
WHERE NOT EXISTS (
    SELECT 1 FROM rsbsa_farm_parcels rfp 
    WHERE rfp.submission_id = farm_parcels.submission_id
);

-- Then run the land history migration
\i c:/Users/dblaz/Research-Project/database/migrate_land_history.sql
```

---

### **Issue 5: "Invalid input value for enum" Error**

**Problem:** Boolean values being passed instead of 'Yes'/'No' strings.

**Solution:** Already fixed in the code! Make sure you have the latest version:
```javascript
parcel.withinAncestralDomain === 'Yes' ? 'Yes' : 'No',  // ✅ Correct
```

---

## 📊 Debugging Checklist

Run through this checklist to diagnose issues:

- [ ] ✅ `land_history` table exists
  ```sql
  SELECT COUNT(*) FROM land_history;
  ```

- [ ] ✅ `rsbsa_farm_parcels` table exists
  ```sql
  SELECT COUNT(*) FROM rsbsa_farm_parcels;
  ```

- [ ] ✅ Triggers are enabled
  ```sql
  SELECT trigger_name FROM information_schema.triggers 
  WHERE event_object_table = 'rsbsa_farm_parcels';
  ```

- [ ] ✅ Trigger functions exist
  ```sql
  SELECT routine_name FROM information_schema.routines 
  WHERE routine_name LIKE '%land_history%';
  ```

- [ ] ✅ Server.cjs uses correct table name
  ```javascript
  // Should say "rsbsa_farm_parcels" not "farm_parcels"
  INSERT INTO rsbsa_farm_parcels (...)
  ```

- [ ] ✅ Server is restarted after code changes
  ```bash
  node server.cjs
  ```

- [ ] ✅ Test submission created records
  ```sql
  SELECT * FROM rsbsa_farm_parcels ORDER BY created_at DESC LIMIT 1;
  SELECT * FROM land_history ORDER BY created_at DESC LIMIT 1;
  ```

---

## 🎯 Expected Behavior After Fix

### **When You Submit an RSBSA Form:**

1. ✅ Record created in `rsbsa_submission` table
2. ✅ Record(s) created in `rsbsa_farm_parcels` table
3. ✅ **Trigger fires automatically**
4. ✅ Record(s) created in `land_history` table
5. ✅ All happens in one transaction (no manual steps!)

### **What You Should See in land_history:**

```sql
SELECT * FROM land_history WHERE is_current = TRUE LIMIT 1;
```

**Result:**
```
id: 1
farm_parcel_id: 123
farmer_name: "Juan Dela Cruz"
land_owner_name: "Juan Dela Cruz" (if owner) or "Maria Garcia" (if tenant)
is_tenant: TRUE (if renting) or FALSE (if owner)
is_registered_owner: TRUE (if owner) or FALSE (if tenant/lessee)
is_current: TRUE
change_type: 'NEW'
created_at: [timestamp when form was submitted]
```

---

## 🚀 Testing Workflow

### **Complete Test Process:**

1. **Setup Database:**
   ```sql
   \i database/land_history_improved.sql
   ```

2. **Restart Server:**
   ```bash
   cd backend
   node server.cjs
   ```

3. **Submit Test Form via Frontend:**
   - Fill out RSBSA form
   - Add at least one farm parcel
   - Select ownership type (Owner/Tenant/Lessee)
   - Submit

4. **Verify in Database:**
   ```sql
   -- Check submission
   SELECT * FROM rsbsa_submission ORDER BY id DESC LIMIT 1;
   
   -- Check parcel (should exist now)
   SELECT * FROM rsbsa_farm_parcels ORDER BY id DESC LIMIT 1;
   
   -- Check land history (should be auto-created!)
   SELECT * FROM land_history ORDER BY id DESC LIMIT 1;
   ```

5. **Success Criteria:**
   - ✅ All 3 tables have matching records
   - ✅ `land_history.farm_parcel_id` matches `rsbsa_farm_parcels.id`
   - ✅ `land_history.is_current = TRUE`
   - ✅ `land_history.change_type = 'NEW'`

---

## 📞 Still Having Issues?

If land history is still not being created automatically:

1. **Check server logs** for error messages
2. **Check PostgreSQL logs** for trigger errors
3. **Verify data types** match between code and database
4. **Run the quality check endpoint:**
   ```bash
   curl http://localhost:5000/api/land-history/quality-check
   ```

---

## 📝 Summary of Fixes

### **Changes Made:**

1. ✅ Changed `INSERT INTO farm_parcels` → `INSERT INTO rsbsa_farm_parcels`
2. ✅ Fixed boolean → string conversion for `within_ancestral_domain`
3. ✅ Fixed boolean → string conversion for `agrarian_reform_beneficiary`
4. ✅ Ensured server.cjs endpoints are in correct order
5. ✅ Added validation messages to server logs

### **What Should Work Now:**

- ✅ RSBSA form submission inserts into correct table
- ✅ Database triggers fire automatically
- ✅ Land history records created without manual intervention
- ✅ Complete audit trail maintained

---

**Last Updated:** October 21, 2025  
**Status:** ✅ **FIXED - Ready for Testing**
