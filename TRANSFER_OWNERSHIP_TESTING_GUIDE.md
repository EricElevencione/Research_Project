# Transfer Ownership Feature - Testing Guide

## Overview
The Transfer Ownership feature allows JO users to transfer land ownership from one farmer to another, handling inheritance, sales, donations, and other ownership changes.

## Implementation Summary

### ✅ Frontend (JoLandrecords.tsx)
- **"Transfer Ownership" button** added next to "Full History" for every land owner
- **Transfer Modal** with:
  - Current owner information display
  - Transfer reason text field
  - Transfer date picker
  - Radio options: Select existing farmer OR Register new farmer
  - Farmer search with autocomplete (for existing farmers)
  - New farmer registration form (for new owners)
- **Confirmation Dialog** with warning about consequences
- **Form validation** ensuring all required fields are filled

### ✅ Backend (server.cjs)
- **POST /api/transfer-ownership** endpoint
- Handles both existing and new farmer scenarios
- Performs database transaction:
  1. Creates new farmer if needed (with FFRS code generation)
  2. Marks old owner as "Transferred Ownership" status
  3. Marks new owner as "Active Farmer" with registered owner flag
  4. Reassigns all farm parcels to new owner
  5. Updates tenant/lessee land owner name references
  6. Records transfer in ownership_transfers table (if exists)

### ✅ Database (create_ownership_transfers_table.sql)
- **ownership_transfers** table created to track transfer history
- Includes fields: from_farmer_id, to_farmer_id, transfer_date, transfer_type, transfer_reason
- Foreign key constraints to rsbsa_submission table
- Indexes for performance optimization

### ✅ Styling (JoLandrecStyle.css)
- Complete modal styling with animations
- Form input styles with focus states
- Search results dropdown styling
- Confirmation dialog warning styles
- Responsive design for mobile devices

## How to Test

### Step 1: Database Setup
Run the migration to create the ownership_transfers table:
```sql
-- In PostgreSQL (psql or pgAdmin)
\i database/create_ownership_transfers_table.sql
```

Or manually run the SQL from the file in your database client.

### Step 2: Start the Backend
```bash
cd backend
node server.cjs
```
Server should start on port 5000.

### Step 3: Start the Frontend
```bash
npm run dev
```
Frontend should start on port 5173.

### Step 4: Login as JO User
Navigate to login page and sign in with JO credentials.

### Step 5: Navigate to Land Records
Click "Land Records" in the sidebar.

### Step 6: Test Transfer with Existing Farmer
1. Click **"Transfer Ownership"** button on any land owner card
2. Fill in:
   - **Reason**: "Sale"
   - **Transfer Date**: Select today's date
   - Select **"Select Existing Farmer"** radio option
3. In the search box, type a farmer's name (at least 2 characters)
4. Click on a farmer from the search results
5. Verify the "Selected:" message appears
6. Click **"Transfer Ownership"** button
7. Read the confirmation dialog
8. Click **"Yes, Transfer Ownership"**
9. Wait for success message
10. Verify the old owner disappeared from the Land Records list

### Step 7: Test Transfer with New Farmer
1. Click **"Transfer Ownership"** on another land owner
2. Fill in:
   - **Reason**: "Inheritance - Death of landowner"
   - **Transfer Date**: Select appropriate date
   - Select **"Register New Farmer"** radio option
3. Fill in new farmer details:
   - First Name: Maria
   - Last Name: Dela Cruz
   - Middle Name: Santos
   - Birthdate: 01/15/1990
   - Gender: Female
   - Barangay: Calao
4. Click **"Transfer Ownership"**
5. Confirm in the dialog
6. Wait for success message
7. Verify old owner disappeared and new farmer appears in list

### Step 8: Verify Database Changes
```sql
-- Check ownership_transfers table
SELECT 
    ot.*,
    old_owner."LAST NAME" || ', ' || old_owner."FIRST NAME" as from_farmer,
    new_owner."LAST NAME" || ', ' || new_owner."FIRST NAME" as to_farmer
FROM ownership_transfers ot
JOIN rsbsa_submission old_owner ON ot.from_farmer_id = old_owner.id
JOIN rsbsa_submission new_owner ON ot.to_farmer_id = new_owner.id
ORDER BY ot.created_at DESC
LIMIT 5;

-- Check old owner status
SELECT id, "FIRST NAME", "LAST NAME", "STATUS", "OWNERSHIP_TYPE_REGISTERED_OWNER"
FROM rsbsa_submission
WHERE "STATUS" = 'Transferred Ownership';

-- Check new owner status
SELECT id, "FIRST NAME", "LAST NAME", "STATUS", "OWNERSHIP_TYPE_REGISTERED_OWNER", "FFRS_CODE"
FROM rsbsa_submission
WHERE "OWNERSHIP_TYPE_REGISTERED_OWNER" = true
ORDER BY id DESC
LIMIT 5;
```

## Expected Results

### ✅ Frontend Behavior
- Transfer button appears on all land owner cards
- Modal opens with clean form layout
- Farmer search shows results as you type
- Selected farmer displays with checkmark
- New farmer form validates required fields
- Confirmation dialog warns about consequences
- Success message appears after transfer
- Old owner disappears from list immediately

### ✅ Backend Behavior
- Transaction commits successfully or rolls back on error
- New farmer created with proper FFRS code (if new)
- Old owner marked as "Transferred Ownership"
- New owner marked as "Active Farmer"
- All parcels reassigned to new owner
- Tenant/lessee relationships updated
- Transfer history recorded

### ✅ Database State
- ownership_transfers table has new record
- Old owner: OWNERSHIP_TYPE_REGISTERED_OWNER = false, STATUS = 'Transferred Ownership'
- New owner: OWNERSHIP_TYPE_REGISTERED_OWNER = true, STATUS = 'Active Farmer'
- Farm parcels submission_id updated to new owner
- Tenant land_owner_name fields updated

## Error Scenarios to Test

1. **Empty required fields**: Should show alert
2. **No farmer selected (existing option)**: Should show alert
3. **Incomplete new farmer data**: Should show alert
4. **Server error**: Should show error message and rollback
5. **Network failure**: Should handle gracefully

## Known Limitations

- Document upload feature intentionally excluded (as requested)
- No undo functionality (requires admin intervention)
- Tenant/lessee transfer is automatic (follows owner)
- FFRS code uses default barangay code (007) for new farmers

## Future Enhancements

- Add document upload support
- Add transfer history view in farmer profile
- Add email notifications to new/old owners
- Add approval workflow for transfers
- Add undo/reverse transfer function
- Dynamic barangay code mapping for FFRS generation
- Export transfer reports

## Troubleshooting

### "Transfer failed" error
- Check database connection
- Verify ownership_transfers table exists
- Check console for detailed error logs

### Old owner still appears in list
- Refresh the page
- Check if transaction was committed
- Verify OWNERSHIP_TYPE_REGISTERED_OWNER was set to false

### New farmer not created
- Check FFRS code generation query
- Verify all required columns exist in rsbsa_submission
- Check for duplicate constraint violations

### Tenants/lessees not transferred
- Verify tenant_land_owner_name matches exactly
- Check case sensitivity in name matching
- Run SQL query to verify parcel updates

---

**Implementation Date**: November 11, 2025  
**Status**: ✅ Complete and Ready for Testing
