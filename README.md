# Farmland Data Application (RSBSA Management System)

A desktop application for managing RSBSA (Registry System for Basic Sectors in Agriculture) data, farmland parcels, and distribution systems. Built with Electron, React, and PostgreSQL.

## Prerequisites

Before running the application, ensure you have the following installed:

1.  **Node.js (v16 or higher):** Download and install Node.js from [https://nodejs.org/](https://nodejs.org/). This includes npm (Node Package Manager).
2.  **PostgreSQL (v12 or higher):** Download and install PostgreSQL from [https://www.postgresql.org/download/](https://www.postgresql.org/download/). Ensure the PostgreSQL service is running.
3.  **Git (optional):** For cloning the repository.

## Database Setup

### Step 1: Create the Database

1. Open **pgAdmin 4** or your preferred PostgreSQL client.
2. Create a new database named **`Masterlist`**:
   ```sql
   CREATE DATABASE "Masterlist";
   ```

### Step 2: Initialize the Database Schema

1. Navigate to the `database` folder in the project directory.
2. Open the `create_rsbsa_tables.sql` file.
3. Execute the SQL script in your `Masterlist` database to create the necessary tables:
   - `rsbsa_draft` - Stores draft RSBSA forms
   - `rsbsa_submissions` - Stores final submitted RSBSA forms
   - `rsbsa_farmland_parcels` - Stores farmland parcel details

   **Using pgAdmin 4:**
   - Right-click on the `Masterlist` database
   - Select **Query Tool**
   - Open the `create_rsbsa_tables.sql` file or paste its contents
   - Click **Execute** (F5)

   **Using psql command line:**
   ```bash
   psql -U postgres -d Masterlist -f database/create_rsbsa_tables.sql
   ```

### Step 3: Configure Database Connection

The application uses the following default database credentials (configured in `backend/server.cjs`):

```javascript
user: 'postgres'
host: 'localhost'
database: 'Masterlist'
password: 'postgresadmin'
port: 5432
```

**To update credentials:**
1. Open `backend/server.cjs`
2. Locate the `Pool` configuration (around line 13-18)
3. Update the values to match your PostgreSQL setup

## Application Installation

### Step 1: Install Backend Dependencies

1. Open your terminal or command prompt
2. Navigate to the `backend` directory:
   ```bash
   cd path/to/Research-Project/backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Step 2: Install Frontend Dependencies

1. Navigate back to the root project directory:
   ```bash
   cd ..
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Option 1: Electron Desktop App (Recommended)

1. **Start the Backend Server:**
   - Open a terminal and navigate to the `backend` directory:
     ```bash
     cd backend
     npm start
     ```
   - Keep this terminal window open. You should see:
     ```
     Server is running on http://localhost:5000
     Successfully connected to database
     ```

2. **Launch the Electron App:**
   - Open a **new terminal** window
   - Navigate to the root project directory
   - Run the Electron development mode:
     ```bash
     npm run electron:dev
     ```
   - The desktop application window will open automatically

### Option 2: Web Browser (Development)

1. Start the backend server (see step 1 above)
2. In a new terminal, start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:5173`

## Building for Production

To create a standalone Electron application:

```bash
npm run electron:build
```

This will create distributable installers in the `dist` folder.

## Troubleshooting

### Database Connection Issues

**Error: `ECONNREFUSED` or `connection refused`**
- Ensure PostgreSQL service is running
- Verify database credentials in `backend/server.cjs`
- Check that port 5432 is not blocked by firewall

**Error: `database "Masterlist" does not exist`**
- Create the database using Step 1 of Database Setup
- Ensure the database name matches exactly (case-sensitive)

**Error: `relation "rsbsa_draft" does not exist`**
- Run the `create_rsbsa_tables.sql` script
- Verify you're connected to the correct database

### Application Issues

**Backend server won't start**
- Check if port 5000 is already in use
- Review console output for specific error messages
- Verify all backend dependencies are installed (`npm install` in backend folder)

**Electron app shows blank screen**
- Ensure backend server is running on port 5000
- Check browser console (F12) for JavaScript errors
- Verify frontend dependencies are installed

**Frontend won't connect to backend**
- Confirm backend is running and accessible at `http://localhost:5000`
- Check for CORS errors in browser console
- Ensure firewall isn't blocking local connections

### Common Solutions

1. **Reinstall dependencies:**
   ```bash
   # In root directory
   rm -rf node_modules package-lock.json
   npm install
   
   # In backend directory
   cd backend
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Reset database:**
   - Drop and recreate the `Masterlist` database
   - Re-run `create_rsbsa_tables.sql`

3. **Check Node.js version:**
   ```bash
   node --version  # Should be v16 or higher
   ```

## Project Structure

```
Research-Project/
├── backend/           # Express.js backend server
│   ├── server.cjs    # Main server file
│   ├── routes/       # API endpoints
│   └── dss-scripts/  # Decision support system scripts
├── database/          # SQL scripts for database setup
├── electron/          # Electron main and preload scripts
├── src/              # React frontend source code
└── package.json      # Project dependencies
```

## Additional Resources

- **GIS Map Reference:** https://www.google.com/maps/d/u/0/edit?hl=en&mid=15_ampwP-jkZ61_Coki20I0kG9dJrU10&ll=10.821462438695141%2C122.70912895551383&z=14

## Development Notes

- Backend runs on port 5000
- Frontend dev server runs on port 5173 (Vite)
- Electron app communicates with backend via localhost
- Database uses PostgreSQL with PostGIS extension for spatial data