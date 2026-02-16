# Audit Trail System Design
## RSBSA Management System

---

## 📋 Overview

The Audit Trail system provides comprehensive tracking of all user actions and system changes within the RSBSA Management System. It creates an immutable log of activities for:
- **Accountability** - Who did what and when
- **Compliance** - Government audit requirements (7-year retention)
- **Security** - Detection of unauthorized access or suspicious activity
- **Debugging** - Troubleshooting data issues by reviewing change history

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌───────────────────────┐   │
│  │  AuditTrail.tsx  │────────▶│   auditAPI.ts         │   │
│  │  (UI Component)  │         │   (Data Fetching)     │   │
│  └──────────────────┘         └───────────────────────┘   │
│                                          │                  │
│  ┌──────────────────┐                   │                  │
│  │ auditLogger.ts   │                   │                  │
│  │ (Event Logging)  │                   │                  │
│  └──────────────────┘                   │                  │
│           │                              │                  │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
   ┌────────────────────────────────────────────────┐
   │           Supabase Client (supabase.ts)        │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │            Supabase Database (PostgreSQL)       │
   │                  audit_logs table               │
   └────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Table: `audit_logs`

| Column        | Type           | Description                                    |
|---------------|----------------|------------------------------------------------|
| `id`          | BIGSERIAL      | Primary key                                    |
| `timestamp`   | TIMESTAMPTZ    | When the action occurred (auto-generated)      |
| `user_id`     | INTEGER        | FK to users table (nullable)                   |
| `user_name`   | VARCHAR(255)   | Username who performed the action              |
| `user_role`   | VARCHAR(50)    | Role: admin, technician, jo                    |
| `action`      | VARCHAR(50)    | Action type (CREATE, UPDATE, DELETE, etc.)     |
| `module`      | VARCHAR(100)   | System module (RSBSA, DISTRIBUTION, etc.)      |
| `record_id`   | VARCHAR(255)   | ID of affected record                          |
| `record_type` | VARCHAR(100)   | Type of record (farmer, allocation, etc.)      |
| `description` | TEXT           | Human-readable description                     |
| `old_values`  | JSONB          | Previous state (for updates/deletes)           |
| `new_values`  | JSONB          | New state (for creates/updates)                |
| `ip_address`  | INET           | Client IP address                              |
| `session_id`  | VARCHAR(255)   | Session identifier                             |
| `metadata`    | JSONB          | Additional context data                        |
| `created_at`  | TIMESTAMPTZ    | Record creation time                           |

### Indexes for Performance
```sql
-- Time-based queries (most common)
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Filter by user
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_user_name ON audit_logs(user_name);

-- Filter by action/module
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);

-- Full-text search on descriptions
CREATE INDEX idx_audit_logs_description ON audit_logs 
    USING gin(to_tsvector('english', description));
```

---

## 🎨 Frontend Components

### 1. **AuditTrail.tsx** - Main UI Component

**Location**: `src/screens/admin/AuditTrail.tsx`

**Features**:
- 📃 **Log List View** - Paginated table of audit logs
- 📊 **Statistics Dashboard** - Visual analytics with charts
- 🔍 **Advanced Filtering** - By date, user, role, action, module
- 🔎 **Full-Text Search** - Search descriptions and record IDs
- 📤 **Export** - Download logs as JSON or CSV
- 👁️ **Detail Modal** - View full log details with before/after values

**State Management**:
```typescript
interface AuditLog {
    id: number;
    timestamp: string;
    formatted_timestamp: string;
    user_id: number | null;
    user_name: string;
    user_role: string;
    action: string;
    module: string;
    record_id: string | null;
    record_type: string | null;
    description: string;
    old_values: any;
    new_values: any;
    ip_address: string | null;
    session_id: string | null;
    metadata: any;
}
```

**Views**:

#### Log List View
- Displays audit entries in a sortable, paginated table
- Color-coded action badges (CREATE=green, DELETE=red, UPDATE=blue)
- User role badges for quick identification
- Time-ago format for recent entries

#### Statistics View
- **Activity Timeline** - Line chart showing daily activity
- **Actions Distribution** - Pie chart of action types
- **Module Distribution** - Bar chart of activity by module
- **Top Users** - Ranked list of most active users
- **Critical Actions** - Recent high-priority events (deletes, failed logins)

### 2. **auditAPI.ts** - Data Layer

**Location**: `src/components/Audit/auditAPI.ts`

**Class**: `AuditAPI`

**Methods**:

