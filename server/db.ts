import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { clubs, events, users, userPreferences, hiddenEvents } from '../shared/schema';
import config from './config';

// Create PostgreSQL connection pool
console.log('Connecting to PostgreSQL database...');

// Verify we have database environment variables
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set!');
  console.error('Available environment variables:', Object.keys(process.env).filter(k => k.includes('PG') || k.includes('DATABASE')).join(', '));
  throw new Error('DATABASE_URL environment variable is required');
}

// Get connection details from environment
const dbConnectionString = process.env.DATABASE_URL;

console.log('Using database connection string:', 
  dbConnectionString ? 
  `${dbConnectionString.split('://')[0]}://*****@${dbConnectionString.split('@')[1] || '[masked]'}` : 
  'Invalid connection string');

// Configure PostgreSQL connection pool
const pool = new Pool({
  // Use full connection string from environment variable
  connectionString: dbConnectionString,
  
  // Always disable SSL certificate verification for Replit (both dev and prod)
  ssl: { rejectUnauthorized: false },
  
  // Improved connection settings for cloud hosted databases (like Neon)
  connectionTimeoutMillis: 15000, // longer timeout for initial connection
  max: 10, // reduce maximum clients to prevent connection errors
  idleTimeoutMillis: 20000, // reduce idle timeout to release connections faster
  
  // Force these settings to prevent any fallback to localhost
  host: process.env.PGHOST || (dbConnectionString ? new URL(dbConnectionString).hostname : undefined),
  port: parseInt(process.env.PGPORT || (dbConnectionString ? new URL(dbConnectionString).port : '5432')),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

// Log database connection info for debugging
console.log('Database connection configured with:', {
  url: process.env.DATABASE_URL ? 
       `${process.env.DATABASE_URL.split('://')[0]}://*****@${process.env.DATABASE_URL.split('@')[1] || '[masked]'}` : 
       'DATABASE_URL not set',
  ssl: { rejectUnauthorized: false }
});

// Create drizzle database instance
export const db = drizzle(pool, {
  schema: {
    clubs,
    events,
    users,
    userPreferences,
    hiddenEvents
  }
});

// Helper function to initialize database
export async function initializeDatabase() {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 3000;
  
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      console.log(`Connecting to PostgreSQL database (attempt ${retries + 1}/${MAX_RETRIES}) with URL:`, 
        process.env.DATABASE_URL ? 
        `${process.env.DATABASE_URL.split('://')[0]}://${process.env.DATABASE_URL.split('@')[1] || '[redacted]'}` : 
        'DATABASE_URL not set');
      
      // Test connection
      const client = await pool.connect();
      console.log('PostgreSQL database connected successfully');
      
      // Get database version to verify connection
      const res = await client.query('SELECT version()');
      console.log('PostgreSQL version:', res.rows[0].version);
      
      client.release();
      
      // In a production environment, you would use a migration tool
      // For this project, we'll create tables if they don't exist
      await createTablesIfNotExist();
      
      return true;
    } catch (error) {
      retries++;
      console.error(`Database initialization error (attempt ${retries}/${MAX_RETRIES}):`, error);
      
      // Add additional error details for debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.error('Max retries reached. Failed to connect to database.');
        return false;
      }
    }
  }
  
  return false;
}

// Create tables if they don't exist
async function createTablesIfNotExist() {
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        strava_user_id TEXT NOT NULL UNIQUE,
        strava_access_token TEXT NOT NULL,
        strava_refresh_token TEXT NOT NULL,
        strava_token_expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create clubs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS clubs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        strava_club_id TEXT NOT NULL UNIQUE,
        strava_club_url TEXT NOT NULL,
        admin_email TEXT NOT NULL,
        website TEXT,
        pace_categories TEXT[] NOT NULL,
        distance_ranges TEXT[] NOT NULL,
        meeting_frequency TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT,
        approved BOOLEAN DEFAULT FALSE,
        strava_access_token TEXT DEFAULT '',
        strava_refresh_token TEXT DEFAULT '',
        strava_token_expires_at TIMESTAMP DEFAULT '1970-01-01 00:00:00',
        last_event_date TIMESTAMP,
        avg_participants INTEGER DEFAULT 0,
        participants_count INTEGER DEFAULT 0,
        events_count INTEGER DEFAULT 0,
        club_score INTEGER DEFAULT 0
      )
    `);
    
    // Create events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        strava_event_id TEXT NOT NULL UNIQUE,
        club_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        location TEXT,
        distance INTEGER,
        pace TEXT,
        pace_category TEXT,
        beginner_friendly BOOLEAN DEFAULT FALSE,
        strava_event_url TEXT NOT NULL
      )
    `);
    
    // Create user_preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        club_filters TEXT[],
        pace_filters TEXT[],
        distance_filters TEXT[],
        beginner_friendly_filter BOOLEAN,
        calendar_view TEXT DEFAULT 'month'
      )
    `);
    
    // Create hidden_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hidden_events (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, event_id)
      )
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Database tables created or verified successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
}