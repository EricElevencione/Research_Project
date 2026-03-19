# Audit Trail UI/UX Design
## Visual Design & User Interface Documentation

---

## 🎨 Page Layout Overview

The Audit Trail page uses a **sidebar + main content** layout with two distinct view modes:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUDIT TRAIL PAGE                             │
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                           │
│          │  📋 System Audit Trail                    [Log List] [📊 Statistics]
│          │  Track all system activities...                          │
│  SIDEBAR │                                                           │
│          │  ┌─────────────────────────────────────────────────────┐│
│  • Home  │  │ FILTERS & SEARCH                                   ││
│  • RSBSA │  │ Start Date  End Date  User  Role  Action  Module  ││
│  • Audit │  │ [________] [________] [___] [___] [_____] [_____] ││
│  • More..│  │ 🔍 Search...  [Clear]  [🔄 Refresh]  [📤 Export]  ││
│          │  └─────────────────────────────────────────────────────┘│
│          │                                                           │
│          │  ┌──────────────┬──────────────┐                        │
│          │  │ Total Records│ Current Page │                        │
│          │  │     1,234    │    1 / 50    │                        │
│          │  └──────────────┴──────────────┘                        │
│          │                                                           │
│          │  ┌─────────────────────────────────────────────────────┐│
│          │  │ AUDIT LOGS TABLE                                    ││
│          │  │ Timestamp | User | Action | Module | Description    ││
│          │  │ ───────────────────────────────────────────────────││
│          │  │ 5 min ago │ admin│ DELETE │ FARMERS│ Deleted farmer ││
│          │  │ 1 hr ago  │ jo_1 │ CREATE │ RSBSA  │ New submission││
│          │  │ 2 hrs ago │ tech │ UPDATE │ LAND   │ Updated parcel││
│          │  └─────────────────────────────────────────────────────┘│
│          │                                                           │
│          │  [← Previous]  Page 1 of 50  [Next →]                   │
│          │                                                           │
└──────────┴──────────────────────────────────────────────────────────┘
```

---

## 🏗️ Layout Structure

### 1. **Sidebar Navigation** (Left Side - Fixed)

```
┌─────────────────┐
│   [LOGO IMAGE]  │
│                 │
├─────────────────┤
│ 🏠 Home         │
│ 📋 RSBSA        │
│ 📋 Audit Trail  │◄─── Current page (highlighted)
│ 🎁 Incentives   │
│ 📊 Masterlist   │
│                 │
├─────────────────┤
│ 🚪 Logout       │
└─────────────────┘
```

**Features**:
- Fixed position (always visible)
- Logo at top
- Navigation items with icons
- Active page highlighted
- Logout at bottom

---

### 2. **Main Content Area** (Right Side - Scrollable)

The main area has **3 main sections**:

#### A. Header Section
```
┌─────────────────────────────────────────────────────────────────┐
│  📋 System Audit Trail                                          │
│  Track all system activities, changes, and user actions         │
│                                                                  │
│                                   [📃 Log List] [📊 Statistics] │
└─────────────────────────────────────────────────────────────────┘
```

#### B. Filter Panel
```
┌─────────────────────────────────────────────────────────────────┐
│  FILTERS (Collapsible Panel)                                    │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┬─────┐│
│  │Start Date│ End Date │   User   │   Role   │  Action  │ Mod ││
│  │[______]  │[______]  │ [_____]  │ [____]   │ [_____]  │[___]││
│  └──────────┴──────────┴──────────┴──────────┴──────────┴─────┘│
│                                                                  │
│  🔍 Search description, user, or record ID...                   │
│                                                                  │
│  [Clear Filters]  [🔄 Refresh]  [📤 Export ▼]                  │
│                                  ├─ Export JSON                 │
│                                  └─ Export CSV                  │
└─────────────────────────────────────────────────────────────────┘
```

#### C. Content Display (Two Modes)

---

## 📃 VIEW MODE 1: Log List (Default)

### Stats Summary Cards
```
┌──────────────────────┬──────────────────────┐
│  Total Records       │  Current Page        │
│      1,234           │     1 / 50           │
│  audit logs          │  showing 25 per page │
└──────────────────────┴──────────────────────┘
```

### Audit Logs Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Timestamp          │ User         │ Action      │ Module      │ Description      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 5 min ago          │ admin_user   │ 🗑️ DELETE  │ FARMERS     │ Deleted farmer:  │
│ Jan 15, 2:30 PM    │ [admin]      │             │             │ Juan Dela Cruz   │
│                    │              │             │             │ ID: 123          │
│                    │              │             │             │   [👁️ View]     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1 hr ago           │ jo_staff_1   │ ➕ CREATE   │ RSBSA       │ New RSBSA form   │
│ Jan 15, 1:15 PM    │ [jo]         │             │             │ submission       │
│                    │              │             │             │   [👁️ View]     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2 hrs ago          │ tech_user    │ ✏️ UPDATE  │ LAND_PLOTS  │ Updated land     │
│ Jan 15, 12:45 PM   │ [technician] │             │             │ parcel info      │
│                    │              │             │             │   [👁️ View]     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3 hrs ago          │ admin_user   │ ✅ APPROVE  │ DISTRIBUTION│ Approved farmer  │
│ Jan 15, 11:20 AM   │ [admin]      │             │             │ request          │
│                    │              │             │             │   [👁️ View]     │
└─────────────────────────────────────────────────────────────────────────────────┘

                [← Previous]  Page 1 of 50  [Next →]
```