| Method | Purpose | Parameters |
|--------|---------|------------|
| `getLogs()` | Fetch audit logs with filters & pagination | `filters`, `page`, `limit` |
| `getStats()` | Get statistical summaries | `period` (7d/30d/90d/all) |
| `getFilterOptions()` | Get unique actions/modules for dropdowns | - |
| `exportLogs()` | Export filtered logs | `filters`, `format` (json/csv) |

**Key Features**:
- **Filtering**: Date range, user, role, action, module, full-text search
- **Pagination**: Server-side pagination with count
- **Formatting**: Timestamps formatted to locale strings
- **Aggregation**: Groups and counts for statistics

### 3. **auditLogger.ts** - Event Logging

**Location**: `src/components/Audit/auditLogger.ts`

**Class**: `AuditLogger`

**Core Methods**:

| Method | Use Case | Example |
|--------|----------|---------|
| `log()` | Generic audit logging | Any custom event |
| `logAuth()` | Login/logout events | User authentication |
| `logCRUD()` | Create/Update/Delete operations | Data modifications |
| `logFarmerRegistration()` | New farmer registration | RSBSA submissions |
| `logRSBSAStatus()` | Approval/rejection | Form processing |
| `logDistribution()` | Resource distribution | Fertilizer/seed delivery |
| `logExport()` | Data export operations | Report downloads |

**Usage Example**:
```typescript
import { getAuditLogger, AuditAction, AuditModule } from '@/components/Audit/auditLogger';

// Automatic initialization with shared Supabase client
const logger = getAuditLogger();

// Log a farmer approval
await logger.logRSBSAStatus(
    { id: 1, name: 'admin_user', role: 'admin' },
    'APPROVE',
    123,
    'Juan Dela Cruz',
    'Verified all documents'
);
```

**Enums**:

```typescript
enum AuditAction {
    CREATE, UPDATE, DELETE,
    LOGIN, LOGOUT, LOGIN_FAILED,
    APPROVE, REJECT,
    EXPORT, IMPORT, DISTRIBUTE,
    VIEW, BULK_UPDATE, BULK_DELETE
}

enum AuditModule {
    AUTH, USERS, RSBSA, FARMERS,
    DISTRIBUTION, INCENTIVES,
    LAND_PLOTS, LAND_HISTORY,
    REPORTS, SYSTEM, ALLOCATIONS, REQUESTS
}
```

---

## 🔄 Data Flow

### Reading Audit Logs (Display)
```
User opens Audit Trail page
    ↓
AuditTrail.tsx renders
    ↓
Calls auditAPI.getLogs(filters)
    ↓
AuditAPI queries Supabase
    ↓
SELECT * FROM audit_logs 
WHERE [filters] 
ORDER BY timestamp DESC
    ↓
Returns formatted data + pagination
    ↓
AuditTrail.tsx displays in table/charts
```

### Writing Audit Logs (Logging Events)
```
User performs action (e.g., deletes farmer)
    ↓
App calls getAuditLogger().logDelete(...)
    ↓
AuditLogger formats log entry
    ↓
Supabase INSERT into audit_logs
    ↓
Log persisted in database
    ↓
(Async - doesn't block user action)
```

---

## 🎯 Key Features

### 1. **Comprehensive Tracking**
Logs all critical operations across 7 modules:
- Authentication (login/logout/failures)
- User management
- Farmer registration (RSBSA)
- Distribution management
- Incentives
- Land ownership
- System operations

### 2. **Advanced Search & Filtering**
- **Date Range**: Start/end date pickers
- **User**: Search by username
- **Role**: Filter by admin/technician/jo
- **Action**: Filter by CREATE/UPDATE/DELETE/etc.
- **Module**: Filter by system module
- **Full-Text Search**: Search descriptions/record IDs

### 3. **Visual Analytics**
- Activity timeline (area chart)
- Action distribution (pie chart)
- Module activity (bar chart)
- Top 10 active users
- Recent critical actions

### 4. **Export Capabilities**
- **JSON**: Complete structured data
- **CSV**: Spreadsheet-compatible format
- Includes all filter criteria
- Timestamp in filename

### 5. **Change Tracking**
- **Before/After Values**: JSON diff of changes
- **Old Values**: Previous state of updated/deleted records
- **New Values**: Current state of created/updated records
- **Metadata**: Additional context (reason, notes, etc.)

### 6. **Security Features**
- **IP Address Logging**: Track request origin
- **Session Tracking**: Link related actions
- **Failed Login Detection**: Security monitoring
- **Read-Only**: Logs cannot be modified/deleted
- **Role-Based Access**: Admin-only viewing (configurable)

---

## 🔒 Security Considerations

### Row Level Security (RLS)

**Current Setup** (for desktop app):
```sql
-- Allow reading (desktop app with custom auth)
CREATE POLICY "Allow read audit logs" ON audit_logs
    FOR SELECT USING (true);

-- Allow inserting
CREATE POLICY "Allow insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);
```

