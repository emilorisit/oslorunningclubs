import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { clubs, events, users, userPreferences, hiddenEvents } from '../shared/schema';
import config from './config';

// Create PostgreSQL connection pool
// Make sure to use the proper connection details from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // In production/deployment we want SSL but not in development
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Log connection attempt to help debug
  connectionTimeoutMillis: 5000,
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
  try {
    console.log('Connecting to PostgreSQL database with URL:', 
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
    console.error('Database initialization error:', error);
    // Add additional error details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return false;
  }
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