### Table Design Details

**Column 1: Timestamp**
- **Top line**: Relative time ("5 min ago", "1 hr ago", "2 days ago")
- **Bottom line**: Full timestamp (Jan 15, 2026, 2:30:45 PM)
- Font: Top larger/bold, bottom smaller/gray

**Column 2: User**
- **Top line**: Username
- **Bottom line**: Role badge with color coding
  - 🔴 `[admin]` - Red background
  - 🔵 `[technician]` - Blue background
  - 🟢 `[jo]` - Green background

**Column 3: Action**
- Color-coded badges with emoji icons:
  - 🟢 `➕ CREATE` - Green
  - 🔵 `✏️ UPDATE` - Blue
  - 🔴 `🗑️ DELETE` - Red
  - 🟢 `✅ APPROVE` - Teal
  - 🟠 `❌ REJECT` - Orange
  - 🟣 `🔓 LOGIN` - Purple
  - 🟥 `❌ LOGIN_FAILED` - Dark Red
  - 🔵 `📤 EXPORT` - Cyan

**Column 4: Module**
- Simple text badge
- Gray background with rounded corners
- Examples: `RSBSA`, `FARMERS`, `DISTRIBUTION`, `AUTH`

**Column 5: Description**
- Main description text (bold)
- Optional record ID shown below (smaller, lighter)
- "View" button on the right

---

## 📊 VIEW MODE 2: Statistics Dashboard