**For Web Deployment** (stricter):
```sql
-- Only admins can read
CREATE POLICY "Admins can read audit logs" ON audit_logs
    FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin');
```

### Data Protection
- **Sensitive Data Sanitization**: Passwords stored as `[REDACTED]`
- **No Update/Delete**: Audit logs are immutable
- **Encryption**: Supabase encrypts data at rest
- **Access Control**: Admin-only UI route

---

## 📊 Performance Optimization

### Database Indexes
- All filter columns indexed
- Timestamp descending for recent queries
- GIN index for full-text search

### Query Optimization
- **Pagination**: Loads 25 records at a time (configurable)
- **Lazy Loading**: Statistics only fetched in stats view
- **Debounced Search**: Filters applied after typing stops
- **Cached Dropdowns**: Action/module lists cached

### Frontend Optimization
- **React.memo**: Prevents unnecessary re-renders
- **useCallback**: Memoized filter functions
- **Virtual Scrolling**: For large datasets (if needed)
- **Code Splitting**: Recharts library loaded on-demand

---

## 📋 Tracked Operations

### Authentication (Module: AUTH)
- ✅ Successful logins
- ⚠️ Failed login attempts
- 🔒 User logouts
- 🔐 Password changes

### User Management (Module: USERS)
- ➕ User creation
- ✏️ Profile updates
- 🗑️ User deletions
- 🔄 Role changes

### Farmer/RSBSA (Module: RSBSA, FARMERS)
- 📝 New farmer registrations
- ✅ RSBSA approvals
- ❌ RSBSA rejections
- ✏️ Farmer profile updates
- 🗑️ Farmer deletions

### Distribution (Module: DISTRIBUTION, ALLOCATIONS, REQUESTS)
- 🌾 Regional allocation creation
- 📋 Farmer request submissions
- ✅ Request approvals
- ❌ Request rejections
- 🚚 Actual distributions

### Land Management (Module: LAND_PLOTS, LAND_HISTORY)
- 🏞️ Land parcel registration
- 🔄 Ownership transfers
- 📊 Land history updates

### Reports (Module: REPORTS)
- 📤 Data exports
- 📥 Data imports
- 📊 Report generation

### System (Module: SYSTEM)
- ⚙️ Configuration changes
- 🔧 Bulk operations
- 🛠️ Database maintenance

---

## 🔮 Future Enhancements

### Phase 2
- [ ] **Real-time Updates**: WebSocket for live log streaming
- [ ] **Advanced Analytics**: Patterns, anomaly detection
- [ ] **Custom Dashboards**: User-configurable views
- [ ] **Scheduled Reports**: Auto-email daily/weekly summaries

### Phase 3
- [ ] **Machine Learning**: Predictive fraud detection
- [ ] **Integration**: Link to external audit systems
- [ ] **Mobile App**: Audit trail viewer for mobile
- [ ] **Alerting**: Real-time notifications for critical events

---

## 📚 Reference

### Color Coding

| Action | Color | Hex | Use Case |
|--------|-------|-----|----------|
| CREATE | Green | `#22c55e` | New records |
| UPDATE | Blue | `#3b82f6` | Modifications |
| DELETE | Red | `#ef4444` | Deletions |
| APPROVE | Teal | `#10b981` | Approvals |
| REJECT | Orange | `#f59e0b` | Rejections |
| LOGIN | Purple | `#8b5cf6` | Authentication |
| LOGOUT | Indigo | `#6366f1` | Sign-out |
| LOGIN_FAILED | Dark Red | `#dc2626` | Security alerts |
| EXPORT | Cyan | `#06b6d4` | Data exports |
| DISTRIBUTE | Emerald | `#14b8a6` | Distributions |

### Retention Policy
- **Primary Storage**: 7 years (COA requirement)
- **Archive**: After 90 days, move to cold storage
- **Deletion**: Only after legal retention expires

### Compliance
- **COA (Commission on Audit)**: Government audit requirements
- **RA 9184**: Transparency in public procurement
- **Data Privacy Act**: Protects farmer information

---

## 🛠️ Maintenance

### Regular Tasks
- **Weekly**: Review critical actions (deletions, failures)
- **Monthly**: Export logs for offline backup
- **Quarterly**: Archive old logs to cold storage
- **Yearly**: Compliance review and retention cleanup

### Monitoring
- Check log volume growth
- Monitor query performance
- Review failed operations
- Investigate suspicious patterns

---

**Last Updated**: February 16, 2026  
**Version**: 1.0  
**Maintained By**: RSBSA Dev Team
