# FFRS ID System: Complete Technical Documentation

## 📋 FFRS ID System Overview

### **1. FFRS ID Structure**

The FFRS (Farmer and Fisherman Registration System) ID follows this format:

```
06-30-18-XXX-YYYYYY
```

**Components:**
- `06-30-18` = Fixed establishment code (represents Dumangas, Iloilo)
- `XXX` = 3-digit barangay code
- `YYYYYY` = 6-digit random person code

**Example:** `06-30-18-007-123456`

---

## **2. Barangay Code Mapping**

Each barangay in Dumangas has a unique 3-digit code:

### Frontend Implementation
**File:** `src/utils/ffrsCodeGenerator.ts`

```typescript
interface BarangayCode {
    [key: string]: string;
}

// Mapping of barangay names to their respective codes
const barangayCodes: BarangayCode = {
    "Aurora-Del Pilar": "001",
    "Bacay": "002",
    "Bacong": "003",
    "Balabag": "004",
    "Balud": "005",
    "Bantud": "006",
    "Bantud Fabrica": "007",
    "Binaobawan": "008",
    "Bolilao": "009",
    "Cabilao Grande": "010",
    "Cabilao Pequeño": "011",
    "Calao": "012",
    "Dumangas": "013",
    "Ilaya": "014",
    "Jalaud": "015",
    "Lacturan": "016",
    "Lawa-an": "017",
    "Paco": "018",
    "Paloc Bigque": "019",
    "Pulao": "020",
    "Sapao": "021",
    "Tabucan": "022",
    "Taminla": "023",
    "Tiring": "024",
    "Victoria": "025",
    "Zaldivar": "026"
};
```

---

## **3. Generation Methods**

The system has **two generation mechanisms**:

### **A. Database-Level Generation (Primary Method)**

This is the main method used when farmers are registered through the system.

#### Database Function
**File:** `database/Masterlist5.sql` (Lines 177-220)

```sql
-- Main generation function
CREATE FUNCTION public.generate_ffrs_code(barangay_name character varying) 
RETURNS character varying
LANGUAGE plpgsql
AS $$
DECLARE
    establishment_code VARCHAR := '06-30-18';
    barangay_code VARCHAR;
    person_code VARCHAR;
BEGIN
    -- Map barangay names to codes
    barangay_code := CASE barangay_name
        WHEN 'Aurora-Del Pilar' THEN '001'
        WHEN 'Bacay' THEN '002'
        WHEN 'Bacong' THEN '003'
        WHEN 'Balabag' THEN '004'
        WHEN 'Balud' THEN '005'
        WHEN 'Bantud' THEN '006'
        WHEN 'Bantud Fabrica' THEN '007'
        WHEN 'Binaobawan' THEN '008'
        WHEN 'Bolilao' THEN '009'
        WHEN 'Cabilao Grande' THEN '010'
        WHEN 'Cabilao Pequeño' THEN '011'
        WHEN 'Calao' THEN '012'
        WHEN 'Dumangas' THEN '013'
        WHEN 'Ilaya' THEN '014'
        WHEN 'Jalaud' THEN '015'
        WHEN 'Lacturan' THEN '016'
        WHEN 'Lawa-an' THEN '017'
        WHEN 'Paco' THEN '018'
        WHEN 'Paloc Bigque' THEN '019'
        WHEN 'Pulao' THEN '020'
        WHEN 'Sapao' THEN '021'
        WHEN 'Tabucan' THEN '022'
        WHEN 'Taminla' THEN '023'
        WHEN 'Tiring' THEN '024'
        WHEN 'Victoria' THEN '025'
        WHEN 'Zaldivar' THEN '026'
        ELSE '000'
    END;
    
    -- Generate random 6-digit person code
    person_code := LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    
    RETURN establishment_code || '-' || barangay_code || '-' || person_code;
END;
$$;
```

#### Trigger Function
**File:** `database/Masterlist5.sql` (Lines 231-248)

