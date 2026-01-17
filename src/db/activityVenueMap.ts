/**
 * Activity Venue Map database operations (read-only)
 */

import { query } from './connection';
import { ActivityVenueMap } from '../types/database';

/**
 * Get activity venue map by id
 */
export async function getActivityVenueMapById(id: number): Promise<ActivityVenueMap | null> {
  const result = await query('SELECT * FROM public.activity_venue_map WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get activity venue map by id with full details (activity and venue)
 */
export async function getActivityVenueMapWithDetailsById(
  id: number
): Promise<(ActivityVenueMap & { activity_name: string; activity_description: string; venue_name: string; venue_address: string; venue_google_maps_location: string }) | null> {
  const result = await query(
    `SELECT 
      avm.*,
      a.name as activity_name,
      a.description as activity_description,
      v.name as venue_name,
      v.address as venue_address,
      v.google_maps_location as venue_google_maps_location
    FROM public.activity_venue_map avm
    INNER JOIN public.activity a ON avm.activity_id = a.activity_id
    INNER JOIN public.venue v ON avm.venue_id = v.venue_id
    WHERE avm.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get all activity venue maps
 */
export async function getAllActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const result = await query('SELECT * FROM public.activity_venue_map ORDER BY date DESC, start_time ASC');
  return result.rows;
}

/**
 * Get activity venue maps by activity_id
 */
export async function getActivityVenueMapsByActivityId(activityId: number): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE activity_id = $1 ORDER BY date DESC, start_time ASC',
    [activityId]
  );
  return result.rows;
}

/**
 * Get activity venue maps by venue_id
 */
export async function getActivityVenueMapsByVenueId(venueId: number): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE venue_id = $1 ORDER BY date DESC, start_time ASC',
    [venueId]
  );
  return result.rows;
}

/**
 * Get activity venue maps by date
 */
export async function getActivityVenueMapsByDate(date: Date | string): Promise<ActivityVenueMap[]> {
  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE date = $1 ORDER BY start_time ASC',
    [dateStr]
  );
  return result.rows;
}

/**
 * Get activity venue maps by date range
 */
export async function getActivityVenueMapsByDateRange(
  startDate: Date | string,
  endDate: Date | string
): Promise<ActivityVenueMap[]> {
  const startDateStr = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
  const endDateStr = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE date BETWEEN $1 AND $2 ORDER BY date ASC, start_time ASC',
    [startDateStr, endDateStr]
  );
  return result.rows;
}

/**
 * Get upcoming activity venue maps (date >= today)
 */
export async function getUpcomingActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const today = new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT * FROM public.activity_venue_map 
     WHERE date >= $1 
     ORDER BY date ASC, start_time ASC`,
    [today]
  );
  return result.rows;
}

/**
 * Get past activity venue maps (date < today)
 */
export async function getPastActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const today = new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT * FROM public.activity_venue_map 
     WHERE date < $1 
     ORDER BY date DESC, start_time DESC`,
    [today]
  );
  return result.rows;
}

/**
 * Get active activity venue maps
 */
export async function getActiveActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE is_active = true ORDER BY date ASC, start_time ASC'
  );
  return result.rows;
}

/**
 * Get public activity venue maps
 */
export async function getPublicActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE is_public = true ORDER BY date ASC, start_time ASC'
  );
  return result.rows;
}

/**
 * Get hosted activity venue maps
 */
export async function getHostedActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE is_hosted = true ORDER BY date ASC, start_time ASC'
  );
  return result.rows;
}

/**
 * Get ticketed activity venue maps
 */
export async function getTicketedActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE is_ticketed = true ORDER BY date ASC, start_time ASC'
  );
  return result.rows;
}

/**
 * Get free activity venue maps (not ticketed)
 */
export async function getFreeActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE is_ticketed = false ORDER BY date ASC, start_time ASC'
  );
  return result.rows;
}

/**
 * Get activity venue maps by ticket price range
 */
export async function getActivityVenueMapsByPriceRange(
  minPrice: number,
  maxPrice: number
): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE ticket_price BETWEEN $1 AND $2 ORDER BY ticket_price ASC, date ASC',
    [minPrice, maxPrice]
  );
  return result.rows;
}

/**
 * Get activity venue maps with max people capacity
 */
export async function getActivityVenueMapsByMaxPeople(maxPeople: number): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE max_people >= $1 ORDER BY max_people ASC, date ASC',
    [maxPeople]
  );
  return result.rows;
}

/**
 * Get activity venue maps by parallel slots
 */
export async function getActivityVenueMapsByParallelSlots(parallelSlots: number): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE parallel_slots = $1 ORDER BY date ASC, start_time ASC',
    [parallelSlots]
  );
  return result.rows;
}

/**
 * Get activity venue maps happening at a specific time range
 */
export async function getActivityVenueMapsByTimeRange(
  startTime: Date | string,
  endTime: Date | string
): Promise<ActivityVenueMap[]> {
  const startTimeStr = startTime instanceof Date ? startTime.toISOString() : startTime;
  const endTimeStr = endTime instanceof Date ? endTime.toISOString() : endTime;
  const result = await query(
    `SELECT * FROM public.activity_venue_map 
     WHERE start_time >= $1 AND end_time <= $2 
     ORDER BY start_time ASC`,
    [startTimeStr, endTimeStr]
  );
  return result.rows;
}

/**
 * Get activity venue maps overlapping with a time range
 */
export async function getActivityVenueMapsOverlappingTimeRange(
  startTime: Date | string,
  endTime: Date | string
): Promise<ActivityVenueMap[]> {
  const startTimeStr = startTime instanceof Date ? startTime.toISOString() : startTime;
  const endTimeStr = endTime instanceof Date ? endTime.toISOString() : endTime;
  const result = await query(
    `SELECT * FROM public.activity_venue_map 
     WHERE (start_time <= $2 AND end_time >= $1)
     ORDER BY start_time ASC`,
    [startTimeStr, endTimeStr]
  );
  return result.rows;
}

/**
 * Get activity venue maps for a specific activity and venue combination
 */
export async function getActivityVenueMapsByActivityAndVenue(
  activityId: number,
  venueId: number
): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE activity_id = $1 AND venue_id = $2 ORDER BY date ASC, start_time ASC',
    [activityId, venueId]
  );
  return result.rows;
}

/**
 * Get activity venue maps for a specific activity on a specific date
 */
export async function getActivityVenueMapsByActivityAndDate(
  activityId: number,
  date: Date | string
): Promise<ActivityVenueMap[]> {
  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE activity_id = $1 AND date = $2 ORDER BY start_time ASC',
    [activityId, dateStr]
  );
  return result.rows;
}

/**
 * Get activity venue maps for a specific venue on a specific date
 */
export async function getActivityVenueMapsByVenueAndDate(
  venueId: number,
  date: Date | string
): Promise<ActivityVenueMap[]> {
  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE venue_id = $1 AND date = $2 ORDER BY start_time ASC',
    [venueId, dateStr]
  );
  return result.rows;
}

/**
 * Search activity venue maps by description (case-insensitive)
 */
export async function searchActivityVenueMapsByDescription(searchTerm: string): Promise<ActivityVenueMap[]> {
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE description ILIKE $1 ORDER BY date DESC, start_time ASC',
    [`%${searchTerm}%`]
  );
  return result.rows;
}

/**
 * Get upcoming active and public activity venue maps
 */
export async function getUpcomingActivePublicActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const today = new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT * FROM public.activity_venue_map 
     WHERE date >= $1 AND is_active = true AND is_public = true 
     ORDER BY date ASC, start_time ASC`,
    [today]
  );
  return result.rows;
}

