// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from multiple locations
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// IMPORTANT: Disable TLS certificate validation for development
// Remove this in production and use proper certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Set fallback for DATABASE_URL if not found
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not found in environment, using fallback value');
  process.env.DATABASE_URL = "postgres://avnadmin:AVNS_-Yo7LbzBA9ZS4fNDu93@transac-transac-database.g.aivencloud.com:15207/defaultdb?sslmode=require";
}

// Now import other dependencies
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import * as schema from '@shared/schema';
import * as organizationSchema from '@shared/organizations';

// Hide sensitive connection details in logs
const connectionStringForLog = process.env.DATABASE_URL?.includes('@') 
  ? process.env.DATABASE_URL.split('@')[0].split(':')[0] + ':****@' + process.env.DATABASE_URL.split('@')[1]
  : 'Invalid connection string format';
console.log('Creating database pool with URL:', connectionStringForLog);

// Configure the pool with SSL options to handle self-signed certificates
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Enable SSL but don't validate certificates
  ssl: {
    rejectUnauthorized: false
  }
});

// Add connection event handlers
pool.on('connect', () => {
  console.log('Connected to database successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

// Create and export the drizzle database instance
export const db = drizzle(pool, {
  schema: { ...schema, ...organizationSchema }
});

// Helper function to handle database errors
export function handleDbError(error: unknown) {
  console.error('Database error:', error);
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected database error occurred';
}

// Test the connection asynchronously without blocking startup
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection test successful');
  } catch (err) {
    console.error('Database connection test failed:', err);
    // Continue execution even if the test fails
  }
})();