```sql
-- Automatically generates FFRS code on farmer insertion
CREATE FUNCTION public.generate_ffrs_code_trigger() 
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."FFRS_CODE" IS NULL THEN
        LOOP
            BEGIN
                NEW."FFRS_CODE" := generate_ffrs_code(NEW."BARANGAY");
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                -- If we get a duplicate, the loop will try again
            END;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;
```

#### Database Trigger
**File:** `database/Masterlist5.sql` (Lines 3362)

```sql
-- Trigger fires BEFORE INSERT on rsbsa_submission table
CREATE TRIGGER trigger_generate_ffrs_code 
BEFORE INSERT ON public.rsbsa_submission 
FOR EACH ROW 
EXECUTE FUNCTION public.generate_ffrs_code_trigger();
```

**How it works:**
1. When a new farmer record is inserted into `rsbsa_submission`
2. The trigger `trigger_generate_ffrs_code` fires BEFORE the INSERT
3. It checks if `FFRS_CODE` is NULL
4. If NULL, it calls `generate_ffrs_code()` function with the barangay name
5. The function generates: `06-30-18` + barangay code + random 6 digits
6. If the generated code already exists (UNIQUE constraint violation), it loops and tries again
7. The generated code is stored in the `FFRS_CODE` column

---

### **B. Frontend Utility (Alternative Method)**

This utility can be used for client-side generation when needed.

**File:** `src/utils/ffrsCodeGenerator.ts`

```typescript
/**
 * Generates an FFRS System Code following the format: 06-30-18-XXX-YYYYYY
 * @param barangayName - The name of the barangay
 * @returns The generated FFRS System Code
 */
export const generateFFRSCode = (barangayName: string): string => {
    // Fixed establishment code
    const establishmentCode = "06-30-18";

    // Get barangay code from the mapping
    const barangayCode = barangayCodes[barangayName] || "000";

    // Generate a random 6-digit person code
    const personCode = String(Math.floor(Math.random() * 999999)).padStart(6, "0");

    // Combine all parts to form the FFRS code
    return `${establishmentCode}-${barangayCode}-${personCode}`;
};

/**
 * Validates if the given FFRS code follows the correct format
 * @param code - The FFRS code to validate
 * @returns boolean indicating if the code is valid
 */
export const isValidFFRSCode = (code: string): boolean => {
    const pattern = /^06-30-18-\d{3}-\d{6}$/;
    return pattern.test(code);
};

/**
 * Gets the barangay name from an FFRS code
 * @param code - The FFRS code
 * @returns The barangay name or null if not found
 */
export const getBarangayFromFFRSCode = (code: string): string | null => {
    if (!isValidFFRSCode(code)) return null;

    const barangayCode = code.split("-")[3];
    const entries = Object.entries(barangayCodes);
    const barangayEntry = entries.find(([_, code]) => code === barangayCode);

    return barangayEntry ? barangayEntry[0] : null;
};
```

---

## **4. Storage in Database**

FFRS codes are stored in the **`rsbsa_submission`** table.

### Database Schema

```sql
CREATE TABLE rsbsa_submission (
    id BIGSERIAL PRIMARY KEY,
    "FIRST NAME" VARCHAR(255),
    "LAST NAME" VARCHAR(255),
    "MIDDLE NAME" VARCHAR(255),
    "BARANGAY" VARCHAR(255),
    "FFRS_CODE" VARCHAR(50) UNIQUE,  -- ← FFRS ID stored here
    status VARCHAR(50),
    submitted_at TIMESTAMP,
    -- ... other columns
);
```

**Key Points:**
- `FFRS_CODE` has a UNIQUE constraint to prevent duplicates
- It's automatically populated by the trigger on INSERT
- Can be manually set if provided during registration

### Registration Flow

```
1. User submits farmer registration form
   ↓
2. Frontend sends data to backend API
   ↓
3. Backend inserts into rsbsa_submission table
   ↓
4. Database trigger (trigger_generate_ffrs_code) fires
   ↓
5. If FFRS_CODE is NULL:
   - Calls generate_ffrs_code(barangay_name)
   - Generates: 06-30-18 + barangay_code + random_6_digits
   - Checks uniqueness (retry if duplicate)
   ↓
6. Record saved with unique FFRS_CODE
```

