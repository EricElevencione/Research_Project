# Agricultural Input Distribution Management System
## Implementation Guide

This system helps DA/JO fairly distribute fertilizers and seeds when supply is limited.

---

## ✅ COMPLETED COMPONENTS

### 1. Database Schema (`database/create_distribution_system.sql`)
**Tables Created:**
- `regional_allocations` - Tracks what Regional Office provides
- `farmer_requests` - Individual farmer requests with priority scores
- `distribution_records` - Actual distribution tracking
- `priority_configurations` - Customizable priority weights

**Run this SQL file in PostgreSQL to create the tables.**

### 2. Backend API Endpoints (`backend/server.cjs`)
**Endpoints Added:**

**Regional Allocations:**
- `GET /api/distribution/allocations` - Get all allocations
- `GET /api/distribution/allocations/:season` - Get specific season
- `POST /api/distribution/allocations` - Create/update allocation

**Farmer Requests:**
- `GET /api/distribution/requests/:season` - Get all requests for season
- `POST /api/distribution/requests` - Create new request
- `PUT /api/distribution/requests/:id` - Update request
- `DELETE /api/distribution/requests/:id` - Delete request

**Prioritization:**
- `POST /api/distribution/calculate-priorities/:season` - Calculate priority scores

**Gap Analysis:**
- `GET /api/distribution/gap-analysis/:season` - Compare estimated vs allocated vs requested

**Distribution Records:**
- `POST /api/distribution/records` - Record distribution
- `GET /api/distribution/records/:season` - Get distribution history

### 3. Frontend Page (`src/screens/JO/JoRegionalAllocation.tsx`)
**Features:**
- Input form for fertilizer allocations (6 types)
- Input form for seed allocations (6 types)
- Auto-calculates totals
- Saves to database
- Loads existing allocations

---

## 🚧 REMAINING TASKS

### Task 1: Add Route to index.tsx
Add this import:
```typescript
import JoRegionalAllocation from './screens/JO/JoRegionalAllocation';
```

Add this route inside `<Routes>`:
```typescript
<Route path="/jo-regional-allocation" element={<JoRegionalAllocation />} />
```

### Task 2: Create Gap Analysis Dashboard Page
Create `src/screens/JO/JoGapAnalysis.tsx` - shows:
- Estimated needs (calculated from farmer data)
- Available supply (from regional allocation)
- Actual requests (from farmer request slips)
- Visual comparison with color coding (red=shortage, green=surplus)

### Task 3: Create Farmer Request Management Page
Create `src/screens/JO/JoFarmerRequests.tsx` - features:
- Form to add farmer requests
- List of all requests with priority scores
- Filter by status (pending/approved/distributed)
- Sort by priority rank
- Bulk actions (approve, waitlist, reject)

### Task 4: Create Distribution Dashboard
Create `src/screens/JO/JoDistributionDashboard.tsx` - shows:
- Current season overview
- Total requests vs available supply
- Priority distribution chart
- Recent distributions
- Quick actions (calculate priorities, approve requests)

### Task 5: Add Navigation
Update all JO pages (Dashboard, Incentives, RSBSA, etc.) to add:
```typescript
<div
    className={`sidebar-nav-item ${isActive('/jo-distribution-dashboard') ? 'active' : ''}`}
    onClick={() => navigate('/jo-distribution-dashboard')}
>
    <div className="nav-icon">
        <img src={DistributionIcon} alt="Distribution" />
    </div>
    <span className="nav-text">Distribution System</span>
</div>
```

---

## 📊 SYSTEM WORKFLOW

### Phase 1: Regional Allocation Input ✅ DONE
1. JO receives fertilizer/seeds from Regional Office
2. JO opens "Regional Allocation" page
3. JO enters quantities by type
4. System saves to `regional_allocations` table

### Phase 2: Farmer Request Collection (TO DO)
1. JO/Tech collects paper request slips from farmers
2. JO opens "Farmer Requests" page
3. JO enters each request:
   - Farmer name (auto-complete from RSBSA)
   - Farm area
   - Crop type
   - Fertilizer needed: YES/NO
   - Seeds needed: YES/NO
