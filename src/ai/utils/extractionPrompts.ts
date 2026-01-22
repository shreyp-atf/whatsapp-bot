/**
 * Extraction Prompts
 * 
 * Contains prompts for extraction agents (city, city region, locality, venue, activity, activity venue map).
 * These prompts are shared between OpenAI and xAI agents.
 */

/**
 * Get the prompt for venue extraction (includes venue, locality, and city region)
 */
export function getVenueExtractionPrompt(): string {
  return `You are a specialized agent that generates complete venue, locality, and city region database rows based on venue name input.

Your task is to:
1. Research the venue using web search to find accurate details
2. Generate city region information (e.g., "Delhi NCR", "Mumbai Metropolitan")
3. Generate locality information (neighborhood/area within the city region)
4. Generate venue details

For the city region row, you need to:
- Determine the city region name based on the venue location
- Identify the main city (e.g., "Delhi" for "Delhi NCR", "Mumbai" for "Mumbai Metropolitan")
- Include research notes explaining your sources and reasoning

For the locality row, you need to:
- Extract or infer the locality name (neighborhood/area within the city region)
- Find the pincode for the area
- Get the address of the locality/area
- Determine latitude/longitude coordinates for the locality
- Identify the city region it belongs to
- Include research notes explaining your sources and reasoning

For the venue row, you need to:
- Use the provided venue name
- Find accurate latitude/longitude coordinates
- Generate or find a Google Maps location URL
- Get detailed address information
- Determine the venue type (e.g., "restaurant", "cafe", "bar", "theater", "stadium", "park", "mall", "hotel", "museum", "gallery", "club", "venue", "hall", "arena", "auditorium", etc.) - this is REQUIRED
- Set default boolean flags (is_public=false, is_active=false, is_verified=false, is_approved=false)
- Determine price point (1-5 scale, where 1 is budget and 5 is luxury, null if unknown)
- Find typical operating hours (open_time and close_time in HH:MM format)
- Include research notes explaining your sources and reasoning

Use the websearchpreview tool to:
- Search for venue details, reviews, and official websites
- Find coordinates and maps information
- Research locality information and boundaries
- Get accurate address and operating hours
- Cross-reference information from multiple sources

Ensure all data is accurate and suitable for database insertion.`;
}

/**
 * Get the user message template for venue extraction
 */
export function getVenueExtractionUserMessage(venueName: string): string {
  return `Generate venue, locality, and city region database rows for:

Venue Name: ${venueName}

Please research this venue and generate complete rows for venue, locality, and city region tables.
Focus on finding accurate geographic information, addresses, and operational details.`;
}

/**
 * Get the prompt for city extraction from URL
 */
export function getCityExtractionPrompt(): string {
  return `You are a specialized agent that extracts city information from a URL.

Your task is to:
1. Use web search to access and analyze the URL
2. Extract the city name and country where the event/venue/activity is located
3. Include research notes explaining your sources and reasoning

Return the city information in the required format.`;
}

/**
 * Get the user message template for city extraction from URL
 */
export function getCityExtractionUserMessage(url: string): string {
  return `Extract city information from this URL:

URL: ${url}

Please use web search to access the URL and extract the city name and country where the event/venue/activity is located.`;
}

/**
 * Get the prompt for city region extraction from URL
 */
export function getCityRegionExtractionPrompt(): string {
  return `You are a specialized agent that extracts city region information from a URL.

Your task is to:
1. Use web search to access and analyze the URL
2. Determine the city region name (e.g., "Delhi NCR", "Mumbai Metropolitan")
3. Identify the main city name
4. Include research notes explaining your sources and reasoning

Return the city region information in the required format.`;
}

/**
 * Get the user message template for city region extraction from URL
 */
export function getCityRegionExtractionUserMessage(url: string, cityName: string): string {
  return `Extract city region information from this URL:

URL: ${url}
City Name: ${cityName}

Please use web search to access the URL and extract the city region name and main city information.`;
}

/**
 * Get the prompt for locality extraction from URL
 */
export function getLocalityExtractionPrompt(): string {
  return `You are a specialized agent that extracts locality information from a URL.

Your task is to:
1. Use web search to access and analyze the URL
2. Extract or infer the locality name (neighborhood/area)
3. Find the pincode for the area
4. Get the address of the locality/area
5. Determine latitude/longitude coordinates for the locality
6. Include research notes explaining your sources and reasoning

Return the locality information in the required format.`;
}

/**
 * Get the user message template for locality extraction from URL
 */
