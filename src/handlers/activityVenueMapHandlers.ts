/**
 * Activity Venue Map API Handlers
 * Handlers for activity venue map-related endpoints
 */

import { Request, Response } from 'express';
import { getActivityVenueMapWithDetailsById, getActivityVenueMapsByCityAndDateTime } from '../db/activityVenueMap';
import { getUserById } from '../db/user';
import { periskopeClient } from '../services/periskope';

/**
 * Get activity venue map by ID
 * GET /api/activity-venue-maps/:id
 */
export async function handleGetActivityVenueMap(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'id must be a valid number'
      });
      return;
    }

    console.log(`[API] Fetching activity venue map`, {
      id
    });

    // Get the activity venue map with full details (activity and venue)
    const avm = await getActivityVenueMapWithDetailsById(id);
    
    if (!avm) {
      res.status(404).json({
        success: false,
        error: `Activity venue map with id ${id} not found`
      });
      return;
    }

    res.status(200).json({
      success: true,
      activityVenueMap: {
        id: avm.id,
        created_at: avm.created_at,
        activity_id: avm.activity_id,
        activity_name: avm.activity_name,
        activity_description: avm.activity_description,
        venue_id: avm.venue_id,
        venue_name: avm.venue_name,
        venue_address: avm.venue_address,
        venue_google_maps_location: avm.venue_google_maps_location,
        start_time: avm.start_time,
        end_time: avm.end_time,
        date: avm.date,
        is_active: avm.is_active,
        is_public: avm.is_public,
        is_hosted: avm.is_hosted,
        is_ticketed: avm.is_ticketed,
        ticket_price: avm.ticket_price,
        max_people: avm.max_people,
        parallel_slots: avm.parallel_slots,
        description: avm.description,
        img_url: avm.img_url,
        booking_link: avm.booking_link
      }
    });
  } catch (error) {
    console.error('Error fetching activity venue map:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Send event details as WhatsApp message to user
 * POST /api/send-event-details
 * Body: { activityVenueMapId: number, userId: number }
 */
export async function handleSendEventDetails(req: Request, res: Response): Promise<void> {
  try {
    const { activityVenueMapId, userId } = req.body;

    if (typeof activityVenueMapId !== 'number' || isNaN(activityVenueMapId)) {
      res.status(400).json({
        success: false,
        error: 'activityVenueMapId must be a valid number'
      });
      return;
    }

    if (typeof userId !== 'number' || isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: 'userId must be a valid number'
      });
      return;
    }

    console.log(`[API] Sending event details`, {
      activityVenueMapId,
      userId
    });

    // Get the activity venue map with full details
    const eventDetails = await getActivityVenueMapWithDetailsById(activityVenueMapId);
    
    if (!eventDetails) {
      res.status(404).json({
        success: false,
        error: `Activity venue map with id ${activityVenueMapId} not found`
      });
      return;
    }

    // Verify user exists
    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: `User with id ${userId} not found`
      });
      return;
    }

    // Format the event details message
    const formatDate = (date: Date | string): string => {
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const formatTime = (time: Date | string): string => {
      const t = time instanceof Date ? time : new Date(time);
      return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const message = `🎉 *${eventDetails.activity_name}*

📅 *Date:* ${formatDate(eventDetails.date)}
⏰ *Time:* ${formatTime(eventDetails.start_time)} - ${formatTime(eventDetails.end_time)}

📍 *Venue:* ${eventDetails.venue_name}
${eventDetails.venue_address ? `📍 *Address:* ${eventDetails.venue_address}` : ''}
${eventDetails.venue_google_maps_location ? `🗺️ *Location:* ${eventDetails.venue_google_maps_location}` : ''}

📝 *Description:* ${eventDetails.description || eventDetails.activity_description || 'No description available'}

${eventDetails.is_ticketed ? `💰 *Ticket Price:* ${eventDetails.ticket_price ? `₹${eventDetails.ticket_price}` : 'Free'}` : '🆓 *Free Event*'}
${eventDetails.max_people ? `👥 *Max Capacity:* ${eventDetails.max_people} people` : ''}
${eventDetails.booking_link ? `🔗 *Book Now:* ${eventDetails.booking_link}` : ''}
${eventDetails.img_url ? `🖼️ *Image:* ${eventDetails.img_url}` : ''}

Hope to see you there! 🎊`;

    // Construct chatId from userId (format: <user_id>@c.us)
    const chatId = `${userId}@c.us`;

    // Send message via WhatsApp
    await periskopeClient.sendMessage(chatId, message);

    console.log(`[API] Event details sent successfully`, {
      activityVenueMapId,
      userId,
      chatId
    });

    res.status(200).json({
      success: true,
      message: 'Event details sent successfully',
      activityVenueMapId,
      userId,
      chatId
    });
  } catch (error) {
    console.error('Error sending event details:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Fetch activity venue maps by city and datetime
 * POST /api/activity-venue-maps
 * Body: { userId: number, datetime: string (ISO 8601) }
 */
export async function handleGetActivityVenueMaps(req: Request, res: Response): Promise<void> {
  try {
    const { userId, datetime } = req.body;

    if (typeof userId !== 'number' || isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: 'userId must be a valid number'
      });
      return;
    }

    if (typeof datetime !== 'string' || !datetime) {
      res.status(400).json({
        success: false,
        error: 'datetime must be a valid ISO 8601 string (e.g., "2024-01-15T18:00:00Z")'
      });
      return;
    }

    // Validate datetime format
    const dateTime = new Date(datetime);
    if (isNaN(dateTime.getTime())) {
      res.status(400).json({
        success: false,
        error: 'datetime must be a valid ISO 8601 datetime string'
      });
      return;
    }

    console.log(`[API] Fetching activity venue maps`, {
      userId,
      datetime
    });

    const results = await getActivityVenueMapsByCityAndDateTime(userId, datetime);

    // Format results for the response
    const formattedResults = results.map((avm) => ({
      id: avm.id,
      activity_id: avm.activity_id,
      venue_id: avm.venue_id,
      venue_name: avm.venue_name,
      venue_address: avm.venue_address,
      city_name: avm.city_name,
      date: avm.date,
      start_time: avm.start_time,
      end_time: avm.end_time,
      description: avm.description,
      max_people: avm.max_people,
      is_ticketed: avm.is_ticketed,
      ticket_price: avm.ticket_price,
      booking_link: avm.booking_link,
      img_url: avm.img_url,
    }));

    console.log(`[API] Completed fetching activity venue maps`, {
      userId,
      datetime,
      resultCount: formattedResults.length
    });

    res.status(200).json({
      success: true,
      userId,
      datetime,
      count: formattedResults.length,
      results: formattedResults
    });
  } catch (error) {
    console.error('Error fetching activity venue maps:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