---

## **5. Display in Land Registry**

The land registry displays FFRS codes alongside land parcel information.

### **A. Data Fetching Process**

**File:** `src/screens/JO/JoLandRegistry.tsx` (Lines 127-179)

```typescript
// Fetch all land parcels with current owners
useEffect(() => {
    const fetchLandParcels = async () => {
        setLoading(true);
        try {
            // Step 1: Fetch current land history records
            const { data, error } = await supabase
                .from('land_history')
                .select(`
                    id,
                    land_parcel_id,
                    parcel_number,
                    farm_location_barangay,
                    farm_location_municipality,
                    total_farm_area_ha,
                    land_owner_name,
                    farmer_id,                    // ← Key: farmer ID for FFRS lookup
                    farmer_name,
                    is_registered_owner,
                    is_tenant,
                    is_lessee,
                    is_current,
                    period_start_date
                `)
                .eq('is_current', true)           // Only current ownership records
                .order('parcel_number', { ascending: true });

            if (error) {
                console.error('Error fetching land parcels:', error);
            } else {
                const parcels = data || [];

                // Step 2: Extract unique farmer IDs from parcels
                const farmerIds = [...new Set(parcels.map((p: any) => p.farmer_id).filter(Boolean))];
                let ffrsMap: Record<number, string> = {};

                // Step 3: Fetch FFRS codes from rsbsa_submission for all farmer IDs
                if (farmerIds.length > 0) {
                    const { data: ffrsData } = await supabase
                        .from('rsbsa_submission')
                        .select('id, "FFRS_CODE"')      // ← Fetch farmer ID and FFRS code
                        .in('id', farmerIds);            // Only for farmers in our parcels

                    if (ffrsData) {
                        // Step 4: Create a map of farmer_id → FFRS_CODE
                        ffrsMap = Object.fromEntries(
                            ffrsData.map((r: any) => [r.id, r.FFRS_CODE || ''])
                        );
                    }
                }

                // Step 5: Merge FFRS codes into parcel data
                const parcelsWithFfrs = parcels.map((p: any) => ({
                    ...p,
                    ffrs_code: ffrsMap[p.farmer_id] || ''  // ← Add FFRS code to each parcel
                }));

                setLandParcels(parcelsWithFfrs);
                console.log('✅ Loaded', parcelsWithFfrs.length, 'land parcels with FFRS codes');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    fetchLandParcels();
}, []);
```

**Data Flow:**
```
land_history (current records)
  ↓ (has farmer_id)
  ↓
Fetch unique farmer_ids
  ↓
Query rsbsa_submission WHERE id IN (farmer_ids)
  ↓ (returns farmer id and FFRS_CODE)
  ↓
Create Map: { farmer_id: FFRS_CODE }
  ↓
Merge FFRS codes into parcel objects
  ↓
Display in UI
```

---

### **B. Display in Table View**

**File:** `src/screens/JO/JoLandRegistry.tsx` (Lines 422-453)

