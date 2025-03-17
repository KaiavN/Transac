import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the directory name using import.meta.url for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log('Environment variables loaded from:', envPath);
} else {
  console.warn('.env file not found at:', envPath);
  config(); // Try to load from default location
}

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'CLIENT_URL',
  'DATABASE_URL'
];

let missingVars = false;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    missingVars = true;
  }
}

if (missingVars) {
  console.error('Please check your .env file and ensure all required variables are set.');
}