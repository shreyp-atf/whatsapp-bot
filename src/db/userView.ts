/**
 * User View database operations
 * Returns nested user data with connections
 */

import { query } from './connection';
import { UserView, User } from '../types/database';

/**
 * Get user view with nested connections
 * Returns user data with array of connected User objects
 */
export async function getUserView(userId: number): Promise<UserView | null> {
  // Get the user
  const userResult = await query('SELECT * FROM public.user WHERE user_id = $1', [userId]);
  
  if (!userResult.rows[0]) {
    return null;
  }
  
  const user: User = userResult.rows[0];
  
  // Get connected users
  // connection_graph has user1 and user2, we need to get the other user in each connection
  const connectionsResult = await query(
    `SELECT DISTINCT u.*
     FROM public.connection_graph cg
     INNER JOIN public.user u ON u.user_id = CASE 
       WHEN cg.user1 = $1 THEN cg.user2
       WHEN cg.user2 = $1 THEN cg.user1
     END
     WHERE (cg.user1 = $1 OR cg.user2 = $1)`,
    [userId]
  );
  
  const connections: User[] = connectionsResult.rows || [];
  
  return {
    ...user,
    connections,
  };
}