```tsx
{/* Land Registry Table */}
<div className="jo-land-registry-table-container">
    <table className="jo-land-registry-table">
        <thead>
            <tr>
                <th>FFRS Code</th>          {/* ← Column 1: FFRS Code */}
                <th>Parcel Number</th>
                <th>Current Holder</th>
                <th>Ownership Type</th>
                <th>Barangay</th>
                <th>Area (ha)</th>
                <th>Since</th>
            </tr>
        </thead>
        <tbody>
            {loading ? (
                <tr>
                    <td colSpan={7} className="jo-land-registry-loading-cell">
                        Loading land parcels...
                    </td>
                </tr>
            ) : filteredParcels.length === 0 ? (
                <tr>
                    <td colSpan={7} className="jo-land-registry-empty-cell">
                        {searchTerm || filterBarangay
                            ? 'No parcels match your search criteria'
                            : 'No land parcels registered yet'}
                    </td>
                </tr>
            ) : (
                filteredParcels.map(parcel => (
                    <tr
                        key={parcel.id}
                        onClick={() => handleParcelSelect(parcel)}
                        className={selectedParcel?.id === parcel.id ? 'selected' : ''}
                    >
                        {/* Display FFRS Code */}
                        <td>
                            <strong>{parcel.ffrs_code || '—'}</strong>
                        </td>
                        
                        <td>{parcel.parcel_number || `#${parcel.id}`}</td>
                        <td>{parcel.farmer_name || parcel.land_owner_name || '—'}</td>
                        <td>
                            <span className={`jo-land-registry-ownership-pill jo-land-registry-ownership-${getOwnershipClass(parcel)}`}>
                                {getOwnershipType(parcel)}
                            </span>
                        </td>
                        <td>{parcel.farm_location_barangay || '—'}</td>
                        <td>{parcel.total_farm_area_ha?.toFixed(2) || '0'}</td>
                        <td>{formatDate(parcel.period_start_date)}</td>
                    </tr>
                ))
            )}
        </tbody>
    </table>
</div>
```

**Visual Display:**
```
┌─────────────────┬────────────┬───────────────┬──────────────┬───────────┬──────────┬────────────┐
│ FFRS Code       │ Parcel No  │ Current Holder│ Ownership    │ Barangay  │ Area(ha) │ Since      │
├─────────────────┼────────────┼───────────────┼──────────────┼───────────┼──────────┼────────────┤
│ 06-30-18-007... │ P-001      │ Juan Dela Cruz│ Owner        │ Bantud    │ 2.50     │ Jan 2024   │
│ 06-30-18-013... │ P-002      │ Maria Santos  │ Tenant       │ Dumangas  │ 1.75     │ Mar 2024   │
└─────────────────┴────────────┴───────────────┴──────────────┴───────────┴──────────┴────────────┘
```

---

### **C. Display in Detail Modal**

**File:** `src/screens/JO/JoLandRegistry.tsx` (Lines 494-508)

When a user clicks on a parcel, a detail modal appears showing comprehensive information including the FFRS code.

```tsx
{/* Detail Modal */}
{showModal && selectedParcel && (
    <div className="jo-land-registry-modal-overlay" onClick={() => setShowModal(false)}>
        <div className="jo-land-registry-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jo-land-registry-modal-header">
                <h3>📋 Land Parcel Details</h3>
                <button
                    className="jo-land-registry-close-button"
                    onClick={() => setShowModal(false)}
                >
                    ×
                </button>
            </div>
            <div className="jo-land-registry-modal-body">
                {/* Current Owner Section */}
                <div className="jo-land-registry-detail-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ margin: 0 }}>👤 Current Holder</h4>
                    </div>
                    <div className="jo-land-registry-owner-card">
                        <div className="jo-land-registry-owner-avatar">
                            {getOwnershipIcon(selectedParcel)}
                        </div>
                        <div className="jo-land-registry-owner-details">
                            <h4>{selectedParcel.farmer_name || selectedParcel.land_owner_name || 'Unknown'}</h4>
                            <span className="jo-land-registry-owner-type">
                                {getOwnershipType(selectedParcel)}
                            </span>
                        </div>
                    </div>
                    
                    {/* Info Grid with FFRS Code */}
                    <div className="jo-land-registry-info-grid">
                        <div className="jo-land-registry-info-item">
                            <span className="jo-land-registry-info-label">FFRS Code</span>
                            <span className="jo-land-registry-info-value">
                                {selectedParcel.ffrs_code || '—'}      {/* ← FFRS Code Display */}
                            </span>
                        </div>
                        <div className="jo-land-registry-info-item">
                            <span className="jo-land-registry-info-label">Parcel Number</span>
                            <span className="jo-land-registry-info-value">
                                {selectedParcel.parcel_number || `#${selectedParcel.id}`}
                            </span>
                        </div>
                        {/* ... other fields */}
                    </div>
                </div>
            </div>
        </div>
    </div>
)}
```

---

### **D. Search Functionality**

Users can search for parcels by FFRS code:

**File:** `src/screens/JO/JoLandRegistry.tsx` (Lines 268-276)

```typescript
// Filter parcels based on search term and barangay filter
const filteredParcels = useMemo(() => {
    return landParcels.filter(parcel => {
        const matchesSearch = searchTerm === '' ||
            parcel.ffrs_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||    // ← Search by FFRS
            parcel.parcel_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            parcel.farmer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            parcel.land_owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            parcel.farm_location_barangay?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesBarangay = filterBarangay === '' ||
            parcel.farm_location_barangay === filterBarangay;

        return matchesSearch && matchesBarangay;
    });
}, [landParcels, searchTerm, filterBarangay]);
```

---

## **6. Data Relationships**

### Entity Relationship

```
rsbsa_submission (farmers)
    ├── id (PRIMARY KEY)
    ├── FFRS_CODE (UNIQUE)
    ├── FIRST NAME
    ├── LAST NAME
    └── BARANGAY
         │
         │ Referenced by
         ↓
