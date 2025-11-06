# Incentive Distribution API Documentation

## Overview
Municipal-only incentive tracking system for recording physical seed distribution events.

**NO online requests, approvals, printing, or stock management.**

---

## Authentication

All endpoints require JWT authentication:

```http
Authorization: Bearer <your-jwt-token>
```

### Roles
- **encoder**: Can create distribution logs
- **farmer**: Can view own logs only
- **lgu**: Can view all logs and generate reports
- **admin**: Full access

---

## Endpoints

### 1. Create Distribution Log

**POST** `/api/incentives/log`

**Role Required:** `encoder` or `admin`

#### Request Body
```json
{
  "farmer_id": 101,
  "event_date": "2025-01-15",
  "incentive_type": "Rice Seeds 20kg",
  "qty_requested": 20.00,
  "qty_received": 20.00,
  "is_signed": true,
  "note": "Fully fulfilled"
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "id": 1,
  "shortage": 0,
  "message": "Distribution recorded successfully - fully fulfilled"
}
```

#### Success with Shortage (201 Created)
```json
{
  "success": true,
  "id": 2,
  "shortage": 5.00,
  "message": "Distribution recorded with shortage of 5.00 units"
}
```

#### Validation Error (400 Bad Request)
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "field": "is_signed",
      "message": "Must be true. Farmer signature required before recording."
    },
    {
      "field": "qty_received",
      "message": "Cannot exceed qty_requested"
    }
  ]
}
```

#### Not Found (404)
```json
{
  "success": false,
  "error": "Farmer with ID 999 not found"
}
```

#### Unauthorized (401)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

#### Forbidden (403)
```json
{
  "success": false,
  "error": "Only encoders can create distribution logs"
}
```

---

### 2. Get Farmer Logs

**GET** `/api/incentives/farmer/:id`

**Role Required:** `encoder`, `farmer` (own data), `lgu`, `admin`

#### URL Parameters
- `id`: Farmer ID (integer)

#### Query Parameters (Optional)
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `incentive_type`: Filter by type

#### Example Request
```http
GET /api/incentives/farmer/101?start_date=2025-01-01&end_date=2025-03-31
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "farmer_id": 101,
  "total_distributions": 3,
  "logs": [
    {
      "id": 12,
      "event_date": "2025-02-10",
      "incentive_type": "Fertilizer 50kg",
      "qty_requested": 50.00,
      "qty_received": 50.00,
      "shortage": 0,
      "is_signed": true,
      "note": null,
      "created_at": "2025-02-10T09:30:00.000Z"
    },
    {
      "id": 5,
      "event_date": "2025-01-20",
      "incentive_type": "Rice Seeds 20kg",
      "qty_requested": 20.00,
      "qty_received": 15.00,
      "shortage": 5.00,
      "is_signed": true,
      "note": "Shortage: only 15kg available",
      "created_at": "2025-01-20T14:15:00.000Z"
    },
    {
      "id": 1,
      "event_date": "2025-01-15",
      "incentive_type": "Rice Seeds 20kg",
      "qty_requested": 20.00,
      "qty_received": 20.00,
      "shortage": 0,
      "is_signed": true,
      "note": "Fully fulfilled",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

#### Empty Result (200 OK)
```json
{
  "success": true,
  "farmer_id": 101,
  "total_distributions": 0,
  "logs": []
}
```

#### Forbidden (403) - Farmer viewing another's data
```json
{
  "success": false,
  "error": "You can only view your own distribution logs"
}
```

---

### 3. Get Report (Summary Statistics)

**GET** `/api/incentives/report`

**Role Required:** `lgu` or `admin`

#### Query Parameters (Optional)
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `incentive_type`: Filter by type

#### Example Request
```http
GET /api/incentives/report?start_date=2025-01-01&end_date=2025-01-31
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "period": {
    "start_date": "2025-01-01",
    "end_date": "2025-01-31"
  },
  "summary": {
    "total": 1240,
    "fully_fulfilled": 842,
    "partially": 350,
    "unfulfilled": 48,
    "top_shortage": "Rice Seeds 20kg (-28.5%)",
    "incentive_breakdown": [
      {
        "incentive_type": "Rice Seeds 20kg",
        "total_distributions": 450,
        "total_requested": 9000.00,
        "total_received": 6435.00,
        "shortage_amount": 2565.00,
        "shortage_pct": 28.5
      },
      {
        "incentive_type": "Corn Seeds 10kg",
        "total_distributions": 320,
        "total_requested": 3200.00,
        "total_received": 2720.00,
        "shortage_amount": 480.00,
        "shortage_pct": 15.0
      },
      {
        "incentive_type": "Fertilizer 50kg",
        "total_distributions": 470,
        "total_requested": 23500.00,
        "total_received": 23200.00,
        "shortage_amount": 300.00,
        "shortage_pct": 1.28
      }
    ]
  }
}
```

#### All Time Report (No Date Filter)
```http
GET /api/incentives/report
```

```json
{
  "success": true,
  "period": {
    "start_date": null,
    "end_date": null
  },
  "summary": {
    "total": 4532,
    "fully_fulfilled": 3120,
    "partially": 1280,
    "unfulfilled": 132,
    "top_shortage": "Rice Seeds 20kg (-32.1%)",
    "incentive_breakdown": [...]
  }
}
```

#### Forbidden (403)
```json
{
  "success": false,
  "error": "Only LGU staff can access reports"
}
```

---

## Validation Rules

### Create Log Endpoint

| Field | Rules |
|-------|-------|
| `farmer_id` | Required, positive integer, must exist in masterlist |
| `event_date` | Required, YYYY-MM-DD format, cannot be future date |
| `incentive_type` | Required, 1-100 characters |
| `qty_requested` | Required, must be > 0 |
| `qty_received` | Required, must be >= 0 and <= qty_requested |
| `is_signed` | **Must be true** (farmer signature required) |
| `note` | Optional, max 1000 characters |

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation errors) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |

---

## cURL Examples

### Create Log Entry
```bash
curl -X POST https://api.example.com/api/incentives/log \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "farmer_id": 101,
    "event_date": "2025-01-15",
    "incentive_type": "Rice Seeds 20kg",
    "qty_requested": 20.00,
    "qty_received": 15.00,
    "is_signed": true,
    "note": "Shortage due to high demand"
  }'
```

### Get Farmer Logs
```bash
curl -X GET "https://api.example.com/api/incentives/farmer/101?start_date=2025-01-01" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Get Report
```bash
curl -X GET "https://api.example.com/api/incentives/report?start_date=2025-01-01&end_date=2025-01-31" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## JavaScript/TypeScript Example

```typescript
import axios from 'axios';

const API_BASE = 'https://api.example.com/api/incentives';
const TOKEN = 'your-jwt-token';

// Create distribution log
async function createLog() {
  try {
    const response = await axios.post(
      `${API_BASE}/log`,
      {
        farmer_id: 101,
        event_date: '2025-01-15',
        incentive_type: 'Rice Seeds 20kg',
        qty_requested: 20.00,
        qty_received: 15.00,
        is_signed: true,
        note: 'Partial fulfillment'
      },
      {
        headers: { Authorization: `Bearer ${TOKEN}` }
      }
    );
    console.log('Created:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Get farmer logs
async function getFarmerLogs(farmerId: number) {
  const response = await axios.get(
    `${API_BASE}/farmer/${farmerId}`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
      params: {
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      }
    }
  );
  return response.data;
}

// Get report
async function getReport() {
  const response = await axios.get(
    `${API_BASE}/report`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
      params: {
        start_date: '2025-01-01',
        end_date: '2025-01-31'
      }
    }
  );
  return response.data;
}
```

---

## Database Constraints

The system enforces these constraints at the database level:

1. **Foreign Key Constraints**
   - `farmer_id` must exist in `masterlist`
   - `encoder_id` must exist in `users`

2. **Check Constraints**
   - `qty_requested > 0`
   - `qty_received >= 0`
   - `qty_received <= qty_requested`
   - `is_signed = true` (REQUIRED)

3. **Indexes**
   - `farmer_id`, `event_date`, `incentive_type`, `encoder_id`
   - Composite index on `(farmer_id, event_date)`

---

## Integration Steps

1. **Run SQL Schema**
   ```bash
   psql -U your_user -d your_db -f database/incentive_distribution_log.sql
   ```

2. **Install Dependencies**
   ```bash
   cd backend
   npm install express pg jsonwebtoken
   npm install --save-dev @types/express @types/node @types/pg @types/jsonwebtoken
   ```

3. **Add Routes to Server**
   ```typescript
   // In your server.ts
   import { createIncentiveRoutes } from './routes/incentive.routes';
   import { pool } from './config/database';
   
   app.use('/api/incentives', createIncentiveRoutes(pool));
   ```

4. **Set Environment Variables**
   ```env
   JWT_SECRET=your-secret-key
   DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
   ```

---

## Notes

- **NO file uploads** - removed all multer/photo handling
- **NO approval workflow** - records only
- **NO stock deduction** - simple logging
- **NO printing** - use your own reporting tools
- **Signature required** - `is_signed` must be `true`
