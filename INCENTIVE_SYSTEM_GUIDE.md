# Municipal Agricultural Incentive Distribution System - Complete Guide

**Last Updated:** November 3, 2025  
**Version:** 1.0  
**System Type:** Record-Only Distribution Tracking (No Online Requests, No Approvals, No Stock Management)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Design](#architecture--design)
3. [Database Schema](#database-schema)
4. [Backend API](#backend-api)
5. [Frontend Components](#frontend-components)
6. [User Roles & Permissions](#user-roles--permissions)
7. [Complete Workflow](#complete-workflow)
8. [Installation & Setup](#installation--setup)
9. [Usage Examples](#usage-examples)
10. [API Integration](#api-integration)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## System Overview

### Purpose

The Municipal Agricultural Incentive Distribution System is designed to **record and track agricultural incentive distributions** (seeds, fertilizers, tools) that have already been given to farmers. It is a **historical record-keeping system**, not a request management system.

### Key Characteristics

- ✅ **Record-Only**: Captures distributions that have already occurred
- ✅ **Municipal-Level**: Single LGU implementation (no multi-municipality)
- ✅ **Simple Workflow**: Log → View → Report (no approvals, no stock management)
- ✅ **Offline-First**: Encoders record paper receipt distributions
- ✅ **Read-Only for Farmers**: Farmers can view their history but cannot edit
- ✅ **Analytics for LGU**: Summary statistics and CSV exports

### What It Does NOT Do

- ❌ No online request submission by farmers
- ❌ No approval workflow or status changes
- ❌ No inventory/stock management
- ❌ No printing or QR code generation
- ❌ No multi-municipality setup
- ❌ No budget tracking or financial management

---

## Architecture & Design

### Technology Stack

**Backend:**
- Node.js 18+
- Express.js 4.x
- TypeScript 5.x
- PostgreSQL 12+
- pg (node-postgres) 8.x
- JWT authentication

**Frontend:**
- React 18
- TypeScript 5.x
- Vite 5.x
- Tailwind CSS 3.x/4.x
- react-hot-toast (notifications)
- lucide-react (icons)

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Encoder     │  │   Farmer    │  │   LGU       │         │
│  │ Form        │  │   History   │  │   Report    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                           │                                  │
│                    API Service Layer                         │
│                  (incentiveApi.ts)                           │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST
                            │ (JWT Token)
┌───────────────────────────┴─────────────────────────────────┐
│                    Backend (Express)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Routes    │→ │ Controllers │→ │  Services   │         │
│  │  (Auth MW)  │  │  (HTTP)     │  │ (Business)  │         │
│  └─────────────┘  └─────────────┘  └──────┬──────┘         │
│                                            │                 │
└────────────────────────────────────────────┼─────────────────┘
                                             │ SQL
┌────────────────────────────────────────────┴─────────────────┐
│                    PostgreSQL Database                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ incentive_dist…  │  │    masterlist    │                 │
│  │   (main table)   │  │  (farmer data)   │                 │
│  └──────────────────┘  └──────────────────┘                 │
│  ┌──────────────────┐                                        │
│  │      users       │                                        │
│  │  (auth/roles)    │                                        │
│  └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

**Backend:**
- **Layered Architecture**: Routes → Controllers → Services → Database
- **Dependency Injection**: Services injected into controllers
- **Error Handling**: Centralized error middleware
- **Validation**: Input validation at service layer

**Frontend:**
- **Component-Based**: Reusable UI components
- **Service Layer**: API calls abstracted in services
- **Type Safety**: Full TypeScript coverage
- **State Management**: React hooks (useState, useEffect)

---

## Database Schema

### Main Table: `incentive_distribution_log`

**Purpose:** Records each incentive distribution event

```sql
CREATE TABLE incentive_distribution_log (
    id SERIAL PRIMARY KEY,
    farmer_id INT NOT NULL REFERENCES masterlist(id) ON DELETE CASCADE,
    encoded_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_date DATE NOT NULL,
    incentive_type VARCHAR(100) NOT NULL,
    qty_requested DECIMAL(10,2) NOT NULL CHECK (qty_requested > 0),
    qty_received DECIMAL(10,2) NOT NULL CHECK (qty_received >= 0),
    shortage DECIMAL(10,2) GENERATED ALWAYS AS (qty_requested - qty_received) STORED,
    is_signed BOOLEAN NOT NULL DEFAULT false,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns Explained:**

| Column | Type | Purpose | Constraints |
|--------|------|---------|-------------|
| `id` | SERIAL | Primary key | Auto-increment |
| `farmer_id` | INT | Links to farmer in masterlist | Foreign key, required |
| `encoded_by` | INT | User who recorded this | Foreign key, required |
| `event_date` | DATE | When distribution occurred | Required, cannot be future |
| `incentive_type` | VARCHAR(100) | Type of incentive | Required (seeds, fertilizer, etc.) |
| `qty_requested` | DECIMAL(10,2) | Amount farmer requested | Must be > 0 |
| `qty_received` | DECIMAL(10,2) | Amount farmer actually got | Must be >= 0, <= requested |
| `shortage` | DECIMAL(10,2) | Auto-calculated shortage | Generated column |
| `is_signed` | BOOLEAN | Paper receipt signed? | Required (must be true) |
| `note` | TEXT | Optional notes | Max 1000 chars |
| `created_at` | TIMESTAMP | Record creation time | Auto-set |
| `updated_at` | TIMESTAMP | Last update time | Auto-updated by trigger |

### Indexes for Performance

```sql
-- Farmer lookup (most common query)
CREATE INDEX idx_farmer_id ON incentive_distribution_log(farmer_id);

-- Date filtering for reports
CREATE INDEX idx_event_date ON incentive_distribution_log(event_date);

-- Type-based analytics
CREATE INDEX idx_incentive_type ON incentive_distribution_log(incentive_type);

-- Shortage tracking
CREATE INDEX idx_shortage ON incentive_distribution_log(shortage) WHERE shortage > 0;

-- Unsigned receipts
CREATE INDEX idx_unsigned ON incentive_distribution_log(is_signed) WHERE is_signed = false;

-- Recent records
CREATE INDEX idx_created_at ON incentive_distribution_log(created_at DESC);
```

### Supporting Tables

**`users` Table:**
```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('encoder', 'farmer', 'lgu', 'admin')),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`masterlist` Table (Existing):**
- Contains farmer demographic data
- Used for farmer search and linking
- Fields: `id`, `first_name`, `last_name`, `rsbsa_num`, `barangay`, etc.

### Database Constraints & Business Rules

1. **Quantity Validation:**
   ```sql
   CHECK (qty_requested > 0)
   CHECK (qty_received >= 0)
   CHECK (qty_received <= qty_requested)
   ```

2. **Signature Requirement:**
   - `is_signed` must be `true` for recording
   - Enforced at application layer (not DB constraint)

3. **Date Validation:**
   - `event_date` cannot be in the future
   - Validated in backend service layer

4. **Auto-Update Timestamp:**
   ```sql
   CREATE TRIGGER update_incentive_log_updated_at
   BEFORE UPDATE ON incentive_distribution_log
   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
   ```

---

## Backend API

### Base Configuration

**Server:** `backend/incentive-server.ts`  
**Port:** 3001 (configurable via `.env`)  
**Base URL:** `http://localhost:3001`

### Environment Variables

```env
# .env file
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
JWT_SECRET=your-super-secret-jwt-key-change-this
PORT=3001
NODE_ENV=development
```

### API Endpoints

#### 1. Create Distribution Log

**Endpoint:** `POST /api/incentives/log`  
**Auth Required:** Yes (JWT token)  
**Role:** `encoder` or `admin` only

**Request Body:**
```json
{
  "farmer_id": 123,
  "event_date": "2025-11-03",
  "incentive_type": "Rice Seeds 20kg",
  "qty_requested": 20.00,
  "qty_received": 20.00,
  "is_signed": true,
  "note": "Fully fulfilled, farmer satisfied"
}
```

**Validation Rules:**
- `farmer_id`: Must exist in masterlist table
- `event_date`: Cannot be future date, format: YYYY-MM-DD
- `incentive_type`: Required, max 100 chars
- `qty_requested`: Must be > 0
- `qty_received`: Must be >= 0 and <= qty_requested
- `is_signed`: Must be `true`
- `note`: Optional, max 1000 chars

**Success Response (201 Created):**
```json
{
  "success": true,
  "id": 456,
  "shortage": 0.00,
  "message": "Distribution log created successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "field": "qty_received",
      "message": "Quantity received cannot exceed quantity requested"
    },
    {
      "field": "is_signed",
      "message": "Farmer signature is required"
    }
  ]
}
```

#### 2. Get Farmer's Distribution History

**Endpoint:** `GET /api/incentives/farmer/:farmerId`  
**Auth Required:** Yes (JWT token)  
**Role:** Any authenticated user

**URL Parameters:**
- `farmerId` (integer): ID of farmer from masterlist table

**Success Response (200 OK):**
```json
{
  "success": true,
  "farmer_id": 123,
  "total_distributions": 5,
  "logs": [
    {
      "id": 456,
      "event_date": "2025-11-03",
      "incentive_type": "Rice Seeds 20kg",
      "qty_requested": 20.00,
      "qty_received": 18.00,
      "shortage": 2.00,
      "is_signed": true,
      "note": "Shortage due to high demand",
      "created_at": "2025-11-03T08:30:00Z"
    },
    {
      "id": 455,
      "event_date": "2025-10-15",
      "incentive_type": "Fertilizer 50kg",
      "qty_requested": 50.00,
      "qty_received": 50.00,
      "shortage": 0.00,
      "is_signed": true,
      "note": null,
      "created_at": "2025-10-15T10:15:00Z"
    }
  ]
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Farmer not found in database"
}
```

#### 3. Get LGU Report

**Endpoint:** `GET /api/incentives/report`  
**Auth Required:** Yes (JWT token)  
**Role:** `lgu` or `admin` only

**Query Parameters (Optional):**
- `start_date` (YYYY-MM-DD): Filter from this date
- `end_date` (YYYY-MM-DD): Filter to this date
- `incentive_type` (string): Filter by specific type

**Example Request:**
```
GET /api/incentives/report?start_date=2025-01-01&end_date=2025-12-31&incentive_type=Rice Seeds 20kg
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "period": {
    "start_date": "2025-01-01",
    "end_date": "2025-12-31"
  },
  "summary": {
    "total": 150,
    "fully_fulfilled": 120,
    "partially": 25,
    "unfulfilled": 5,
    "top_shortage": "Rice Seeds 20kg - 45 units short",
    "incentive_breakdown": [
      {
        "incentive_type": "Rice Seeds 20kg",
        "total_distributions": 80,
        "total_requested": 1600.00,
        "total_received": 1555.00,
        "shortage_amount": 45.00,
        "shortage_pct": 2.81
      },
      {
        "incentive_type": "Fertilizer 50kg",
        "total_distributions": 50,
        "total_requested": 2500.00,
        "total_received": 2500.00,
        "shortage_amount": 0.00,
        "shortage_pct": 0.00
      }
    ]
  }
}
```

### Authentication Flow

**1. Login (Existing System):**
```javascript
// User logs in and receives JWT token
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
const { token } = await response.json();
localStorage.setItem('token', token);
```

**2. Making Authenticated Requests:**
```javascript
// API service automatically reads token
const token = localStorage.getItem('token');
const response = await fetch('/api/incentives/log', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});
```

### Error Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| 200 | Success | Data retrieved successfully |
| 201 | Created | New log entry created |
| 400 | Bad Request | Validation errors, invalid data |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User lacks required role |
| 404 | Not Found | Farmer ID or record not found |
| 500 | Server Error | Database or server issues |

---

## Frontend Interactions & Data Flow

### Component Lifecycle & State Management

The frontend uses **React Hooks** for state management and **controlled components** for form handling. Here's how data flows through the system:

```
┌─────────────────────────────────────────────────────────────┐
│                   User Interaction Flow                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: User Types in Search Box                           │
│  ┌──────────────────────────────────────────────┐           │
│  │ <input onChange={e => setSearchQuery(...)} /> │          │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Debounced Search Effect Triggers                   │
│  ┌──────────────────────────────────────────────┐           │
│  │ useEffect(() => {                            │           │
│  │   const timer = setTimeout(() => {           │           │
│  │     searchFarmers(searchQuery);              │           │
│  │   }, 300);                                   │           │
│  │   return () => clearTimeout(timer);          │           │
│  │ }, [searchQuery]);                           │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: API Call via Service Layer                         │
│  ┌──────────────────────────────────────────────┐           │
│  │ const results = await farmerApi.search(q);   │           │
│  │ // GET /api/farmers/search?q=Juan            │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Update Component State                             │
│  ┌──────────────────────────────────────────────┐           │
│  │ setSearchResults(results);                   │           │
│  │ setShowSearchResults(true);                  │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 5: React Re-renders Dropdown                          │
│  ┌──────────────────────────────────────────────┐           │
│  │ {searchResults.map(farmer => (               │           │
│  │   <button onClick={() => select(farmer)}>    │           │
│  │     {farmer.name}                            │           │
│  │   </button>                                  │           │
│  │ ))}                                          │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### IncentiveLogForm: State Management Deep Dive

**State Variables:**

```typescript
// Form data state
const [formData, setFormData] = useState({
    farmer_id: 0,
    farmer_name: '',
    event_date: new Date().toISOString().split('T')[0],
    incentive_type: INCENTIVE_TYPES[0],
    qty_requested: '',
    qty_received: '',
    is_signed: false,
    note: '',
});

// UI state
const [isLoading, setIsLoading] = useState(false);          // Submit button state
const [errors, setErrors] = useState<Record<string, string>>({}); // Validation errors
const [searchQuery, setSearchQuery] = useState('');         // Search input value
const [searchResults, setSearchResults] = useState<FarmerSearchResult[]>([]); // Dropdown options
const [showSearchResults, setShowSearchResults] = useState(false); // Dropdown visibility
const [isSearching, setIsSearching] = useState(false);      // Search loading state
```

**State Update Patterns:**

```typescript
// 1. Simple field update
const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
        ...prev,
        [field]: value
    }));
};

// 2. Complex farmer selection
const handleSelectFarmer = (farmer: FarmerSearchResult) => {
    setFormData(prev => ({
        ...prev,
        farmer_id: farmer.id,
        farmer_name: farmer.name
    }));
    setSearchQuery(`${farmer.name} (${farmer.rsbsa_num})`);
    setShowSearchResults(false);
    setErrors(prev => ({ ...prev, farmer_id: '' })); // Clear error
};

// 3. Form reset after submission
const resetForm = () => {
    setFormData({
        farmer_id: 0,
        farmer_name: '',
        event_date: new Date().toISOString().split('T')[0],
        incentive_type: INCENTIVE_TYPES[0],
        qty_requested: '',
        qty_received: '',
        is_signed: false,
        note: '',
    });
    setSearchQuery('');
    setErrors({});
};
```

### Form Submission Flow

**Complete Submission Process:**

```typescript
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent page reload
    
    // STEP 1: Client-side validation
    if (!validateForm()) {
        toast.error('Please fix the errors in the form');
        return;
    }
    
    // STEP 2: Set loading state
    setIsLoading(true);
    
    try {
        // STEP 3: Prepare request data
        const requestData: CreateIncentiveRequest = {
            farmer_id: formData.farmer_id,
            event_date: formData.event_date,
            incentive_type: formData.incentive_type,
            qty_requested: parseFloat(formData.qty_requested),
            qty_received: parseFloat(formData.qty_received),
            is_signed: formData.is_signed,
            note: formData.note || undefined,
        };
        
        // STEP 4: Call API service
        const response = await incentiveApi.createLog(requestData);
        
        // STEP 5: Handle success
        if (response.success) {
            toast.success(response.message); // Show notification
            resetForm(); // Clear form for next entry
        }
        
    } catch (error: any) {
        // STEP 6: Handle errors
        if (error.errors) {
            // Backend validation errors
            const backendErrors: Record<string, string> = {};
            error.errors.forEach((err: any) => {
                backendErrors[err.field] = err.message;
            });
            setErrors(backendErrors);
            toast.error('Validation failed');
        } else {
            // General errors
            toast.error(error.message || 'Failed to create log');
        }
    } finally {
        // STEP 7: Reset loading state
        setIsLoading(false);
    }
};
```

### Real-Time Validation & User Feedback

**Shortage Calculation (Computed Value):**

```typescript
// Automatically calculates when quantities change
const shortage = formData.qty_requested && formData.qty_received
    ? parseFloat(formData.qty_requested) - parseFloat(formData.qty_received)
    : 0;

// Displayed in UI
{shortage > 0 && formData.qty_requested && formData.qty_received && (
    <Alert variant="warning">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span>Shortage detected: {shortage.toFixed(2)} units short</span>
    </Alert>
)}
```

**Input Validation (On Change):**

```typescript
// Validate as user types
const handleQuantityChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    
    // Real-time validation
    if (field === 'qty_received') {
        const requested = parseFloat(formData.qty_requested);
        if (numValue > requested) {
            setErrors(prev => ({
                ...prev,
                qty_received: 'Cannot exceed requested quantity'
            }));
        } else {
            setErrors(prev => ({
                ...prev,
                qty_received: ''
            }));
        }
    }
    
    setFormData(prev => ({
        ...prev,
        [field]: value
    }));
};
```

### Event Handlers Map

**Complete Event Handler Reference:**

```typescript
// Search handlers
onChange={(e) => setSearchQuery(e.target.value)}  // Triggers debounced search
onClick={() => handleSelectFarmer(farmer)}         // Select from dropdown
onClick={handleClearFarmer}                        // Clear selection

// Form field handlers
onChange={(e) => setFormData({...formData, event_date: e.target.value})}
onChange={(e) => setFormData({...formData, incentive_type: e.target.value})}
onChange={(e) => setFormData({...formData, qty_requested: e.target.value})}
onChange={(e) => setFormData({...formData, qty_received: e.target.value})}
onChange={(e) => setFormData({...formData, is_signed: e.target.checked})}
onChange={(e) => setFormData({...formData, note: e.target.value})}

// Button handlers
onClick={handleSubmit}    // Submit form
onClick={resetForm}       // Reset button
```

### FarmerIncentiveView: Data Fetching Pattern

**Component Initialization:**

```typescript
const FarmerIncentiveView: React.FC<Props> = ({ farmerId, farmerName }) => {
    const [logs, setLogs] = useState<IncentiveLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        incentive_type: ''
    });

    // Load data on mount and when farmerId changes
    useEffect(() => {
        loadFarmerLogs();
    }, [farmerId]);

    const loadFarmerLogs = async () => {
        setIsLoading(true);
        try {
            const response = await incentiveApi.getFarmerLogs(farmerId);
            setLogs(response.logs);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load history');
        } finally {
            setIsLoading(false);
        }
    };
};
```

**Client-Side Filtering:**

```typescript
// Filter logs based on user selections
const filteredLogs = logs.filter(log => {
    // Date range filter
    if (filters.start_date && log.event_date < filters.start_date) {
        return false;
    }
    if (filters.end_date && log.event_date > filters.end_date) {
        return false;
    }
    
    // Type filter
    if (filters.incentive_type && log.incentive_type !== filters.incentive_type) {
        return false;
    }
    
    return true;
});
```

**Conditional Rendering:**

```typescript
// Show different UI based on state
if (isLoading) {
    return <LoadingSpinner size="lg" />;
}