### Overall Layout
```
┌───────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  📊 STATISTICS DASHBOARD                                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Total Activity                                              │ │
│  │     1,234                                                   │ │
│  │ Last 30d                                                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 📈 Activity Timeline                                        │ │
│  │ ┌───────────────────────────────────────────────────────┐  │ │
│  │ │      [LINE CHART]                                     │  │ │
│  │ │  ▲                                                    │  │ │
│  │ │  │     ╱╲                                            │  │ │
│  │ │  │    ╱  ╲      ╱╲                                  │  │ │
│  │ │  │   ╱    ╲    ╱  ╲    ╱╲                          │  │ │
│  │ │  │  ╱      ╲  ╱    ╲  ╱  ╲                        │  │ │
│  │ │  │─────────────────────────────────────────────→  │  │ │
│  │ │       Jan 1  Jan 5  Jan 10  Jan 15  Jan 20        │  │ │
│  │ └───────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────┬──────────────────────────────┐ │
│  │ 🎯 Actions Distribution      │ 📦 By Module                 │ │
│  │ ┌──────────────────────────┐ │ ┌──────────────────────────┐ │ │
│  │ │   [PIE CHART]            │ │ │  [BAR CHART]             │ │ │
│  │ │                          │ │ │  RSBSA    ██████ 45%     │ │ │
│  │ │      CREATE 35%          │ │ │  FARMERS  ████ 25%       │ │ │
│  │ │    ╱────────╲            │ │ │  DISTRIB  ███ 20%        │ │ │
│  │ │   │    ●     │           │ │ │  AUTH     █ 10%          │ │ │
│  │ │    ╲────────╱            │ │ │                          │ │ │
│  │ │      UPDATE 30%          │ │ │                          │ │ │
│  │ └──────────────────────────┘ │ └──────────────────────────┘ │ │
│  └──────────────────────────────┴──────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 👥 Most Active Users                                        │ │
│  │ ┌─────┬──────────────────────┬─────────────┬─────────────┐ │ │
│  │ │  1  │ admin_user           │ [admin]     │ 234 actions │ │ │
│  │ │  2  │ tech_staff_1         │ [technician]│ 189 actions │ │ │
│  │ │  3  │ jo_staff_2           │ [jo]        │ 156 actions │ │ │
│  │ │  4  │ tech_staff_2         │ [technician]│ 142 actions │ │ │
│  │ │  5  │ jo_staff_1           │ [jo]        │ 98 actions  │ │ │
│  │ └─────┴──────────────────────┴─────────────┴─────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### Statistics Components

#### 1. **Summary Card**
```
┌─────────────────────────────┐
│  Total Activity             │
│        1,234                │ ← Large number
│  Last 30d                   │ ← Period indicator
└─────────────────────────────┘
```

#### 2. **Activity Timeline (Area Chart)**
- X-axis: Date range
- Y-axis: Number of actions
- Blue gradient fill under the curve
- Shows daily activity trends
- Hover shows exact count per day

#### 3. **Actions Distribution (Pie Chart)**
- Circular chart with colored segments
- Each segment labeled with action type and percentage
- Color-coded by action (same as badge colors)
- Hover shows exact count

#### 4. **Module Distribution (Horizontal Bar Chart)**
- Module names on left
- Horizontal bars showing count
- Different color per module
- Bars sorted by count (highest to lowest)

#### 5. **Top Users Leaderboard**
- Ranked list (1-10)
- Shows: Rank | Username | Role Badge | Action Count
- Highlights top performer
- Color-coded role badges

---

## 🔍 Detail View Modal

When clicking "👁️ View" button on any log entry:

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Audit Log Details                               [✕ Close]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GENERAL INFORMATION                                            │
│  ┌───────────────┬───────────────────────────────────────────┐ │
│  │ ID            │ 12345                                     │ │
│  │ Timestamp     │ January 15, 2026, 2:30:45 PM             │ │
│  │ User          │ admin_user (admin)                       │ │
│  │ IP Address    │ 192.168.1.100                            │ │
│  └───────────────┴───────────────────────────────────────────┘ │
│                                                                  │
│  ACTION DETAILS                                                 │
│  ┌───────────────┬───────────────────────────────────────────┐ │
│  │ Action        │ 🗑️ DELETE                                │ │
│  │ Module        │ FARMERS                                   │ │
│  │ Record Type   │ farmer                                    │ │
│  │ Record ID     │ 123                                       │ │
│  └───────────────┴───────────────────────────────────────────┘ │
│                                                                  │
│  DESCRIPTION                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Deleted farmer: Juan Dela Cruz                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  PREVIOUS VALUES (Before Change)                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ {                                                            ││
│  │   "id": 123,                                                ││
│  │   "name": "Juan Dela Cruz",                                 ││
│  │   "barangay": "Baras",                                      ││
│  │   "farm_area_ha": 2.5,                                      ││
│  │   "status": "active"                                        ││
│  │ }                                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  NEW VALUES (After Change)                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ null (Record deleted)                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  METADATA                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ {                                                            ││
│  │   "reason": "Duplicate entry",                              ││
│  │   "confirmed_by": "admin_user"                              ││
│  │ }                                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Modal Features**:
- Semi-transparent dark overlay behind modal
- Modal centered on screen
- Close button (X) in top right
- Click outside modal to close
- Scrollable content if long
- JSON values color-coded and formatted

---

## 🎨 Color Scheme & Visual Design

### Primary Colors

```css
--primary-blue: #3b82f6
--primary-green: #22c55e
--primary-red: #ef4444
--primary-orange: #f59e0b
--primary-purple: #8b5cf6
--primary-teal: #10b981
--primary-cyan: #06b6d4
```

### Action Badge Colors

| Action         | Background | Text     | Icon |
|----------------|------------|----------|------|
| CREATE         | `#22c55e`  | White    | ➕   |
| UPDATE         | `#3b82f6`  | White    | ✏️   |
| DELETE         | `#ef4444`  | White    | 🗑️   |
| APPROVE        | `#10b981`  | White    | ✅   |
| REJECT         | `#f59e0b`  | White    | ❌   |
| LOGIN          | `#8b5cf6`  | White    | 🔓   |
| LOGOUT         | `#6366f1`  | White    | 🔒   |
| LOGIN_FAILED   | `#dc2626`  | White    | ❌   |
| EXPORT         | `#06b6d4`  | White    | 📤   |
| DISTRIBUTE     | `#14b8a6`  | White    | 🚚   |

