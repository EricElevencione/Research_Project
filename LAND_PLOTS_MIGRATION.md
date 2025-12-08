# Land Plots Migration Guide 🗺️

This guide explains how to migrate your land plots storage from **JSON file** to **PostgreSQL database**.

---

## What Changed? 📋

### Before (File-based)
- Land plots stored in: `backend/uploads/land_plots.json`
- Direct file read/write operations
- Limited query capabilities
- No data relationships

### After (Database)
- Land plots stored in: PostgreSQL `land_plots` table
- Database CRUD operations
- Better performance and querying
- Data integrity and relationships

---

## Migration Steps 🚀

### Step 1: Create the Database Table

Run the SQL migration script to create the `land_plots` table:

```bash
# Option A: Using psql command line
psql -U postgres -d Masterlist -f database/create_land_plots_table.sql

# Option B: Using pgAdmin
# 1. Open pgAdmin
# 2. Connect to Masterlist database
# 3. Open Query Tool
# 4. Copy contents of database/create_land_plots_table.sql
# 5. Execute
```

**Verify table creation:**
```sql
SELECT * FROM land_plots LIMIT 1;
```

---

### Step 2: Migrate Existing Data

Run the migration script to transfer data from JSON to database:

```bash
cd backend
node migrate-land-plots.cjs
```

**What this script does:**
1. ✅ Reads `backend/uploads/land_plots.json`
2. ✅ Checks if database table exists
3. ✅ Validates existing data
4. ✅ Inserts all plots into database
5. ✅ Creates backup of JSON file
6. ✅ Shows migration summary

**Expected output:**
```
🚀 Starting land plots migration...

📖 Reading land_plots.json...
✅ Found 7 land plots in file

🔌 Testing database connection...
✅ Database connected

🔍 Checking if land_plots table exists...
✅ Table exists

📝 Starting migration...

  ✅ Migrated: shape-1764588315710-5bde571994ed7 (Arendt, Ensio)
  ✅ Migrated: shape-1764588790380-830b7abdbe99a (Iglesias, Jukka)
  ...

📊 Migration Summary:
  Total: 7
  Success: 7
  Errors: 0

✅ Database now contains 7 land plots

💾 Backup created: backend/uploads/land_plots_backup_1733706789123.json
   Original JSON file preserved for safety

🎉 Migration completed successfully!
```

---

### Step 3: Test the New Endpoints

The endpoints work exactly the same, but now use the database!

#### Test with curl:
```bash
# Get all land plots
curl http://localhost:5000/api/land-plots

# Create new plot
curl -X POST http://localhost:5000/api/land-plots \
  -H "Content-Type: application/json" \
  -d '{"geometry": {...}, "firstName": "John", "surname": "Doe", ...}'

# Update plot
curl -X PUT http://localhost:5000/api/land-plots/PLOT_ID \
  -H "Content-Type: application/json" \
  -d '{"area": 3.0}'

# Delete plot
curl -X DELETE http://localhost:5000/api/land-plots/PLOT_ID
```

#### Test with automated tests:
```bash
npm test
```

Should see:
```
✓ Land Plots Endpoint › should return array of land plots
✓ Land Plots Endpoint › should create a new land plot
✓ Land Plots Endpoint › should update an existing land plot
✓ Land Plots Endpoint › should delete a land plot
```

---

### Step 4: Verify in Your App

1. **Start your backend:**
   ```bash
   node backend/server.cjs
   ```

2. **Start your frontend:**
   ```bash
   npm run dev
   ```

3. **Test in the app:**
   - Open the map/land plots feature
   - Create a new plot
   - Edit an existing plot
   - Delete a plot
   - Verify data persists after refresh

---

## Files Created 📁

### 1. Database Schema
**File:** `database/create_land_plots_table.sql`
- Creates `land_plots` table
- Adds indexes for performance
- Includes all necessary columns

### 2. Route Handler
**File:** `backend/routes/land-plots.cjs`
- GET `/api/land-plots` - Fetch all plots
- POST `/api/land-plots` - Create new plot
- PUT `/api/land-plots/:id` - Update plot
- DELETE `/api/land-plots/:id` - Delete plot

### 3. Migration Script
**File:** `backend/migrate-land-plots.cjs`
- One-time data migration
- Reads JSON file
- Inserts into database
- Creates backup