4. System saves to `farmer_requests` table

### Phase 3: Gap Analysis (TO DO)
1. JO opens "Gap Analysis" page
2. System calculates:
   - Estimated needs (area × standard rates)
   - Available supply (from regional allocation)
   - Actual requests (from farmer requests)
3. System shows comparison with visual indicators
4. If shortage exists → Trigger prioritization

### Phase 4: Prioritization (BACKEND DONE, FRONTEND TO DO)
1. JO clicks "Calculate Priorities" button
2. System ranks farmers based on:
   - Farm size (smaller = higher priority)
   - Ownership type (tenant/lessee = higher)
   - Historical assistance (less = higher)
   - Location (remote = higher)
   - Crop type (food security = higher)
3. System assigns priority scores (0-100)
4. System assigns ranks (1, 2, 3...)
5. JO reviews ranked list and approves top farmers

### Phase 5: Distribution & Tracking (TO DO)
1. Approved farmers receive vouchers
2. Farmers claim at distribution center
3. JO scans voucher and records:
   - What was given (type + quantity)
   - Farmer signature
   - Date/time
4. System updates inventory
5. System marks request as "distributed"

---

## 🎓 RESEARCH CONTRIBUTION

### Title Suggestion:
**"Multi-Criteria Prioritization System for Equitable Agricultural Input Distribution Under Supply Constraints"**

### Key Innovation:
1. **Fair Distribution Algorithm**: Prioritizes vulnerable farmers (small-scale, tenants, remote areas)
2. **Gap Analysis**: Compares estimated needs vs available supply
3. **Transparent Decision-Making**: Clear priority scores and criteria
4. **Acceptance Tracking**: Records farmer choices (accept/reject alternatives)
5. **Historical Learning**: Builds data for future seasons

### Methodology:
- Priority Score = Weighted sum of multiple criteria
- Configurable weights (can be tuned for research)
- Real-world testing with actual DA data
- Equity analysis (did small farmers get priority?)

---

## 🔧 NEXT STEPS

1. **Run SQL file** in PostgreSQL to create tables
2. **Test Regional Allocation page**:
   - Navigate to `/jo-regional-allocation`
   - Enter sample data
   - Check if it saves successfully
3. **Create remaining pages** (Gap Analysis, Farmer Requests, Dashboard)
4. **Test full workflow** with sample data
5. **Deploy and collect real data** for research

---

## 📞 API TESTING

Test endpoints using Postman or curl:

```bash
# Create allocation
curl -X POST http://localhost:5000/api/distribution/allocations \
  -H "Content-Type: application/json" \
  -d '{
    "season": "dry_2025",
    "allocation_date": "2025-01-15",
    "urea_46_0_0_bags": 1000,
    "rice_seeds_nsic_rc160_kg": 50000
  }'

# Get gap analysis
curl http://localhost:5000/api/distribution/gap-analysis/dry_2025

# Calculate priorities
curl -X POST http://localhost:5000/api/distribution/calculate-priorities/dry_2025
```

---

## ⚠️ IMPORTANT NOTES

1. **Backend server must be running**: `node backend/server.cjs`
2. **Database must have tables**: Run the SQL file first
3. **RSBSA data needed**: Farmer requests reference `rsbsa_submission` table
4. **Port 5000**: Backend APIs run on http://localhost:5000
5. **Authentication**: Currently using placeholder `created_by: 1` (implement proper auth later)

---

## 🎯 TESTING CHECKLIST

- [ ] Database tables created successfully
- [ ] Backend server starts without errors
- [ ] Regional Allocation page loads
- [ ] Can save fertilizer/seed allocation
- [ ] Can view saved allocation
- [ ] API endpoints return correct data
- [ ] Gap analysis calculates correctly
- [ ] Priority scores calculate correctly
- [ ] Frontend connects to backend

---

**System Status: 40% Complete**
- ✅ Database schema
- ✅ Backend APIs
- ✅ Regional Allocation page
- ⏳ Gap Analysis page
- ⏳ Farmer Requests page
- ⏳ Distribution Dashboard
- ⏳ Navigation & routing
