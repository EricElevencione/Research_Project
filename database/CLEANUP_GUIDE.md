# 🗑️ Database Cleanup Guide

## Overview

This guide helps you clean up your database to start fresh with new data while preserving important configurations.

---

## 📁 Cleanup Scripts Created

### 1. **cleanup_farmer_data_only.sql** (RECOMMENDED ✅)
- **Deletes:** All farmer records, parcels, history, transfers, incentive logs
- **Keeps:** User accounts, barangay codes, database structure
- **Safe Mode:** Runs in transaction, requires manual commit

**Use this when:** You want to delete test data but keep your user accounts and system configuration.

---

### 2. **cleanup_all_data.sql** (DANGER ⚠️)
- **Deletes:** EVERYTHING including users and all data
- **Keeps:** Only database structure (tables, functions, triggers)
- **Safe Mode:** Runs in transaction, requires manual commit

**Use this when:** You want a completely fresh start (rarely needed).

---

### 3. **quick_delete_farmers.sql** (FAST ⚡)
- **Deletes:** All farmer data immediately (no safety checks)
- **Keeps:** User accounts, barangay codes
- **No Rollback:** Changes are permanent immediately

**Use this when:** You're confident and want quick deletion.

---

## 🚀 How to Run Cleanup

### Method 1: pgAdmin (EASIEST - RECOMMENDED ✅)

**Use this file: `pgadmin_cleanup_farmers.sql`**

1. Open **pgAdmin**
2. Connect to your `Masterlist` database
3. Click **Query Tool** (⚡ thunder icon)
4. Open file: `database/pgadmin_cleanup_farmers.sql`
5. Click **Execute** (▶️ button)
6. Done! Check the output to verify deletion

**That's it!** No ROLLBACK/COMMIT steps needed.

---

### Method 2: Alternative pgAdmin Files

If you want faster deletion using TRUNCATE:
- Use: `database/quick_delete_farmers.sql`
- Same steps as Method 1

---

### Method 3: PowerShell Script (For Command-Line Users)

```powershell
# Navigate to project directory
cd C:\Users\dblaz\Research-Project

# Run cleanup script
psql -U postgres -d Masterlist -f database\cleanup_farmer_data_only.sql

# If you see "TRANSACTION ROLLED BACK", edit the file to commit:
# 1. Open database\cleanup_farmer_data_only.sql
# 2. Comment out ROLLBACK
# 3. Uncomment COMMIT
# 4. Run the command again
```

---

### Method 4: Quick Delete (No Safety Checks)

**⚠️ WARNING: This deletes immediately without confirmation!**

```powershell
psql -U postgres -d Masterlist -f database\quick_delete_farmers.sql
```

---

## 📊 What Gets Deleted

### Safe Cleanup (`cleanup_farmer_data_only.sql`):

| Table | Deleted? | Notes |
|-------|----------|-------|
| `rsbsa_submission` | ✅ Yes | All farmer records |
| `rsbsa_farm_parcels` | ✅ Yes | All farm parcels |
| `masterlist` | ✅ Yes | All masterlist entries |
| `rsbsaform` | ✅ Yes | All RSBSA forms |
| `land_history` | ✅ Yes | All land ownership history |
| `ownership_transfers` | ✅ Yes | All transfer records |
| `incentive_distribution_log` | ✅ Yes | All incentive logs |
| `farm_parcels` | ✅ Yes | Old farm parcels table |
| `barangay_farmer_counters` | ✅ Yes | Reset to 0 |
| **`users`** | ❌ **NO** | **User accounts preserved** |
| **`barangay_codes`** | ❌ **NO** | **Barangay codes preserved** |

---

## 🔄 ID Sequences Reset

After cleanup, all ID sequences restart from 1:
- Next farmer ID: `1`
- Next parcel ID: `1`
- Next transfer ID: `1`
- etc.

This means your first new farmer will have ID = 1, FFRS code will be `06-30-18-XXX-000001`, etc.

---

## ✅ Verification

After running cleanup, verify with these queries:

```sql
-- Check if farmer tables are empty
SELECT COUNT(*) as farmers FROM rsbsa_submission;  -- Should be 0
SELECT COUNT(*) as parcels FROM rsbsa_farm_parcels;  -- Should be 0
SELECT COUNT(*) as history FROM land_history;  -- Should be 0

-- Check if users are preserved
SELECT COUNT(*) as users FROM users;  -- Should NOT be 0
SELECT username, role FROM users;  -- Should show your accounts

-- Check if barangay codes are preserved
SELECT COUNT(*) as barangay_codes FROM barangay_codes;  -- Should be 26
```

---

## 🎯 Typical Workflow

### Before Starting Your Research:

1. **Run cleanup** to delete test data
2. **Verify** everything is deleted
3. **Register real farmers** through your system
4. **Implement fertilizer demand estimation** (Phase 1)
5. **Start collecting distribution data** for future forecasting

---

## 🆘 Troubleshooting

### "Permission denied" error
```powershell
# Run PowerShell as Administrator
# Right-click PowerShell → Run as Administrator
```

### "psql command not found"
```powershell
# Add PostgreSQL to PATH or use full path:
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d Masterlist -f database\cleanup_farmer_data_only.sql
```

### "Foreign key violation" error
The scripts are designed to delete in the correct order. If you still get this error:
1. Use `quick_delete_farmers.sql` instead (uses TRUNCATE CASCADE)
2. Or manually delete tables in this order:
   - ownership_transfers
   - incentive_distribution_log
   - land_history
   - rsbsa_farm_parcels
   - farm_parcels
   - rsbsa_submission
   - rsbsaform
   - masterlist

---

## 🔙 Backup (Optional but Recommended)

Before cleanup, create a backup:

```powershell
# Backup current database
pg_dump -U postgres -d Masterlist -f backup_before_cleanup.sql

# Restore if needed
psql -U postgres -d Masterlist -f backup_before_cleanup.sql
```

---

## 📝 Summary

**Recommended for you:**
1. Run `cleanup_farmer_data_only.sql` (keeps users)
2. Verify deletion
3. Start registering real farmers
4. Proceed with fertilizer demand estimation implementation

**Need help?** Check the script output messages or ask for assistance!

---

## 🎓 Next Steps After Cleanup

Once your database is clean:

1. ✅ Start fresh with real farmer registration
2. ✅ Implement Phase 1: Demand Estimation API
3. ✅ Create frontend pages for demand estimation
4. ✅ Add fertilizer distribution tracking tables
5. ✅ Begin data collection for future forecasting model

---

Last Updated: November 13, 2025
