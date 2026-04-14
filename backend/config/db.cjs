const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const parseBooleanEnv = (value, defaultValue) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "require"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off", "disable"].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const getRequiredSupabaseConnectionString = () => {
  const connectionString =
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "";

  if (!connectionString) {
    throw new Error(
      "Supabase database URL is required. Set SUPABASE_DB_URL (preferred) or DATABASE_URL in backend/.env.",
    );
  }

  let hostname = "";
  try {
    hostname = new URL(connectionString).hostname.toLowerCase();
  } catch (error) {
    throw new Error(
      "Invalid Supabase connection string. Ensure SUPABASE_DB_URL is a valid PostgreSQL URL.",
    );
  }

  const isSupabaseHost =
    hostname.includes("supabase.co") || hostname.includes("supabase.com");

  if (!isSupabaseHost) {
    throw new Error(
      `Non-Supabase database host detected (${hostname}). Configure SUPABASE_DB_URL with your Supabase Postgres URL.`,
    );
  }

  return connectionString;
};

const createPoolConfig = () => {
  const connectionString = getRequiredSupabaseConnectionString();
  const sharedPoolOptions = {
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  };

  const sslEnabled = parseBooleanEnv(process.env.DB_SSL, true);
  const rejectUnauthorized = parseBooleanEnv(
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
    false,
  );

  const config = {
    connectionString,
    ...sharedPoolOptions,
  };

  if (sslEnabled) {
    config.ssl = { rejectUnauthorized };
  }

  return config;
};

const createPool = () => new Pool(createPoolConfig());

module.exports = {
  createPool,
  createPoolConfig,
};
