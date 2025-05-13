// connection/postgresqlConnection.ts
import { Pool } from 'pg';

const pool = new Pool({
    user: 'your_username',
    host: 'your_host',
    database: 'your_database',
    password: 'your_password',
    port: 5432,
});

export default pool;