### Role Badge Colors

| Role        | Background | Text     |
|-------------|------------|----------|
| admin       | `#dc2626`  | White    |
| technician  | `#3b82f6`  | White    |
| jo          | `#10b981`  | White    |

---

## 🖱️ User Interactions & States

### 1. **Filter Interactions**

**Date Pickers**:
```
[ Start Date ▼ ]  →  Click  →  Calendar popup
```

**Dropdowns**:
```
[ All Roles ▼ ]  →  Click  →  ┌────────────────┐
                               │ All Roles      │
                               │ Admin          │
                               │ Technician     │
                               │ Job Order      │
                               └────────────────┘
```

**Search Box**:
```
[ 🔍 Search description... ]
   ↓ Type "farmer"
[ 🔍 farmer|            ]  ←  Real-time filtering
```

### 2. **Button States**

**Normal State**:
```
┌─────────────┐
│ 🔄 Refresh  │  ← Gray background, pointer cursor
└─────────────┘
```

**Hover State**:
```
┌─────────────┐
│ 🔄 Refresh  │  ← Darker background, still pointer
└─────────────┘
```

**Disabled State**:
```
┌─────────────┐
│ ← Previous  │  ← Faded, no cursor, unclickable
└─────────────┘
```

### 3. **Table Row Hover**
```
┌─────────────────────────────────────┐
│ 5 min ago │ admin │ DELETE │ [View] │  ← Normal
└─────────────────────────────────────┘

Hover ↓

┌═════════════════════════════════════┐
║ 5 min ago │ admin │ DELETE │ [View] ║  ← Light gray background
└═════════════════════════════════════┘
```

### 4. **View Toggle Animation**
```
[📃 Log List] [📊 Statistics]
      ↓ Click Statistics
[📃 Log List] [📊█Statistics█]  ← Active darkens, content fades out
      ↓
Statistics view fades in
```

### 5. **Export Dropdown**
```
┌──────────────┐
│ 📤 Export ▼ │  ← Click opens dropdown
└──────────────┘
       ↓
┌──────────────┐
│ 📤 Export ▼ │
├──────────────┤
│ Export JSON  │  ← Hover highlights
│ Export CSV   │
└──────────────┘
```

---

## 📱 Responsive Behavior

### Desktop (> 1200px)
- Sidebar: 250px fixed width
- Main content: Fills remaining space
- Filters: 6 columns in one row
- Charts: Side-by-side (2 columns)

### Tablet (768px - 1200px)
- Sidebar: 200px width
- Filters: 3 columns per row (wraps to 2 rows)
- Charts: Stacked vertically (1 column)
- Table: Scrolls horizontally

### Mobile (< 768px)
- Sidebar: Collapsible drawer
- Filters: 1 column (stacked)
- Charts: Full width, smaller height
- Table: Card view instead of table
- Pagination: Simplified (just page number)

---

## ⚡ Loading & Empty States

### Loading State
```
┌─────────────────────────────────────────┐
│                                         │
│         ⏳ Loading audit logs...        │
│                                         │
│            [Spinner Animation]          │
│                                         │
└─────────────────────────────────────────┘
```

### Empty State (No Results)
```
┌─────────────────────────────────────────┐
│                                         │
│         📭 No audit logs found         │
│                                         │
│     Adjust your filters or check       │
│          back later                     │
│                                         │
└─────────────────────────────────────────┘
```