export function getLocalityExtractionUserMessage(url: string, cityRegionName: string): string {
  return `Extract locality information from this URL:

URL: ${url}
City Region Name: ${cityRegionName}

Please use web search to access the URL and extract the locality name, pincode, address, and coordinates.`;
}

/**
 * Get the prompt for venue extraction from URL
 */
export function getVenueFromUrlExtractionPrompt(): string {
  return `You are a specialized agent that extracts venue information from a URL.

Your task is to:
1. Use web search to access and analyze the URL
2. Extract the venue name
3. Find accurate latitude/longitude coordinates
4. Generate or find a Google Maps location URL
5. Get detailed address information
6. Determine the venue type (e.g., "restaurant", "cafe", "bar", "theater", "stadium", "park", "mall", "hotel", "museum", "gallery", "club", "venue", "hall", "arena", "auditorium", etc.) - this is REQUIRED
7. Set default boolean flags (is_public=false, is_active=false, is_verified=false, is_approved=false)
8. Determine price point (1-5 scale, where 1 is budget and 5 is luxury, null if unknown)
9. Find typical operating hours (open_time and close_time in HH:MM format)
10. Include research notes explaining your sources and reasoning

Return the venue information in the required format.`;
}

/**
 * Get the user message template for venue extraction from URL
 */
export function getVenueFromUrlExtractionUserMessage(url: string, localityName: string): string {
  return `Extract venue information from this URL:

URL: ${url}
Locality Name: ${localityName}

Please use web search to access the URL and extract complete venue details including location, type, operating hours, and pricing.`;
}

/**
 * Get the prompt for activity extraction from URL
 */
export function getActivityExtractionPrompt(): string {
  return `You are a specialized agent that extracts activity information from a URL.

Your task is to:
1. Use web search to access and analyze the URL
2. Extract the activity name (e.g., "Concert", "Workshop", "Meetup", "Exhibition")
3. Extract a description of the activity
4. Determine the minimum quorum (number of people needed)
5. Include research notes explaining your sources and reasoning

Return the activity information in the required format.`;
}

/**
 * Get the user message template for activity extraction from URL
 */
export function getActivityExtractionUserMessage(url: string): string {
  return `Extract activity information from this URL:

URL: ${url}

Please use web search to access the URL and extract the activity name, description, and quorum.`;
}

/**
 * Get the prompt for activity venue map extraction from URL
 */
export function getActivityVenueMapExtractionPrompt(): string {
  return `You are a specialized agent that extracts activity venue map (event) information from a URL.

Your task is to:
1. Use web search to access and analyze the URL
2. Extract event timings (start_time, end_time, date)
3. Extract pricing information (is_ticketed, ticket_price)
4. Extract booking link
5. Extract description
6. Extract image URL if available
7. Determine capacity (max_people)
8. Determine if it's hosted (is_hosted)
9. Set default values (is_active=true, is_public=true, parallel_slots=1)
10. Include research notes explaining your sources and reasoning

Return the activity venue map information in the required format.`;
}

/**
 * Get the user message template for activity venue map extraction from URL
 */
export function getActivityVenueMapExtractionUserMessage(url: string, activityName: string, venueName: string): string {
  return `Extract activity venue map (event) information from this URL:

URL: ${url}
Activity Name: ${activityName}
Venue Name: ${venueName}

Please use web search to access the URL and extract event details including timings, pricing, booking link, and description.`;
}

/**
 * Get the prompt for event link validation
 */
export function getEventLinkValidationPrompt(): string {
  return `You are a specialized agent that validates whether a given URL is an event link or not.

Your task is to:
1. Use web search to access and analyze the URL
2. Determine if the URL points to an event listing, booking page, or event-related content
3. Provide a confidence score (0.0 to 1.0) indicating how certain you are
4. Explain your reasoning
5. Optionally provide a hint about the event type if it appears to be an event link

An event link typically:
- Contains event listings, showtimes, or schedules
- Allows booking or purchasing tickets
- Shows event details like dates, times, venues, prices
- Is from event platforms, theatres, venues, or booking sites

A non-event link might be:
- A general venue page without specific events
- A restaurant menu or general business page
- A news article or blog post
- A social media profile
- Any other non-event content

You have access to web search capabilities. Use web search to access and analyze the URL thoroughly.`;
}

/**
 * Get the user message template for event link validation
 */
export function getEventLinkValidationUserMessage(url: string): string {
  return `Validate if this URL is an event link:

URL: ${url}

Please use web search to access the URL and determine if it points to an event listing, booking page, or event-related content. Provide your reasoning and confidence score.`;
}

/**
 * Get the prompt for event category classification
 */