if (filteredLogs.length === 0) {
    return (
        <Alert variant="info">
            <p>No distribution records found</p>
        </Alert>
    );
}

return (
    <div>
        {/* Desktop table */}
        <div className="hidden md:block">
            <table>{/* ... */}</table>
        </div>
        
        {/* Mobile cards */}
        <div className="md:hidden">
            {filteredLogs.map(log => <Card key={log.id}>{/* ... */}</Card>)}
        </div>
    </div>
);
```

### LGUReport: Data Aggregation Flow

**Report Loading with Optional Filters:**

```typescript
const LGUReport: React.FC = () => {
    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        incentive_type: ''
    });

    useEffect(() => {
        loadReport();
    }, []); // Load once on mount

    const loadReport = async () => {
        setIsLoading(true);
        try {
            // Build query params
            const hasFilters = filters.start_date || filters.end_date || filters.incentive_type;
            const queryParams = hasFilters ? filters : undefined;
            
            // Fetch from API
            const response = await incentiveApi.getReport(queryParams);
            setSummary(response.summary);
            setPeriod(response.period);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    // Manual filter application
    const handleApplyFilters = () => {
        loadReport(); // Re-fetch with new filters
    };
};
```

**CSV Export Implementation:**

```typescript
const handleExportCSV = () => {
    if (!summary) return;

    // Transform data for CSV
    const csvData = summary.incentive_breakdown.map(item => ({
        'Incentive Type': item.incentive_type,
        'Total Distributions': item.total_distributions,
        'Total Requested': formatNumber(item.total_requested),
        'Total Received': formatNumber(item.total_received),
        'Shortage Amount': formatNumber(item.shortage_amount),
        'Shortage %': formatNumber(item.shortage_pct) + '%',
    }));

    // Generate CSV file
    const filename = `incentive-report-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(csvData, filename);
    
    // User feedback
    toast.success('Report exported successfully');
};
```

### API Service Layer Architecture

**Service Layer Structure:**

```typescript
// src/services/incentiveApi.ts

const API_URL = import.meta.env.VITE_API_URL;

// Helper to get auth token
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

// Error handling wrapper
const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.json();
        throw error;
    }
    return response.json();
};

// API methods
export const incentiveApi = {
    // POST /api/incentives/log
    createLog: async (data: CreateIncentiveRequest) => {
        const response = await fetch(`${API_URL}/api/incentives/log`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    // GET /api/incentives/farmer/:id
    getFarmerLogs: async (farmerId: number) => {
        const response = await fetch(`${API_URL}/api/incentives/farmer/${farmerId}`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // GET /api/incentives/report
    getReport: async (filters?: ReportFilters) => {
        const queryParams = filters ? new URLSearchParams(filters).toString() : '';
        const url = `${API_URL}/api/incentives/report${queryParams ? '?' + queryParams : ''}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// Farmer search API
export const farmerApi = {
    search: async (query: string) => {
        const response = await fetch(`${API_URL}/api/farmers/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};
```

### Toast Notifications System

**Toast Types & Usage:**

```typescript
import toast from 'react-hot-toast';

// Success notification
toast.success('Distribution log created successfully');

// Error notification
toast.error('Failed to save record');

// Loading notification
const toastId = toast.loading('Saving...');
// Later: toast.dismiss(toastId);

// Custom duration
toast.success('Saved!', { duration: 3000 });

// With icon
toast.success('Success!', {
    icon: '✅',
});
```

**Toaster Configuration:**

```tsx
<Toaster
    position="top-right"
    toastOptions={{
        duration: 4000,  // 4 seconds default
        style: {
            background: '#363636',
            color: '#fff',
        },
        success: {
            duration: 3000,
            iconTheme: {
                primary: '#10b981',  // Green
                secondary: '#fff',
            },
        },
        error: {
            duration: 5000,  // Longer for errors
            iconTheme: {
                primary: '#ef4444',  // Red
                secondary: '#fff',
            },
        },
    }}
/>
```

### Click-Outside Handler Pattern

**Closing Dropdown on Outside Click:**

```typescript
const searchRef = useRef<HTMLDivElement>(null);

useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
            setShowSearchResults(false); // Close dropdown
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

// Usage in JSX
<div ref={searchRef}>
    <input {...props} />
    {showSearchResults && (
        <div className="dropdown">
            {/* Results */}
        </div>
    )}
</div>
```

### Component Communication Patterns

**1. Parent-to-Child (Props):**

```tsx
// Parent passes data down
<FarmerIncentiveView 
    farmerId={123}           // Required prop
    farmerName="Juan"        // Optional prop
/>

// Child receives and uses
const FarmerIncentiveView: React.FC<Props> = ({ farmerId, farmerName }) => {
    // Use farmerId to fetch data
    useEffect(() => {
        loadData(farmerId);
    }, [farmerId]);
};
```

**2. Child-to-Parent (Callbacks):**

```tsx
// Parent defines callback
const ParentComponent = () => {
    const handleSuccess = (id: number) => {
        console.log('Record created:', id);
    };

    return <IncentiveLogForm onSuccess={handleSuccess} />;
};

// Child calls callback
const IncentiveLogForm = ({ onSuccess }) => {
    const handleSubmit = async () => {
        const result = await api.createLog(data);
        onSuccess?.(result.id); // Optional chaining
    };
};
```

**3. Sibling Communication (Shared State):**

```tsx
// Lift state to common parent
const ParentDashboard = () => {
    const [selectedFarmerId, setSelectedFarmerId] = useState(0);

    return (
        <>
            <FarmerSelector 
                onSelect={setSelectedFarmerId} 
            />
            <FarmerIncentiveView 
                farmerId={selectedFarmerId} 
            />
        </>
    );
};
```

### Performance Optimizations

**1. Debounced Search:**

```typescript
useEffect(() => {
    const debounceTimer = setTimeout(() => {
        if (searchQuery.length >= 2) {
            searchFarmers(searchQuery);
        }
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(debounceTimer); // Cleanup
}, [searchQuery]);
```

**2. Memoized Calculations:**

```typescript
import { useMemo } from 'react';

const filteredLogs = useMemo(() => {
    return logs.filter(log => {
        // Expensive filtering logic
        return matchesFilters(log, filters);
    });
}, [logs, filters]); // Only recalculate when these change
```

**3. Conditional API Calls:**

```typescript
// Only fetch if needed
useEffect(() => {
    if (farmerId > 0) { // Check if valid ID
        loadFarmerLogs();
    }
}, [farmerId]);
```

### Error Boundary Pattern

**Graceful Error Handling:**

```tsx
const ComponentWithErrorHandling = () => {
    const [error, setError] = useState<string | null>(null);

    if (error) {
        return (
            <Alert variant="danger">
                <p className="font-medium">Error</p>
                <p className="text-sm mt-1">{error}</p>
                <Button onClick={() => setError(null)} className="mt-2">
                    Try Again
                </Button>
            </Alert>
        );
    }

    return <NormalComponent />;
};
```

### TypeScript Type Safety

**Interface Definitions:**

```typescript
// Request type (what we send)
interface CreateIncentiveRequest {
    farmer_id: number;
    event_date: string;
    incentive_type: string;
    qty_requested: number;
    qty_received: number;
    is_signed: boolean;
    note?: string; // Optional
}

// Response type (what we get back)
interface CreateIncentiveResponse {
    success: boolean;
    id: number;
    shortage: number;
    message: string;
}

// Component props type
interface IncentiveLogFormProps {
    onSuccess?: (id: number) => void;
    initialValues?: Partial<CreateIncentiveRequest>;
}
```

**Type Guards:**

```typescript
// Check if error has specific structure
if (error && typeof error === 'object' && 'errors' in error) {
    // It's a validation error
    const validationError = error as ValidationErrorResponse;
    validationError.errors.forEach(err => {
        console.error(`${err.field}: ${err.message}`);
    });
}
```

---

## Frontend Components

### 1. IncentiveLogForm Component

**File:** `src/components/incentive/IncentiveLogForm.tsx`  
**Purpose:** Encoder form for recording distributions  
**Role Access:** `encoder`, `admin`

**Features:**
- ✅ Debounced farmer search with autocomplete
- ✅ Real-time validation
- ✅ Shortage warning alerts
- ✅ Signature checkbox requirement
- ✅ Form reset after submission
- ✅ Toast notifications

**Key Elements:**

1. **Farmer Search:**
   - Type-ahead search (minimum 2 characters)
   - Searches by name or RSBSA number
   - Displays results in dropdown
   - Auto-fills farmer ID when selected

2. **Date Picker:**
   - Default: Today's date
   - Max: Today (cannot select future dates)
   - Format: YYYY-MM-DD

3. **Incentive Type Dropdown:**
   - Predefined types (Rice Seeds, Fertilizer, etc.)
   - Customizable list in `src/types/incentive.ts`

4. **Quantity Fields:**
   - Requested: Must be > 0
   - Received: Must be >= 0 and <= Requested
   - Shortage auto-calculated and displayed

5. **Signature Checkbox:**
   - Required field
   - Reminds encoder to verify paper receipt
   - Cannot submit without checking

6. **Notes Textarea:**
   - Optional field
   - Max 1000 characters
   - Use for explaining shortages or special circumstances

**Usage Example:**
```tsx
import { IncentiveLogForm } from '../components/incentive/IncentiveLogForm';
import { Toaster } from 'react-hot-toast';

function EncoderPage() {
  return (
    <div>
      <Toaster position="top-right" />
      <IncentiveLogForm />
    </div>
  );
}
```

### 2. FarmerIncentiveView Component

**File:** `src/components/incentive/FarmerIncentiveView.tsx`  
**Purpose:** Display farmer's distribution history  
**Role Access:** All authenticated users

**Props:**
```tsx
interface FarmerIncentiveViewProps {
  farmerId: number;      // Required: ID from masterlist
  farmerName?: string;   // Optional: Display name
}
```

**Features:**
- ✅ Read-only table/card view
- ✅ Status badges (Fully/Partially/Unfulfilled)
- ✅ Date and type filters
- ✅ Responsive design (table on desktop, cards on mobile)
- ✅ No edit/delete functionality

**Status Indicators:**
- 🟢 **Fully Fulfilled** - qty_received = qty_requested
- 🟡 **Partially Fulfilled** - 0 < qty_received < qty_requested
- 🔴 **Unfulfilled** - qty_received = 0

**Usage Example:**
```tsx
import { FarmerIncentiveView } from '../components/incentive/FarmerIncentiveView';

function FarmerDashboard({ userId }) {
  return (
    <FarmerIncentiveView 
      farmerId={userId} 
      farmerName="Juan Dela Cruz" 
    />
  );
}
```

### 3. LGUReport Component

**File:** `src/components/incentive/LGUReport.tsx`  
**Purpose:** Analytics dashboard for LGU staff  
**Role Access:** `lgu`, `admin`

**Features:**
- ✅ Summary statistics cards
- ✅ Breakdown by incentive type
- ✅ Date range filters
- ✅ CSV export functionality
- ✅ Responsive data tables
- ✅ Shortage percentage indicators

**Summary Cards:**
1. **Total Distributions** - Overall count
2. **Fully Fulfilled** - Count + percentage
3. **Partially Fulfilled** - Count + percentage
4. **Unfulfilled** - Count + percentage

**Breakdown Table Columns:**
- Incentive Type
- Total Distributions
- Total Requested (sum)
- Total Received (sum)
- Shortage Amount
- Shortage Percentage

**CSV Export:**
- One-click download
- Includes all visible data
- Filename: `incentive-report-YYYY-MM-DD.csv`

**Usage Example:**
```tsx
import { LGUReport } from '../components/incentive/LGUReport';

function LGUDashboard() {
  return <LGUReport />;
}
```

### 4. UI Components Library

**File:** `src/components/ui/UIComponents.tsx`  
**Purpose:** Reusable styled components

**Available Components:**

1. **Button**
   ```tsx
   <Button variant="primary" onClick={handleClick} isLoading={loading}>
     Submit
   </Button>
   ```
   Variants: `primary`, `secondary`, `success`, `danger`

2. **Input**
   ```tsx
   <Input 
     label="Name" 
     value={value} 
     onChange={handleChange}
     error={errors.name}
     required
   />
   ```

3. **Select**
   ```tsx
   <Select
     label="Type"
     value={value}
     onChange={handleChange}
     options={[{ value: 'a', label: 'Option A' }]}
   />
   ```

4. **Textarea**
   ```tsx
   <Textarea 
     label="Notes" 
     value={notes} 
     onChange={handleChange}
     rows={3}
   />
   ```

5. **Checkbox**
   ```tsx
   <Checkbox 
     label="I agree" 
     checked={agreed} 
     onChange={handleChange}
   />
   ```

6. **Card**
   ```tsx
   <Card title="Title" subtitle="Subtitle">
     Content here
   </Card>
   ```

7. **Badge**
   ```tsx
   <Badge variant="success">Approved</Badge>
   ```
   Variants: `success`, `warning`, `danger`, `info`

8. **Alert**
   ```tsx
   <Alert variant="warning">Warning message</Alert>
   ```

9. **LoadingSpinner**
   ```tsx
   <LoadingSpinner size="lg" />
   ```

---

## User Roles & Permissions

### Role Matrix

| Action | Encoder | Farmer | LGU | Admin |
|--------|---------|--------|-----|-------|
| Create distribution log | ✅ | ❌ | ❌ | ✅ |
| View own history | ✅ | ✅ | ✅ | ✅ |
| View all farmer histories | ✅ | ❌ | ✅ | ✅ |
| View LGU reports | ❌ | ❌ | ✅ | ✅ |
| Export to CSV | ❌ | ❌ | ✅ | ✅ |
| Edit distribution logs | ❌ | ❌ | ❌ | ❌ |
| Delete distribution logs | ❌ | ❌ | ❌ | ❌ |

### Role Descriptions

**1. Encoder**
- **Who:** Municipal agriculture office staff
- **Responsibility:** Record distributions from paper receipts
- **Access:**
  - Create new distribution logs
  - Search and select farmers
  - View farmer histories (for reference)
- **Typical Tasks:**
  - Daily: Record 10-50 distributions
  - Verify paper receipts have signatures
  - Note any shortages or issues

**2. Farmer**
- **Who:** Registered farmers in the municipality
- **Responsibility:** View their own distribution history
- **Access:**
  - Read-only view of personal records
  - Cannot edit or request new distributions
- **Typical Use:**
  - Check what incentives received this year
  - Verify distribution dates and amounts

**3. LGU (Local Government Unit)**
- **Who:** Municipal agriculture officer, planning staff
- **Responsibility:** Monitor program effectiveness
- **Access:**
  - Summary dashboard with statistics
  - Filter reports by date, type
  - Export data for further analysis
- **Typical Tasks:**
  - Weekly: Review distribution summary
  - Monthly: Generate reports for mayor's office
  - Quarterly: Identify shortage trends

**4. Admin**
- **Who:** System administrator, IT staff
- **Responsibility:** Full system access
- **Access:**
  - All encoder + LGU permissions
  - User management (if implemented)
  - System configuration
- **Typical Tasks:**
  - Setup: Configure incentive types
  - Maintenance: Backup database
  - Support: Assist encoders with issues

---

## Complete Workflow

### Scenario: Recording a Distribution Event

**Step 1: Physical Distribution (Offline)**
```
┌─────────────────────────────────────────────────┐
│  Municipal Agriculture Office - Physical Event  │
├─────────────────────────────────────────────────┤
│  1. Farmer arrives with request letter          │
│  2. Staff checks available stock                │
│  3. Staff prepares incentive (20kg rice seeds)  │
│  4. Farmer receives 18kg (2kg short)            │
│  5. Staff prepares paper receipt                │
│  6. Farmer signs paper receipt                  │
│  7. Farmer takes home 18kg of seeds             │
└─────────────────────────────────────────────────┘
```

**Step 2: Encoder Logs Into System**
```javascript
// User navigates to /jo-incentives page
// IncentiveLogForm component loads
```

**Step 3: Encoder Searches for Farmer**
```
┌─────────────────────────────────────────────────┐
│  Search: "Juan Dela Cruz"                       │
├─────────────────────────────────────────────────┤
│  Results:                                       │
│  ✓ Juan Dela Cruz (RSBSA: 01-001-0001)         │
│    Barangay Poblacion                           │
│                                                 │
│  → Encoder clicks to select                     │
└─────────────────────────────────────────────────┘
```

**Step 4: Encoder Fills Form**
```javascript
{
  farmer_id: 123,              // Auto-filled from search
  farmer_name: "Juan Dela Cruz", // Auto-filled
  event_date: "2025-11-03",    // Today (default)
  incentive_type: "Rice Seeds 20kg", // Selected from dropdown
  qty_requested: 20.00,        // From paper receipt
  qty_received: 18.00,         // From paper receipt
  is_signed: true,             // Checked (verified paper)
  note: "Shortage due to high demand in barangay"
}
```

**Step 5: System Validates**
```javascript
// Frontend validation
✓ Farmer selected
✓ Date is today or past
✓ Quantities are valid (18 <= 20)
✓ Signature checkbox checked

// Backend validation (on submit)
✓ Farmer exists in database
✓ User has encoder role
✓ JWT token valid
✓ All constraints satisfied
```

**Step 6: Shortage Warning Appears**
```
┌─────────────────────────────────────────────────┐
│  ⚠️ Shortage detected: 2.00 units short         │
└─────────────────────────────────────────────────┘
```

**Step 7: Encoder Submits**
```javascript
// POST /api/incentives/log
→ Request sent to backend
→ Service validates data
→ Record inserted into database
→ Response: { success: true, id: 456 }
```

**Step 8: Success Notification**
```
┌─────────────────────────────────────────────────┐
│  ✅ Distribution log created successfully       │
└─────────────────────────────────────────────────┘
```

**Step 9: Form Resets**
```javascript
// Ready for next farmer
// All fields cleared
// Encoder can continue recording
```

### Farmer Views Their History

**Step 1: Farmer Logs In**
```javascript
// Navigates to their dashboard
// FarmerIncentiveView loads with their farmer_id
```

**Step 2: System Fetches History**
```javascript
// GET /api/incentives/farmer/123
→ Returns all distributions for this farmer
→ Sorted by event_date (newest first)
```

**Step 3: Farmer Sees Table**
```
┌──────────────────────────────────────────────────────────────┐
│  Your Incentive Distribution History                         │
├──────────────────────────────────────────────────────────────┤
│  Date       Type              Req    Rec    Status           │
│  2025-11-03 Rice Seeds 20kg   20.00  18.00  🟡 Partial       │
│  2025-10-15 Fertilizer 50kg   50.00  50.00  🟢 Fully         │
│  2025-09-01 Corn Seeds 10kg   10.00  10.00  🟢 Fully         │
└──────────────────────────────────────────────────────────────┘
```

**Step 4: Farmer Can Filter**
```javascript
// Filter by date range
// Filter by incentive type
// Results update dynamically
```

### LGU Staff Generates Report

**Step 1: Navigate to Reports**
```javascript
// LGU staff clicks "Reports" in navigation
// LGUReport component loads
```

**Step 2: System Fetches Summary**
```javascript
// GET /api/incentives/report
→ Calculates statistics
→ Groups by incentive type
→ Returns aggregated data
```

**Step 3: Dashboard Displays**
```
┌────────────────────────────────────────────────────────┐
│  Incentive Distribution Report - All Time              │
├────────────────────────────────────────────────────────┤
│  📊 Total: 150    ✅ Fully: 120    🟡 Partial: 25     │
│  🔴 Unfulfilled: 5                                     │
├────────────────────────────────────────────────────────┤
│  Breakdown by Type:                                    │
│  • Rice Seeds 20kg: 80 dist, 2.81% shortage           │
│  • Fertilizer 50kg: 50 dist, 0.00% shortage           │
│  • Corn Seeds 10kg: 20 dist, 5.00% shortage           │
└────────────────────────────────────────────────────────┘
```

**Step 4: Apply Filters (Optional)**
```javascript
{
  start_date: "2025-01-01",
  end_date: "2025-11-03",
  incentive_type: "Rice Seeds 20kg"
}
// Dashboard updates with filtered data
```

**Step 5: Export to CSV**
```javascript
// Click "Export to CSV" button
→ Generates CSV file
→ Downloads: incentive-report-2025-11-03.csv
→ Can open in Excel for further analysis
```

---

## Installation & Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn
- Git (for version control)

### Backend Setup

**1. Install Dependencies**
```bash
cd backend
npm install express pg jsonwebtoken bcrypt dotenv cors
npm install --save-dev typescript @types/node @types/express @types/pg ts-node nodemon
```

**2. Configure Environment**
```bash
# Create .env file
touch .env

# Add these variables:
DATABASE_URL=postgresql://username:password@localhost:5432/your_database
JWT_SECRET=your-super-secret-key-change-this-in-production
PORT=3001
NODE_ENV=development
```

**3. Create Database Schema**
```bash
# Run SQL script
psql -U username -d your_database -f ../database/incentive_distribution_log.sql
```

**4. Start Backend Server**
```bash
# Development mode (auto-restart)
npx nodemon backend/incentive-server.ts

# Production mode
npx ts-node backend/incentive-server.ts
```

**5. Verify Backend**
```bash
# Test health endpoint
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Frontend Setup

**1. Install Dependencies**
```bash
# From project root
npm install react-hot-toast lucide-react

# Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer @tailwindcss/postcss
```

**2. Configure Tailwind**
```bash
# Generate config files
npx tailwindcss init -p

# Edit tailwind.config.js
content: [
  "./index.html",
  "./src/**/*.{js,ts,jsx,tsx}",
]
```

**3. Update PostCSS Config**
```javascript
// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

**4. Create Tailwind CSS File**
```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**5. Import in Main File**
```tsx
// src/index.tsx
import './index.css'; // Add this line
```

**6. Configure API URL**
```bash
# Create or update .env file in project root
VITE_API_URL=http://localhost:3001
```

**7. Copy Component Files**
```bash
# Ensure these files exist:
src/types/incentive.ts
src/services/incentiveApi.ts
src/components/ui/UIComponents.tsx
src/components/incentive/IncentiveLogForm.tsx
src/components/incentive/FarmerIncentiveView.tsx
src/components/incentive/LGUReport.tsx
```

**8. Start Frontend**
```bash
npm run dev
# Opens at http://localhost:5173 or 5174
```

### Integration into Existing App

**Add to your page:**
```tsx
// src/screens/JO/JoIncentives.tsx
import { IncentiveLogForm } from '../../components/incentive/IncentiveLogForm';
import { Toaster } from 'react-hot-toast';

const JoIncentives: React.FC = () => {
  return (
    <div className="main-content">
      <Toaster position="top-right" />
      <IncentiveLogForm />
    </div>
  );
};
```

---

## Usage Examples

### Example 1: Basic Form Submission

```tsx
import { IncentiveLogForm } from './components/incentive/IncentiveLogForm';
import { Toaster } from 'react-hot-toast';

function EncoderDashboard() {
  return (
    <div>
      <Toaster position="top-right" />
      <h1>Record Distribution</h1>
      <IncentiveLogForm />
    </div>
  );
}
```

### Example 2: Farmer History with Custom Styling

```tsx
import { FarmerIncentiveView } from './components/incentive/FarmerIncentiveView';

function MyFarmerPage() {
  const userId = 123; // From auth context
  const userName = "Juan Dela Cruz";

  return (
    <div className="custom-wrapper">
      <div className="header">
        <h1>Welcome, {userName}</h1>
      </div>
      <FarmerIncentiveView 
        farmerId={userId} 
        farmerName={userName}
      />
    </div>
  );
}
```

### Example 3: LGU Report with Sidebar

```tsx
import { LGUReport } from './components/incentive/LGUReport';

function AdminDashboard() {
  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        {/* Your sidebar navigation */}
      </aside>
      <main className="content">
        <LGUReport />
      </main>
    </div>
  );
}
```

### Example 4: Role-Based Rendering

```tsx
function IncentivePage({ userRole, userId }) {
  switch (userRole) {
    case 'encoder':
      return <IncentiveLogForm />;
    
    case 'farmer':
      return <FarmerIncentiveView farmerId={userId} />;
    
    case 'lgu':
      return <LGUReport />;
    
    default:
      return <div>Access Denied</div>;
  }
}
```

---

## API Integration

### Using the API Service

**All API calls go through `incentiveApi.ts`:**

```typescript
import { incentiveApi, farmerApi } from './services/incentiveApi';

// Example 1: Create log
try {
  const result = await incentiveApi.createLog({
    farmer_id: 123,
    event_date: '2025-11-03',
    incentive_type: 'Rice Seeds 20kg',
    qty_requested: 20.00,
    qty_received: 18.00,
    is_signed: true,
    note: 'Partial fulfillment'
  });
  console.log('Created:', result.id);
} catch (error) {
  console.error('Failed:', error.message);
}

// Example 2: Search farmers
const farmers = await farmerApi.search('Juan');

// Example 3: Get history
const logs = await incentiveApi.getFarmerLogs(123);

// Example 4: Get report
const report = await incentiveApi.getReport({
  start_date: '2025-01-01',
  end_date: '2025-12-31'
});
```

### Custom API Calls

**If you need to make custom calls:**

```typescript
const token = localStorage.getItem('token');

const response = await fetch(`${import.meta.env.VITE_API_URL}/api/incentives/log`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Request failed');
}

const result = await response.json();
```

### Error Handling Pattern

```typescript
try {
  const result = await incentiveApi.createLog(data);
  toast.success('Record created successfully');
  // Handle success
} catch (error) {
  if (error.errors) {
    // Validation errors
    error.errors.forEach(err => {
      console.error(`${err.field}: ${err.message}`);
    });
    toast.error('Please fix validation errors');
  } else {
    // General errors
    toast.error(error.message || 'Something went wrong');
  }
}
```

---

## Troubleshooting

### Common Issues

**1. "Cannot connect to API"**
```
Problem: Frontend can't reach backend
Solution:
  - Check backend server is running (npm run dev or ts-node)
  - Verify VITE_API_URL in .env matches backend port
  - Check for CORS errors in browser console
  - Ensure backend has cors() middleware enabled
```

**2. "Farmer not found"**
```
Problem: Selected farmer doesn't exist in masterlist
Solution:
  - Verify farmer exists: SELECT * FROM masterlist WHERE id = X;
  - Check farmer_id is correct integer
  - Ensure masterlist table has data
```

**3. "JWT token invalid"**
```
Problem: Authentication failed
Solution:
  - Check localStorage has 'token' key
  - Verify JWT_SECRET matches between frontend/backend
  - Re-login to get fresh token
  - Check token hasn't expired
```

**4. "Signature required" error**
```
Problem: Cannot submit without signature
Solution:
  - Check the "Farmer has signed" checkbox
  - This is intentional - verifies paper receipt
  - If testing, must check the box (required field)
```

**5. "Shortage cannot be negative"**
```
Problem: qty_received > qty_requested
Solution:
  - Ensure Received <= Requested
  - Fix values before submitting
  - Validate input fields
```

**6. "Tailwind styles not working"**
```
Problem: Components look unstyled
Solution:
  - Install @tailwindcss/postcss
  - Update postcss.config.js
  - Import index.css in main.tsx
  - Restart dev server (npm run dev)
```

**7. "Database constraint violation"**
```
Problem: SQL error when inserting
Solution:
  - Check all NOT NULL fields have values
  - Verify foreign keys (farmer_id, encoded_by) exist
  - Ensure CHECK constraints satisfied
  - Review database logs for specific error
```

### Debug Checklist

```markdown
Backend Issues:
□ Server running on correct port (3001)?
□ Database connection successful?
□ .env file configured properly?
□ JWT_SECRET set?
□ Database tables exist?
□ Sample data in masterlist table?

Frontend Issues:
□ Tailwind CSS installed and configured?
□ VITE_API_URL set in .env?
□ Components imported correctly?
□ Toaster component included?
□ No TypeScript errors?
□ Browser console clear of errors?

Authentication Issues:
□ User logged in?
□ Token stored in localStorage?
□ Token not expired?
□ User has correct role?
□ Auth middleware enabled on routes?
```

---

## Best Practices

### Data Entry

1. **Always Verify Paper Receipts**
   - Check farmer signature before encoding
   - Verify quantities match paper record
   - Note any discrepancies

2. **Use Consistent Naming**
   - Standardize incentive type names
   - Don't use variations ("Rice Seeds 20kg" vs "20kg Rice Seeds")
   - Maintain incentive type list

3. **Add Meaningful Notes**
   - Explain shortages ("High demand", "Late delivery")
   - Mention special circumstances
   - Keep notes concise but informative

### Performance

1. **Database Indexing**
   - Keep indexes on farmer_id, event_date
   - Monitor query performance
   - Use EXPLAIN ANALYZE for slow queries

2. **API Response Size**
   - Paginate large result sets if needed
   - Use date filters for reports
   - Cache frequently accessed data

3. **Frontend Optimization**
   - Debounce search inputs (already implemented)
   - Lazy load large tables
   - Use React.memo for expensive components

### Security

1. **Never Store Passwords in Plain Text**
   - Use bcrypt for password hashing
   - Minimum 10 salt rounds

2. **Validate All Input**
   - Frontend validation (user experience)
   - Backend validation (security)
   - Never trust client-side data

3. **Use HTTPS in Production**
   - SSL certificate for backend
   - Secure cookie settings
   - CORS properly configured

4. **Protect JWT Tokens**
   - Store in httpOnly cookies (best) or localStorage
   - Set reasonable expiration (1-24 hours)
   - Implement token refresh if needed

### Maintenance

1. **Regular Backups**
   ```bash
   # Daily database backup
   pg_dump -U username database_name > backup_$(date +%Y%m%d).sql
   ```

2. **Monitor Logs**
   - Check backend error logs
   - Review database query logs
   - Track failed API requests

3. **Update Dependencies**
   ```bash
   # Check for updates
   npm outdated
   
   # Update packages
   npm update
   ```

4. **Data Cleanup**
   ```sql
   -- Archive old records (optional)
   -- Keep last 5 years for reporting
   DELETE FROM incentive_distribution_log 
   WHERE event_date < CURRENT_DATE - INTERVAL '5 years';
   ```

---

## Appendix

### Incentive Types Reference

Default types (customizable in `src/types/incentive.ts`):

```typescript
export const INCENTIVE_TYPES: string[] = [
    'Rice Seeds 20kg',
    'Corn Seeds 10kg',
    'Fertilizer 50kg',
    'Organic Fertilizer 25kg',
    'Bio-Fertilizer 10L',
    'Pesticide 1L',
    'Herbicide 1L',
    'Farm Tools',
    'Other'
];
```

### Database Queries Reference

**Common Queries:**

```sql
-- Total distributions
SELECT COUNT(*) FROM incentive_distribution_log;

-- Distributions by farmer
SELECT * FROM incentive_distribution_log 
WHERE farmer_id = 123 
ORDER BY event_date DESC;

-- Shortage summary
SELECT 
    incentive_type,
    COUNT(*) as distributions,
    SUM(shortage) as total_shortage,
    AVG(shortage) as avg_shortage
FROM incentive_distribution_log
WHERE shortage > 0
GROUP BY incentive_type
ORDER BY total_shortage DESC;

-- Monthly distribution count
SELECT 
    DATE_TRUNC('month', event_date) as month,
    COUNT(*) as distributions
FROM incentive_distribution_log
GROUP BY month
ORDER BY month DESC;

-- Top farmers by distributions received
SELECT 
    m.first_name || ' ' || m.last_name as farmer_name,
    COUNT(i.id) as total_distributions,
    SUM(i.qty_received) as total_received
FROM incentive_distribution_log i
JOIN masterlist m ON i.farmer_id = m.id
GROUP BY m.id, farmer_name
ORDER BY total_distributions DESC
LIMIT 10;
```

### File Structure Reference

```
project-root/
├── backend/
│   ├── incentive-server.ts           # Main server file
│   ├── types/
│   │   └── incentive.types.ts        # TypeScript interfaces
│   ├── services/
│   │   └── incentive.service.ts      # Business logic
│   ├── controllers/
│   │   └── incentive.controller.ts   # HTTP handlers
│   ├── routes/
│   │   └── incentive.routes.ts       # Route definitions
│   └── middleware/
│       └── auth.middleware.ts        # JWT auth
│
├── database/
│   ├── incentive_distribution_log.sql # Main schema
│   └── create_users_table.sql        # Users table
│
├── src/
│   ├── types/
│   │   └── incentive.ts              # Frontend types
│   ├── services/
│   │   └── incentiveApi.ts           # API service layer
│   ├── components/
│   │   ├── ui/
│   │   │   └── UIComponents.tsx      # Reusable UI
│   │   └── incentive/
│   │       ├── IncentiveLogForm.tsx  # Encoder form
│   │       ├── FarmerIncentiveView.tsx # History view
│   │       └── LGUReport.tsx         # Reports
│   └── screens/
│       └── JO/
│           └── JoIncentives.tsx      # Integration page
│
├── .env                              # Environment config
├── tailwind.config.js                # Tailwind CSS config
├── postcss.config.js                 # PostCSS config
└── package.json                      # Dependencies
```

---

## Support & Resources

### Documentation Files

- `INCENTIVE_SETUP_GUIDE.md` - Initial setup instructions
- `INCENTIVE_README.md` - Quick start guide
- `FRONTEND_SETUP_GUIDE.md` - Frontend installation
- `SQL_ERROR_TROUBLESHOOTING.md` - Database issues
- `QUICK_REFERENCE.js` - Code snippets

### Key Contacts

- **System Developer:** [Your Contact Info]
- **Database Admin:** [DBA Contact]
- **Municipal Agriculture Office:** [Office Contact]

### Change Log

**Version 1.0 (November 3, 2025)**
- Initial implementation
- Three main components (Form, View, Report)
- Full API backend
- Database schema with indexes
- Tailwind CSS styling
- Role-based access control

---

**End of Guide**

For questions or issues, please refer to the troubleshooting section or contact your system administrator.
