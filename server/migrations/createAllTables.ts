import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import pg from 'pg';
const { Pool } = pg;

// Disable TLS certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function createAllTables() {
  console.log('Creating all necessary tables...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    console.log('Connected to database. Creating tables...');
    
    // Drop existing tables if they exist (be careful with this in production)
    console.log('Dropping existing tables...');
    await pool.query(`
      DROP TABLE IF EXISTS contract_parties CASCADE;
      DROP TABLE IF EXISTS payment_splits CASCADE;
      DROP TABLE IF EXISTS contracts CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
    `);
    
    // Create users table with INCREASED signature_key length to 255
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255),
        "username" VARCHAR(50),
        "full_name" VARCHAR(100),
        "signature_key" VARCHAR(255),
        "is_business_account" BOOLEAN DEFAULT false,
        "organization_id" UUID,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "google_id" VARCHAR(255) UNIQUE,
        "payment" JSONB,
        "contracts" JSONB DEFAULT '[]'
      );
    `);
    console.log('Users table created');
    
    // Create organizations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "country" VARCHAR(100) NOT NULL,
        "registration_number" VARCHAR(100) NOT NULL,
        "address" TEXT NOT NULL,
        "billing_account" JSONB NOT NULL,
        "receiving_account" JSONB NOT NULL,
        "employees" JSONB DEFAULT '[]',
        "employee_requests" JSONB DEFAULT '[]',
        "admin_users" JSONB DEFAULT '[]',
        "activity_log" JSONB DEFAULT '[]',
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('Organizations table created');
    
    // Create contracts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "contracts" (
        "id" SERIAL PRIMARY KEY,
        "prompt" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "validation_results" JSONB NOT NULL,
        "is_valid" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "user_id" UUID REFERENCES "users"("id")
      );
    `);
    console.log('Contracts table created');
    
    // Create contract_parties table with INCREASED signature_key length to 255
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "contract_parties" (
        "id" SERIAL PRIMARY KEY,
        "contract_id" INTEGER REFERENCES "contracts"("id"),
        "user_id" UUID REFERENCES "users"("id"),
        "has_confirmed" BOOLEAN DEFAULT false,
        "signature_key" VARCHAR(255),
        "signed_at" TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('Contract parties table created');
    
    // Create payment_splits table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "payment_splits" (
        "id" SERIAL PRIMARY KEY,
        "proposer_id" UUID NOT NULL,
        "splits" JSONB NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
        "counter_offer" JSONB,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('Payment splits table created');
    
    console.log('All tables created successfully');
    await pool.end();
  } catch (error) {
    console.error('Error creating database tables:', error);
    await pool.end();
    process.exit(1);
  }
}

createAllTables();