land_history (ownership records)
    ├── id (PRIMARY KEY)
    ├── farmer_id (FOREIGN KEY → rsbsa_submission.id)
    ├── parcel_number
    ├── is_current (TRUE for active ownership)
    └── period_start_date
```

### Query Pattern

```sql
-- How the system links FFRS codes to parcels
SELECT 
    lh.parcel_number,
    lh.farmer_name,
    rs."FFRS_CODE"                     -- ← FFRS code from farmer table
FROM land_history lh
LEFT JOIN rsbsa_submission rs 
    ON lh.farmer_id = rs.id            -- ← Join on farmer ID
WHERE lh.is_current = TRUE
ORDER BY lh.parcel_number;
```

---

## **7. Other Display Locations**

### A. RSBSA Page
**File:** `src/screens/JO/JoRsbsaPage.tsx`

```tsx
// Display FFRS ID in RSBSA table
<thead>
    <tr>
        <th>FFRS ID</th>                    {/* ← Column header */}
        <th>Farmer Name</th>
        {/* ... */}
    </tr>
</thead>
<tbody>
    {records.map(record => (
        <tr key={record.id}>
            <td className="jo-rsbsa-ffrs-id">
                {record.referenceNumber || 'N/A'}    {/* ← FFRS display */}
            </td>
            {/* ... */}
        </tr>
    ))}
</tbody>
```

### B. Technician RSBSA View
**File:** `src/screens/technicians/TechRsbsa.tsx`

```tsx
// Searchable by FFRS ID
const ffrsMatch = record.referenceNumber?.toLowerCase().includes(searchLower) ||
                  record.referenceNumber?.replace(/-/g, '').toLowerCase().includes(searchLower);

// Display in table
<th>FFRS ID</th>
// ...
<td className="tech-rsbsa-ffrs-id">{record.referenceNumber || 'N/A'}</td>
```

### C. Backend API Response
**File:** `backend/routes/rsbsa_submission.cjs`

```javascript
// FFRS code returned in API responses
referenceNumber: row["FFRS_CODE"] || `RSBSA-${row.id}`,
```

---

## **8. Transfer Ownership & FFRS Code**

When ownership is transferred, the new owner's FFRS code is automatically linked.

**File:** `backend/routes/transfer.cjs` (Lines 67-80)

```javascript
// When creating a new farmer during transfer
const ffrsQuery = `
    SELECT COALESCE(MAX(CAST(SUBSTRING("FFRS_CODE" FROM 16) AS INTEGER)), 0) + 1 
    as next_number
    FROM rsbsa_submission
    WHERE "FFRS_CODE" LIKE '06-30-18-%'
`;
const ffrsResult = await client.query(ffrsQuery);
const nextNumber = ffrsResult.rows[0].next_number;
const barangayCode = '007'; // Mapped from barangay
const newFfrsCode = `06-30-18-${barangayCode}-${String(nextNumber).padStart(6, '0')}`;