### Error State
```
┌─────────────────────────────────────────┐
│                                         │
│         ⚠️ Failed to load logs         │
│                                         │
│     Please check your connection       │
│          and try again                  │
│                                         │
│        [🔄 Retry Button]               │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔄 User Flow Examples

### Flow 1: Viewing Recent Farmer Deletions

```
1. User opens Audit Trail
   ↓
2. Clicks "Action" dropdown → Selects "DELETE"
   ↓
3. Clicks "Module" dropdown → Selects "FARMERS"
   ↓
4. Table instantly filters to show only farmer deletions
   ↓
5. User clicks "👁️ View" on a specific entry
   ↓
6. Modal opens showing:
   - Who deleted it
   - When it was deleted
   - Complete farmer data (old_values)
   - Reason (if provided in metadata)
   ↓
7. User reviews and closes modal
```

### Flow 2: Exporting Last Month's Activity

```
1. User opens Audit Trail
   ↓
2. Sets Start Date: "Jan 1, 2026"
   ↓
3. Sets End Date: "Jan 31, 2026"
   ↓
4. Table filters to show January logs
   ↓
5. Clicks "📤 Export" dropdown
   ↓
6. Selects "Export CSV"
   ↓
7. Browser downloads "audit-logs-2026-01-31.csv"
   ↓
8. User opens in Excel for analysis
```

### Flow 3: Checking System Activity Statistics

```
1. User opens Audit Trail
   ↓
2. Clicks "📊 Statistics" toggle button
   ↓
3. View switches to statistics dashboard
   ↓
4. User sees:
   - High activity spike on timeline (Jan 15)
   - Most actions are CREATE (35%)
   - RSBSA module is most active (45%)
   - admin_user is top performer (234 actions)
   ↓
5. Takes screenshot for reporting
```

### Flow 4: Investigating Failed Login Attempts

```
1. User opens Audit Trail
   ↓
2. Selects Action: "LOGIN_FAILED"
   ↓
3. Sees 3 attempts from user "unknown_user"
   ↓
4. Clicks "👁️ View" on first attempt
   ↓
5. Modal shows:
   - IP address: 201.45.123.45
   - Timestamp: 2:30 AM
   - Multiple failed attempts from same IP
   ↓
6. User decides to investigate/block IP
```

---

## 🎯 Design Principles

### 1. **Clarity First**
- Clear labels on all fields
- Descriptive action badges with icons
- Readable timestamps (relative + absolute)

### 2. **Information Hierarchy**
- Most important info (action, user) is prominent
- Supporting details (timestamps, IDs) are secondary
- Full details hidden in modal (progressive disclosure)

### 3. **Visual Feedback**
- Hover effects on interactive elements
- Loading spinners during data fetch
- Success/error messages after actions

### 4. **Consistency**
- Same color coding across all views
- Consistent badge styles
- Uniform spacing and padding

### 5. **Accessibility**
- High contrast colors
- Keyboard navigation support
- Screen reader compatible
- Clear focus indicators

### 6. **Performance**
- Pagination to limit data load
- Debounced search to reduce queries
- Lazy loading for charts
- Efficient filtering on client side

---

## 📐 Spacing & Typography

### Typography Scale
```
Page Title:      32px, Bold (📋 System Audit Trail)
Section Headers: 20px, Semi-bold
Card Titles:     16px, Medium
Body Text:       14px, Regular
Labels:          12px, Regular
Timestamps:      12px, Light
```

### Spacing System
```
Component Padding:    16px
Card Margin:          20px
Section Gap:          24px
Button Padding:       12px 20px
Filter Group Gap:     12px
Table Cell Padding:   12px 16px
```

---

## 🎭 Animation & Transitions

### Hover Animations
```css
Button hover: 150ms ease-in-out
Row hover: 200ms ease
Tab switch: 300ms ease-in-out
```

### Modal Transitions
```css
Modal fade in: 200ms ease
Overlay fade: 150ms ease
```

### Loading States
```css
Spinner rotation: 1s linear infinite
Skeleton pulse: 1.5s ease-in-out infinite
```

---

**Last Updated**: February 16, 2026  
**Design Version**: 1.0  
**Component File**: `src/screens/admin/AuditTrail.tsx`  
**Styles**: `src/assets/css/admin css/AdminAuditTrail.css`
