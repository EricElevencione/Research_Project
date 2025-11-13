# 🐘 pgAdmin Database Cleanup Guide

## Quick Steps for pgAdmin Users

### 🎯 To Delete All Farmer Data (Keep Users):

1. **Open pgAdmin**
2. **Connect to `Masterlist` database**
   - Expand Servers → PostgreSQL 17 → Databases → Masterlist
3. **Click "Query Tool"** (thunder bolt icon ⚡)
4. **Open the script:**
   - File → Open → Browse to `database/pgadmin_cleanup_farmers.sql`
   - OR just copy-paste the script content
5. **Click Execute** (▶️ play button) or press `F5`
6. **Review the results** in the output pane
7. **Done!** ✅

---

## 📊 What You'll See in Output:

### Before Cleanup:
```
status: BEFORE CLEANUP
farmers: 150
parcels: 300
history_records: 450
transfers: 5
users_kept: 3
barangay_codes_kept: 26
```

### After Cleanup:
```
status: ✅ CLEANUP COMPLETE!
farmers_remaining: 0
parcels_remaining: 0
history_remaining: 0
users_preserved: 3
barangay_codes_preserved: 26
```

### Preserved Users:
```
username    | role       | email
------------|------------|-------------------
admin       | admin      | admin@example.com
technician1 | technician | tech@example.com
jo_user     | jo         | jo@example.com
```

---

## 📁 Scripts for pgAdmin:

### ✅ **pgadmin_cleanup_farmers.sql** (RECOMMENDED)
- **Purpose:** Delete all farmer data, keep users
- **Execution:** Direct - No rollback needed
- **Safe:** Yes - Won't delete users or barangay codes

### ⚡ **quick_delete_farmers.sql** (ALTERNATIVE)
- **Purpose:** Same as above, but uses TRUNCATE (faster)
- **Execution:** Direct - Instant deletion
- **Safe:** Yes - Same as above

### 🗑️ Files You DON'T Need:
- ❌ `run_cleanup.ps1` - Only for command-line users
- ❌ `cleanup_farmer_data_only.sql` - Has ROLLBACK/COMMIT complexity
- ❌ `cleanup_all_data.sql` - Has ROLLBACK/COMMIT complexity

---

## 🎬 Video-Like Steps:

```
Step 1: Open pgAdmin
│
├─ Step 2: Connect to "Masterlist" database
│
├─ Step 3: Click Query Tool (⚡ icon)
│
├─ Step 4: File → Open → Select "pgadmin_cleanup_farmers.sql"
│
├─ Step 5: Click Execute button (▶️) or press F5
│
├─ Step 6: Wait 2-3 seconds
│
└─ Step 7: See "✅ CLEANUP COMPLETE!" in results
```

---

## ✅ Verification Queries

After cleanup, run these to verify:

```sql
-- Should all return 0
SELECT COUNT(*) as farmers FROM rsbsa_submission;
SELECT COUNT(*) as parcels FROM rsbsa_farm_parcels;
SELECT COUNT(*) as history FROM land_history;

-- Should NOT be 0
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as barangay_codes FROM barangay_codes;

-- Check your user accounts are still there
SELECT username, role FROM users;
```

---

## 🆘 Troubleshooting

### Error: "relation does not exist"
**Cause:** Table doesn't exist in your database
**Solution:** The script will skip that table automatically

### Error: "permission denied"
**Cause:** Not logged in as postgres user
**Solution:** 
1. Right-click database → Properties
2. Check if you're connected as `postgres`
3. Reconnect with postgres credentials

### Script runs but no output
**Cause:** Output pane might be hidden
**Solution:** 
1. Look at bottom of pgAdmin window
2. Click "Data Output" tab
3. Should see query results there

---

## 🎯 After Cleanup - Next Steps

1. ✅ Start fresh farmer registration
2. ✅ Implement Fertilizer Demand Estimation API
3. ✅ Create frontend pages
4. ✅ Add distribution tracking
5. ✅ Begin data collection

---

## 🔄 If You Need to Undo (Restore)

**Option 1: Restore from backup**
```sql
-- If you made a backup before cleanup:
-- File → Restore → Select your backup file
```

**Option 2: Re-import data**
- If you have the original CSV/Excel files
- Use the import wizard in pgAdmin

**Option 3: Fresh database**
- Drop and recreate database
- Run Masterlist3.sql to rebuild everything

---

## 📝 Summary

**For pgAdmin users like you:**
- ✅ Use: `pgadmin_cleanup_farmers.sql`
- ❌ Ignore: `run_cleanup.ps1` (for command-line users)
- ⚡ Click Execute and done!
- 🎉 No complex ROLLBACK/COMMIT steps needed!

---

**Ready to clean your database? Just open pgAdmin and follow the steps above!** 😊