// Insert new farmer with generated FFRS code
INSERT INTO rsbsa_submission (..., "FFRS_CODE", ...) 
VALUES (..., newFfrsCode, ...);
```

---

## **9. Key Features & Benefits**

✅ **Automatic Generation**
- FFRS codes are generated automatically when a farmer is registered
- No manual input required

✅ **Uniqueness Guarantee**
- Database UNIQUE constraint prevents duplicates
- Retry logic in case of collision (extremely rare)

✅ **Barangay Identification**
- Each code contains the barangay identifier
- Easy to identify farmer's origin

✅ **Persistent & Immutable**
- Once assigned, FFRS code stays with the farmer
- Used across all system modules

✅ **Searchable**
- Can search by FFRS code in all farmer lists
- Supports both formatted (06-30-18-007-123456) and unformatted searches

✅ **Validation**
- Format validation ensures data integrity
- Pattern: `^06-30-18-\d{3}-\d{6}$`

---

## **10. Complete Flow Diagram**

```
                    FFRS CODE GENERATION & DISPLAY FLOW
                    
┌─────────────────────────────────────────────────────────────────┐
│                     FARMER REGISTRATION                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│  Frontend: JoRsbsaRegistration.tsx                            │
│  - User fills form (name, barangay, etc.)                     │
│  - Submit to backend API                                      │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│  Backend API: routes/rsbsa_submission.cjs                     │
│  - Receive farmer data                                        │
│  - INSERT INTO rsbsa_submission                               │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│  Database Trigger: trigger_generate_ffrs_code                 │
│  - Fires BEFORE INSERT                                        │
│  - Checks if FFRS_CODE is NULL                                │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│  Function: generate_ffrs_code(barangay_name)                  │
│  1. Get establishment code: "06-30-18"                        │
│  2. Map barangay name → code (e.g., "Bantud" → "006")         │
│  3. Generate random 6-digit: FLOOR(RANDOM() * 999999)         │
│  4. Format: "06-30-18-006-123456"                             │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│  Uniqueness Check                                             │
│  - Database checks UNIQUE constraint                          │
│  - If duplicate: Exception → Loop & retry                     │
│  - If unique: Proceed                                         │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│  rsbsa_submission Table                                       │
│  - Record saved with FFRS_CODE                                │
│  - Farmer now has permanent ID                                │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ↓                                       ↓
┌──────────────────┐                 ┌──────────────────────┐
│  DISPLAY IN      │                 │  DISPLAY IN          │
│  LAND REGISTRY   │                 │  RSBSA PAGES         │
└────────┬─────────┘                 └──────────┬───────────┘
         │                                      │
         ↓                                      ↓
┌────────────────────────────────┐   ┌─────────────────────────┐
│ JoLandRegistry.tsx             │   │ JoRsbsaPage.tsx         │
│                                │   │ TechRsbsa.tsx           │
│ 1. Fetch land_history          │   │                         │
│    (current ownership)         │   │ 1. Fetch rsbsa_         │
│                                │   │    submission           │
│ 2. Extract farmer_ids          │   │                         │
│                                │   │ 2. Display FFRS_CODE    │
│ 3. Query rsbsa_submission      │   │    in table             │
│    for FFRS_CODE               │   │                         │
│                                │   │ 3. Allow search by      │
│ 4. Map: farmer_id → FFRS       │   │    FFRS code            │
│                                │   │                         │
│ 5. Merge into parcels          │   └─────────────────────────┘
│                                │
│ 6. Display in table:           │
│    - FFRS Code column          │
│    - Parcel details            │
│                                │
│ 7. Display in modal:           │
│    - Detailed view             │
│    - Search by FFRS            │
└────────────────────────────────┘
```

---

## **11. Example Code Usage**

### Generate FFRS Code (Frontend)
```typescript
import { generateFFRSCode, isValidFFRSCode } from '../utils/ffrsCodeGenerator';

