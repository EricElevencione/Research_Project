# 🌾 RSBSA Land & Distribution Management System
## Complete Setup & Deployment Guide

This document outlines the step-by-step instructions to configure, run, and prepare this Web-GIS & Input Distribution system for download, installation, and deployment.

---

## 📦 1. Preparing the Project for Download (File Minimization)
Before archiving or sharing the project folder, you can safely remove temporary environment files, build directories, external caches, and package dependencies. This reduces the download size from **~600MB** down to **~15MB**.

### Files & Folders to Exclude/Delete:
Delete the following folders in the root of the project:
*   `node_modules/` (Frontend package dependencies)
*   `backend/node_modules/` (Backend package dependencies)
*   `dist/` (Temporary compiled production frontend)
*   `.venv/` (Python virtual environment, if any)
*   `.vercel/` (Vercel deployment cache)
*   `.git/` (Git repository history and logs)
*   `.agents/` & `.qodo/` (Agent helper configurations)
*   `.env.local` (Local configuration files with private passwords)

> [!TIP]
> After unzipping the clean package, running `npm install` will dynamically download the exact dependencies list.

---

## ⚙️ 2. System Prerequisites
Ensure you have the following installed on your machine before setting up the application:

1.  **Node.js (v18.0.0 or higher):** Includes `npm` package manager. Download at [nodejs.org](https://nodejs.org/).
2.  **PostgreSQL (v14 or higher):** Requires the **PostGIS** extension for spatial mapping features. Download at [postgresql.org](https://www.postgresql.org/).
3.  **Supabase Account / Project (Optional):** The frontend relies on Supabase client-side JS endpoints. You can host database tables directly on Supabase.

---

## 🗄️ 3. Database Schema Setup
This system uses PostgreSQL with spatial extensions enabled. If you are starting with a fresh database:

### Step 1: Initialize Database & Extensions
Connect to your database (local PostgreSQL instance or Supabase Database SQL Editor) and run:
```sql
-- Enable PostGIS spatial extension (REQUIRED for mapping features)
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Step 2: Run SQL Schemas in Order
Execute the SQL files inside the `database/` directory in the following logical order to avoid foreign key dependency errors:

1.  **`rsbsaSubmission.sql`** (Base RSBSA submission registry)
2.  **`rsbsaFarmParcels.sql`** (Farmland parcels layout)
3.  **`landHistory.sql`** (Maintains historic ownership changes & land transfers)
4.  **`regionalAllocations.sql`** (Tracks input materials distributed by Regional Office)
5.  **`farmerRequest.sql`** (Farmer input request slips and priority algorithms)
6.  **`distributionRecords.sql`** (Maintains distribution/claiming history)
7.  **`unifiedParcels.sql`** (Consolidates active parcels & registry records)
8.  **`vTentantLesseeRelationship.sql`** (Tenant-owner helper links)
9.  **`farmerAggregatedUnified.sql`** (Maintains summarized stats for dashboards)
10. **`auditLogs.sql` & `auditLogsPageView.sql`** (Auditing trails)

---

## 🖥️ 4. Environment Configuration (`.env` files)
The system uses environment configurations for the frontend application (root folder) and backend server (`backend/` folder).

### A. Root `.env` (Frontend Config)
Create a file named `.env` in the **root project directory**:
```env
VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-api-key
VITE_USE_SUPABASE_SHORTAGES=true
```

### B. Backend `.env` (Backend Server Config)
Create a file named `.env` in the **`backend/` directory**:
```env
# Server settings
NODE_ENV=development
PORT=5000

# Database Settings (Direct PostgreSQL/Supabase DB Connection URL)
# Format: postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DB_NAME]
SUPABASE_DB_URL=postgresql://postgres:your_password@db.your-project-id.supabase.co:5432/postgres

# Security settings
JWT_SECRET=generate-a-secure-jwt-secret-string-here

# CORS Config (Whitelist frontend port defaults)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5000,http://localhost:3000
```

---

## 🚀 5. Installation & Run Steps

Once you have configured the environment variables, follow these command steps:

### Step 1: Install Dependencies
Open your terminal in the **root project directory** and run:
```bash
# 1. Install frontend dependencies
npm install

# 2. Navigate to backend and install server dependencies
cd backend
npm install
```

### Step 2: Start the System in Development Mode
Return to the **root directory** and run the concurrent startup script:
```bash
# From the root directory
npm run dev
```

This starts:
*   **Vite Frontend Dev Server:** [http://localhost:5173](http://localhost:5173)
*   **Express Backend API Server:** [http://localhost:5000](http://localhost:5000)

---

## 📦 6. Building for Production

To compile and package the frontend application for staging or production servers:

```bash
# From the root directory
npm run build
```
This builds static assets into the `dist/` folder, optimized and ready to serve from any static hosting environment or the Node backend server.
