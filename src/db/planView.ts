/**
 * Plan View database operations
 * Returns nested plan data with participants and AVMs
 */

import { query } from './connection';
import { PlanView, Plan, User, ActivityVenueMap, Activity, Venue } from '../types/database';

/**
 * Get plan view with nested participants and AVMs
 * Returns plan data with array of User objects for participants
 * and array of AVMs with nested activity and venue details
 */
export async function getPlanView(planId: string): Promise<PlanView | null> {
  // Get the plan
  const planResult = await query('SELECT * FROM public.plan WHERE id = $1', [planId]);
  
  if (!planResult.rows[0]) {
    return null;
  }
  
  const plan: Plan = planResult.rows[0];
  
  // Get participants (User objects)
  const participantsResult = await query(
    `SELECT u.*
     FROM public.plan_participant pp
     INNER JOIN public.user u ON pp.user_id = u.user_id
     WHERE pp.plan_id = $1`,
    [planId]
  );
  
  const participants: User[] = participantsResult.rows || [];
  
  // Get AVMs with nested activity and venue details
  // Only select fields from avm, activity, and venue tables, not plan_avm table
  const avmsResult = await query(
    `SELECT 
       avm.id as avm_id,
       avm.created_at as avm_created_at,
       avm.activity_id as avm_activity_id,
       avm.venue_id as avm_venue_id,
       avm.start_time as avm_start_time,
       avm.end_time as avm_end_time,
       avm.is_active as avm_is_active,
       avm.is_public as avm_is_public,
       avm.max_people as avm_max_people,
       avm.parallel_slots as avm_parallel_slots,
       avm.is_hosted as avm_is_hosted,
       avm.date as avm_date,
       avm.is_ticketed as avm_is_ticketed,
       avm.ticket_price as avm_ticket_price,
       avm.description as avm_description,
       avm.img_url as avm_img_url,
       avm.booking_link as avm_booking_link,
       a.activity_id,
       a.created_at as activity_created_at,
       a.name as activity_name,
       a.description as activity_description,
       a.quorum as activity_quorum,
       v.venue_id,
       v.created_at as venue_created_at,
       v.name as venue_name,
       v.latitude as venue_latitude,
       v.longitude as venue_longitude,
       v.google_maps_location as venue_google_maps_location,
       v.directions_to_reach as venue_directions_to_reach,
       v.address as venue_address,
       v.is_public as venue_is_public,
       v.is_active as venue_is_active,
       v.is_verified as venue_is_verified,
       v.is_approved as venue_is_approved,
       v.price_point as venue_price_point,
       v.open_time as venue_open_time,
       v.close_time as venue_close_time,
       v.updated_at as venue_updated_at,
       v.locality_id as venue_locality_id
     FROM public.plan_avm pa
     INNER JOIN public.activity_venue_map avm ON pa.avm_id = avm.id
     INNER JOIN public.activity a ON avm.activity_id = a.activity_id
     INNER JOIN public.venue v ON avm.venue_id = v.venue_id
     WHERE pa.plan_id = $1
     ORDER BY avm.date ASC, avm.start_time ASC`,
    [planId]
  );
  
  // Transform the results into nested structure
  const avms = avmsResult.rows.map((row: any) => {
    const avm: ActivityVenueMap = {
      id: row.avm_id,
      created_at: row.avm_created_at,
      activity_id: row.avm_activity_id,
      venue_id: row.avm_venue_id,
      start_time: row.avm_start_time,
      end_time: row.avm_end_time,
      is_active: row.avm_is_active,
      is_public: row.avm_is_public,
      max_people: row.avm_max_people,
      parallel_slots: row.avm_parallel_slots,
      is_hosted: row.avm_is_hosted,
      date: row.avm_date,
      is_ticketed: row.avm_is_ticketed,
      ticket_price: row.avm_ticket_price,
      description: row.avm_description,
      img_url: row.avm_img_url,
      booking_link: row.avm_booking_link,
    };
    
    const activity: Activity = {
      activity_id: row.activity_id,
      created_at: row.activity_created_at,
      name: row.activity_name,
      description: row.activity_description,
      quorum: row.activity_quorum,
    };
    
    const venue: Venue = {
      venue_id: row.venue_id,
      created_at: row.venue_created_at,
      name: row.venue_name,
      latitude: row.venue_latitude,
      longitude: row.venue_longitude,
      google_maps_location: row.venue_google_maps_location,
      directions_to_reach: row.venue_directions_to_reach,
      address: row.venue_address,
      is_public: row.venue_is_public,
      is_active: row.venue_is_active,
      is_verified: row.venue_is_verified,
      is_approved: row.venue_is_approved,
      price_point: row.venue_price_point,
      open_time: row.venue_open_time,
      close_time: row.venue_close_time,
      updated_at: row.venue_updated_at,
      locality_id: row.venue_locality_id,
      type: row.venue_type || 'venue',
    };
    
    return {
      avm,
      activity,
      venue,
    };
  });
  
  return {
    ...plan,
    participants,
    avms,
  };
}