// Generate code for a farmer from Bantud
const ffrsCode = generateFFRSCode("Bantud");
console.log(ffrsCode); // Output: 06-30-18-006-438291

// Validate code
const isValid = isValidFFRSCode("06-30-18-006-438291");
console.log(isValid); // Output: true
```

### Query by FFRS Code (SQL)
```sql
-- Find farmer by FFRS code
SELECT 
    id,
    "FIRST NAME",
    "LAST NAME",
    "FFRS_CODE",
    "BARANGAY"
FROM rsbsa_submission
WHERE "FFRS_CODE" = '06-30-18-006-438291';

-- Find all parcels owned by farmer with specific FFRS
SELECT 
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.total_farm_area_ha,
    rs."FFRS_CODE"
FROM land_history lh
JOIN rsbsa_submission rs ON lh.farmer_id = rs.id
WHERE rs."FFRS_CODE" = '06-30-18-006-438291'
  AND lh.is_current = TRUE;
```

### Search by FFRS Code (Frontend)
```typescript
// In JoLandRegistry.tsx
const searchByFFRS = (ffrsCode: string) => {
    const filtered = landParcels.filter(parcel => 
        parcel.ffrs_code?.includes(ffrsCode)
    );
    return filtered;
};
```

---

## **12. Troubleshooting**

### Issue: FFRS Code not appearing
**Solution:** Ensure farmer_id is properly linked in land_history table

```sql
-- Check if farmer_id exists
SELECT farmer_id FROM land_history WHERE parcel_number = 'P-001';

-- Verify farmer has FFRS_CODE
SELECT id, "FFRS_CODE" FROM rsbsa_submission WHERE id = <farmer_id>;
```

### Issue: Duplicate FFRS codes
**Solution:** The system should prevent this, but if it happens:

```sql
-- Find duplicates
SELECT "FFRS_CODE", COUNT(*) 
FROM rsbsa_submission 
GROUP BY "FFRS_CODE" 
HAVING COUNT(*) > 1;

-- Fix: Regenerate for duplicates
UPDATE rsbsa_submission 
SET "FFRS_CODE" = generate_ffrs_code("BARANGAY")
WHERE "FFRS_CODE" IN (SELECT duplicate_codes FROM previous_query);
```

### Issue: Search not working
**Solution:** Ensure case-insensitive search and handle null values

```typescript
// Proper search implementation
const searchTerm = searchInput.toLowerCase();
const results = parcels.filter(p => 
    p.ffrs_code?.toLowerCase().includes(searchTerm) ||
    p.ffrs_code?.replace(/-/g, '').toLowerCase().includes(searchTerm) // Handle without dashes
);
```

---

## **13. Future Enhancements**

### Potential Improvements
1. **QR Code Generation**: Generate QR codes containing FFRS ID for mobile scanning
2. **Barcode Support**: Print barcodes on farmer certificates
3. **API Endpoint**: Dedicated endpoint to validate FFRS codes
4. **Bulk Import**: Handle FFRS code generation during CSV imports
5. **Historical Tracking**: Track when FFRS codes were first assigned

---

## **Summary**

The FFRS ID system is a robust, automated identifier for farmers in the Dumangas land registry system.

**Key Takeaways:**
- ✅ Automatically generated via database trigger
- ✅ Format: `06-30-18-XXX-YYYYYY` (establishment-barangay-person)
- ✅ Stored in `rsbsa_submission.FFRS_CODE`
- ✅ Displayed in Land Registry via JOIN with farmer_id
- ✅ Searchable, unique, and validated
- ✅ Used across multiple system modules

**Main Files:**
- Database: `database/Masterlist5.sql` (generation functions & triggers)
- Frontend Utility: `src/utils/ffrsCodeGenerator.ts` (TypeScript helpers)
- Display: `src/screens/JO/JoLandRegistry.tsx` (land registry view)
- API: `backend/routes/rsbsa_submission.cjs` (farmer registration)
