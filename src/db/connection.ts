/**
 * PostgreSQL database connection
 */

import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', { text, error });
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