/**
 * Get activity venue maps happening today
 */
export async function getTodayActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const today = new Date().toISOString().split('T')[0];
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE date = $1 ORDER BY start_time ASC',
    [today]
  );
  return result.rows;
}

/**
 * Get activity venue maps happening this week
 */
export async function getThisWeekActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
  
  const startDateStr = startOfWeek.toISOString().split('T')[0];
  const endDateStr = endOfWeek.toISOString().split('T')[0];
  
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE date BETWEEN $1 AND $2 ORDER BY date ASC, start_time ASC',
    [startDateStr, endDateStr]
  );
  return result.rows;
}

/**
 * Get activity venue maps happening this month
 */
export async function getThisMonthActivityVenueMaps(): Promise<ActivityVenueMap[]> {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const startDateStr = startOfMonth.toISOString().split('T')[0];
  const endDateStr = endOfMonth.toISOString().split('T')[0];
  
  const result = await query(
    'SELECT * FROM public.activity_venue_map WHERE date BETWEEN $1 AND $2 ORDER BY date ASC, start_time ASC',
    [startDateStr, endDateStr]
  );
  return result.rows;
}

/**
 * Get activity venue maps count
 */
export async function getActivityVenueMapsCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.activity_venue_map');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get activity venue maps count by activity_id
 */
export async function getActivityVenueMapsCountByActivityId(activityId: number): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.activity_venue_map WHERE activity_id = $1',
    [activityId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get activity venue maps count by venue_id
 */
export async function getActivityVenueMapsCountByVenueId(venueId: number): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.activity_venue_map WHERE venue_id = $1',
    [venueId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if activity venue map exists
 */
export async function activityVenueMapExists(id: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.activity_venue_map WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

/**
 * Get activity venue maps happening at a given date/time in the same city as the user
 * Returns activity venue maps with venue details (name, address) and city name
 */
export async function getActivityVenueMapsByCityAndDateTime(
  userId: number,
  datetime: string
): Promise<Array<ActivityVenueMap & { venue_name: string; venue_address: string; city_name: string }>> {
  // Parse ISO 8601 datetime string
  const dateTime = new Date(datetime);
  const dateStr = dateTime.toISOString().split('T')[0]; // Extract date part (YYYY-MM-DD)
  const timestampStr = dateTime.toISOString(); // Full timestamp for time comparison

  const result = await query(
    `SELECT 
      avm.*,
      v.name as venue_name,
      v.address as venue_address,
      c.name as city_name
    FROM public.activity_venue_map avm
    INNER JOIN public.venue v ON avm.venue_id = v.venue_id
    INNER JOIN public.locality l ON v.locality_id = l.locality_id
    INNER JOIN public.city_region cr ON l.city_region_id = cr.city_region_id
    INNER JOIN public.city c ON cr.city_id = c.city_id
    WHERE c.city_id = (
      SELECT cr2.city_id 
      FROM public.user u
      INNER JOIN public.locality l2 ON u.locality_id = l2.locality_id
      INNER JOIN public.city_region cr2 ON l2.city_region_id = cr2.city_region_id
      WHERE u.user_id = $1
    )
    AND avm.date = $2::date
    AND avm.start_time <= $3::timestamp
    AND avm.end_time >= $3::timestamp
    AND avm.is_active = true
    ORDER BY avm.start_time ASC`,
    [userId, dateStr, timestampStr]
  );

  return result.rows;
}
