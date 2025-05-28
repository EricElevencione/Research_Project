# Farm Management System Backend

This is the backend server for the Farm Management System.

## Deployment Instructions

### Deploying to Render.com

1. Create a Render account at https://render.com
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure the following settings:
   - Name: farm-management-backend
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add the following environment variables:
     - `DB_USER`: Your database username
     - `DB_HOST`: Your database host
     - `DB_NAME`: Your database name
     - `DB_PASSWORD`: Your database password
     - `DB_PORT`: Your database port (usually 5432)

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

The server will run on http://localhost:5000 