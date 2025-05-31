# Farmland Data Application

This application allows you to view farmland data and related information.

## Prerequisites

Before running the application, ensure you have the following installed:

1.  **Node.js:** Download and install Node.js from [https://nodejs.org/](https://nodejs.org/). This includes npm (Node Package Manager).
2.  **PostgreSQL:** Ensure PostgreSQL is installed and running on your machine.
3.  **Database Setup:** The application requires a PostgreSQL database named `Masterlist` with a table named `masterlist` in the `public` schema. This table should contain the following columns (names must match exactly, including capitalization and spaces):
    *   "FIRST NAME"
    *   "MIDDLE NAME" (nullable)
    *   "EXT NAME" (nullable)
    *   "GENDER"
    *   "BIRTHDATE"
    *   "FARMER ADDRESS"
    *   "PARCEL NO."
    *   "PARCEL ADDRESS"
    *   "PARCEL AREA"
    *   (Optionally, a geometry column for the map, if you decide to include it later)

    You may need to import your data into this table.

## Running the Application

1.  **Open your terminal or command prompt.**
2.  **Navigate to the `backend` directory** within the application folder.
    ```bash
    cd path/to/application/backend
    ```
3.  **Install backend dependencies.** This only needs to be done once.
    ```bash
    npm install
    ```
4.  **Update Database Credentials.** Open the `server.cjs` file in the `backend` directory and update the database connection details (user, password, host, port) to match your local PostgreSQL setup.
5.  **Start the backend server.**
    ```bash
    npm start
    ```
    Keep this terminal window open.

6.  **Access the application.** Open your web browser and go to `http://localhost:5000`.

The backend server will serve the frontend application, and the frontend will fetch data from the backend's API, which in turn reads from your PostgreSQL database.

## Troubleshooting

*   If you see "ECONNREFUSED" errors in the terminal where you ran `npm start`, ensure the PostgreSQL service is running and the database connection details in `backend/server.cjs` are correct.
*   If you see "relation \"masterlist\" does not exist" or "column \"XYZ\" does not exist" errors in the backend terminal, double-check the database name, table name, and column names in the `backend/server.cjs` SQL query against your actual PostgreSQL database schema (using a tool like pgAdmin4).
*   If the browser shows a blank page or frontend errors, open the browser's developer console (F12) and look for JavaScript errors.

---