### 4. Tests
**File:** `backend/server.test.cjs`
- Tests all CRUD operations
- Validates data structure
- Tests error handling

---

## Data Structure 📊

### Database Table Schema

```sql
CREATE TABLE land_plots (
    id VARCHAR(100) PRIMARY KEY,           -- Unique plot ID
    name VARCHAR(255),                     -- Plot name
    ffrs_id VARCHAR(100),                  -- FFRS ID
    area DECIMAL(10, 2),                   -- Area in hectares
    coordinate_accuracy VARCHAR(50),        -- GPS accuracy
    barangay VARCHAR(100),                 -- Barangay
    first_name VARCHAR(100),               -- Farmer first name
    middle_name VARCHAR(100),              -- Farmer middle name
    surname VARCHAR(100),                  -- Farmer surname
    ext_name VARCHAR(50),                  -- Name extension
    gender VARCHAR(20),                    -- Gender
    municipality VARCHAR(100),             -- Municipality
    province VARCHAR(100),                 -- Province
    parcel_address TEXT,                   -- Full address
    status VARCHAR(50),                    -- Owner/Tenant/Lessee
    street VARCHAR(255),                   -- Street
    farm_type VARCHAR(50),                 -- Irrigated/Rainfed
    plot_source VARCHAR(50),               -- manual/imported
    parcel_number VARCHAR(50),             -- Parcel number
    geometry JSONB,                        -- GeoJSON geometry
    created_at TIMESTAMP DEFAULT NOW(),    -- Creation timestamp
    updated_at TIMESTAMP DEFAULT NOW()     -- Update timestamp
);
```

---

## Troubleshooting 🔧

### Error: "Table does not exist"
**Solution:** Run the SQL migration first (Step 1)

### Error: "Connection refused"
**Solution:** Make sure PostgreSQL is running
```bash
# Check PostgreSQL status (Windows)
Get-Service -Name postgresql*

# Start if not running
Start-Service postgresql-x64-14
```

### Error: "File not found"
**Solution:** Check if `backend/uploads/land_plots.json` exists
- If it doesn't exist, that's OK! Just create new plots through the API

### Migration shows "Table already has data"
**Solution:** The script prevents data loss. Edit the migration script if you want to:
- Clear existing data
- Skip migration
- Append data

### Tests fail with "ECONNREFUSED"
**Solution:** Start the backend server first:
```bash
node backend/server.cjs
```

---

## Rollback Plan 🔄

If you need to go back to file-based storage:

1. **Restore the old code:**
   - Uncomment the file-based endpoints in `server.cjs`
   - Comment out: `app.use('/api/land-plots', landPlotsRoutes);`

2. **Restore your data:**
   - Use the backup JSON file created during migration
   - Copy it back to `backend/uploads/land_plots.json`

---

## Performance Improvements 📈

### Before (File-based)
- ❌ Loads entire file on every request
- ❌ No indexing
- ❌ No concurrent access control
- ❌ Limited to ~1000 records

### After (Database)
- ✅ Loads only requested data
- ✅ Indexed queries (barangay, municipality, status)
- ✅ Handles concurrent requests
- ✅ Scales to millions of records
- ✅ Transaction support
- ✅ Data relationships possible

---

## Next Steps 🎯

After successful migration:

1. ✅ Test thoroughly in development
2. ✅ Keep the JSON backup for safety
3. ✅ Monitor for any issues
4. ✅ After 1 week of stable operation, delete the JSON file
5. ✅ Consider adding more features:
   - Link plots to `rsbsa_submission` table
   - Add history tracking
   - Implement spatial queries
   - Add plot ownership transfers

---

## Need Help? 🆘

If you encounter any issues:

1. Check the console output for error messages
2. Verify database connection: `psql -U postgres -d Masterlist`
3. Check if table exists: `\dt land_plots`
4. View table data: `SELECT * FROM land_plots;`
5. Check server logs for errors

---

## Summary ✅

**What was done:**
- ✅ Created database table for land plots
- ✅ Moved endpoints from `server.cjs` to `routes/land-plots.cjs`
- ✅ Created migration script for existing data
- ✅ Added comprehensive tests
- ✅ Preserved all existing functionality

**Benefits:**
- 🚀 Better performance
- 🔒 Data integrity
- 📈 Scalability
- 🧪 Testable code
- 🏗️ Better architecture

Your land plots are now database-backed and ready for production! 🎉
