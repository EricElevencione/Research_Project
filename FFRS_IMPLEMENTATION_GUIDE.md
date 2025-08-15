# FFRS Masterlist ID System Implementation Guide

## Overview
The FFRS (Farmers and Fisherfolk Registry System) masterlist ID system generates unique identifiers for farmers in the format: `06-30-18-012-000147`

### ID Format Breakdown:
- **06** = Region (fixed for Iloilo)
- **30** = Province (fixed for Iloilo)  
- **18** = Municipality (fixed for Dumangas)
- **012** = Barangay code (variable, 3 digits)
- **000147** = Sequential farmer number (6 digits, padded with zeros)

## Implementation Steps

### 1. Database Setup
Run the database setup script:
```sql
-- Execute: database/create_ffrs_system.sql
```

This script will:
- ✅ Create `barangay_codes` table with all 29 barangays in Dumangas
- ✅ Add `ffrs_id` column to `rsbsaform` table
- ✅ Create `barangay_farmer_counters` table for tracking farmer numbers
- ✅ Generate FFRS IDs for existing records
- ✅ Initialize farmer counters

### 2. Backend Integration
The backend has been updated with:
- ✅ `generateFFRSId()` function for creating new IDs
- ✅ Integration into RSBSA form submission
- ✅ Automatic ID generation for new farmers

### 3. Frontend Updates
The admin RSBSA page now displays:
- ✅ FFRS ID column in the records table
- ✅ Monospace font for better readability
- ✅ "N/A" for records without FFRS IDs

### 4. Testing
Run the test script to verify implementation:
```sql
-- Execute: database/test_ffrs_system.sql
```

## How It Works

### For New Farmers:
1. **Form Submission**: When a new RSBSA form is submitted
2. **Barangay Lookup**: System finds the barangay code (e.g., "Calao" → "007")
3. **Counter Increment**: Increments the farmer counter for that barangay
4. **ID Generation**: Creates ID like `06-30-18-007-000001`
5. **Database Storage**: Saves the ID with the farmer record

### For Existing Farmers:
- ✅ **Migration**: Existing records get IDs based on registration order
- ✅ **Sequential**: First farmer in each barangay gets number 000001, second gets 000002, etc.

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
| Tumcon Ilawod | 029 |

## Example FFRS IDs

- **First farmer in Calao**: `06-30-18-007-000001`
- **Second farmer in Calao**: `06-30-18-007-000002`
- **First farmer in Capaliz**: `06-30-18-008-000001`
- **100th farmer in Poblacion**: `06-30-18-020-000100`

## Benefits

✅ **Unique Identification**: Each farmer has a unique, traceable ID  
✅ **Geographic Tracking**: Easy to identify barangay from ID  
✅ **Sequential Ordering**: Maintains registration order within barangays  
✅ **Scalable**: Supports up to 999,999 farmers per barangay  
✅ **Standardized Format**: Follows government ID standards  

## Troubleshooting

### Common Issues:

1. **"Barangay code not found"**
   - Check if barangay name matches exactly (case-insensitive)
   - Verify barangay is in the `barangay_codes` table

2. **Duplicate FFRS IDs**
   - Check `barangay_farmer_counters` table
   - Reset counters if needed

3. **Missing FFRS IDs for existing records**
   - Run the migration part of the setup script again

### Reset Counters (if needed):
```sql
UPDATE barangay_farmer_counters 
SET current_count = (
    SELECT COUNT(*) 
    FROM rsbsaform r
    JOIN barangay_codes bc ON LOWER(bc.barangay_name) = LOWER(r.address_barangay)
    WHERE bc.barangay_code = barangay_farmer_counters.barangay_code
);
```

## Next Steps

1. **Test the system** with a new farmer registration
2. **Verify FFRS IDs** appear in the admin RSBSA page
3. **Add FFRS ID display** to technician pages if needed
4. **Create reports** using FFRS IDs for government submissions

## Files Modified

- `database/create_ffrs_system.sql` - Database setup
- `database/test_ffrs_system.sql` - Testing script
- `backend/server.cjs` - Backend integration
- `src/screens/admin/RSBSAPage.tsx` - Frontend display
- `FFRS_IMPLEMENTATION_GUIDE.md` - This guide 