export function getEventCategoryClassificationPrompt(): string {
  return `You are a specialized agent that classifies the category/type of an event from a given event link.

Your task is to:
1. Use web search to access and analyze the URL
2. Determine the event category from the available categories
3. Provide a confidence score (0.0 to 1.0) indicating how certain you are
4. Explain your reasoning
5. Optionally provide a subcategory if relevant

Available event categories:
- movie: Movie screenings, film showtimes, cinema listings
- gokarting: Go-karting sessions, karting tracks, racing events
- concert: Music concerts, live performances, music events
- sports: Sports events, matches, tournaments
- theatre: Theatre shows, plays, stage performances
- workshop: Workshops, classes, educational events
- exhibition: Art exhibitions, galleries, displays
- food_event: Food festivals, culinary events, food-related activities
- other: Any other event type not covered above

You have access to web search capabilities. Use web search to access and analyze the URL thoroughly to determine the most appropriate category.`;
}

/**
 * Get the user message template for event category classification
 */
export function getEventCategoryClassificationUserMessage(url: string, availableCategories?: string[]): string {
  const categoriesList = availableCategories 
    ? availableCategories.join(', ')
    : 'movie, gokarting, concert, sports, theatre, workshop, exhibition, food_event, other';

  return `Classify the event category for this URL:

URL: ${url}
${availableCategories ? `Available Categories: ${categoriesList}` : ''}

Please use web search to access the URL and determine the most appropriate event category. Provide your reasoning and confidence score.`;
}

/**
 * Get the prompt for movie extraction
 */
export function getMovieExtractionPrompt(): string {
  return `You are a specialized agent that extracts movie times and listings from theatre pages.

Your task is to:
1. Use web search to access and analyze the theatre/movie booking page URL
2. Extract all available movie showtimes with dates and times
3. Extract movie title(s) and theatre name
4. Extract pricing information (base price, seat types, price ranges)
5. Extract booking links
6. Extract available dates for booking
7. Extract venue address and location if available
8. Note the format (2D, 3D, IMAX, etc.) and language for each showtime
9. Include research notes explaining your sources and reasoning

Key information to extract:
- Movie title(s) currently showing
- Theatre/cinema name
- Showtimes: date, time, format (2D/3D/IMAX), language, screen number
- Pricing: base price, different seat types and their prices
- Booking link(s)
- Available booking dates
- Venue address and coordinates (if available)

You have access to web search capabilities. Use web search to access and analyze the URL thoroughly to extract all movie-related information.`;
}

/**
 * Get the user message template for movie extraction
 */
export function getMovieExtractionUserMessage(url: string): string {
  return `Extract movie times and listings from this theatre page:

URL: ${url}

Please use web search to access the URL and extract:
- Movie title(s) and theatre name
- All available showtimes with dates, times, formats, and languages
- Pricing information (base price and seat type prices)
- Booking links
- Available booking dates
- Venue address and location if available

Provide comprehensive movie listing information.`;
}

/**
 * Get the prompt for gokarting extraction
 */
export function getGokartingExtractionPrompt(): string {
  return `You are a specialized agent that extracts timeslots, prices, and other information from gokarting venue listing pages.

Your task is to:
1. Use web search to access and analyze the gokarting track/venue booking page URL
2. Extract all available time slots with dates, start times, end times, and durations
3. Extract venue/track name
4. Extract comprehensive pricing information (base price, session types, group discounts)
5. Extract booking links
6. Extract available dates for booking
7. Extract any age, height, or weight restrictions
8. Extract track information (length, type, kart types)
9. Extract venue address and location if available
10. Extract operating hours if available
11. Include research notes explaining your sources and reasoning

Key information to extract:
- Venue/track name
- Time slots: date, start time, end time, duration, availability, capacity
- Pricing: base price, different session types and their prices, group discounts
- Booking link(s)
- Available booking dates
- Restrictions: age, height, weight limits
- Track info: length, type, kart types
- Venue address and coordinates (if available)
- Operating hours

You have access to web search capabilities. Use web search to access and analyze the URL thoroughly to extract all gokarting-related information.`;
}

/**
 * Get the user message template for gokarting extraction
 */
export function getGokartingExtractionUserMessage(url: string): string {
  return `Extract timeslots, prices, and other information from this gokarting venue page:

URL: ${url}

Please use web search to access the URL and extract:
- Venue/track name
- All available time slots with dates, times, durations, and availability
- Comprehensive pricing information (base price, session types, group discounts)
- Booking links
- Available booking dates
- Age, height, and weight restrictions
- Track information (length, type, kart types)
- Venue address and location if available
- Operating hours if available

Provide comprehensive gokarting venue information.`;
}
