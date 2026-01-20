/**
 * PostgreSQL database connection
 */

import { Pool, PoolClient, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configure pg to parse bigint (int8) as numbers instead of strings
// This is safe for IDs (user_id, locality_id, etc.) as they fit within JavaScript's safe integer range
types.setTypeParser(types.builtins.INT8, (val: string) => {
  return parseInt(val, 10);
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Test the connection
pool.on('connect', () => {
  console.log('✓ Database connected');
});

pool.on('error', (err) => {
  console.error('✗ Database connection error:', err);
});

export const getPool = (): Pool => pool;

export const query = async (text: string, params?: any[]): Promise<any> => {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

/**
 * Ping the database to verify connection
 * Returns true if connection is successful, false otherwise
 */
export const pingDatabase = async (): Promise<boolean> => {
  try {
    const result = await pool.query('SELECT 1 as ping');
    return result.rows[0]?.ping === 1;
  } catch (error) {
    console.error('Database ping failed:', error);
    return false;
  }
};

export default pool;

