/**
 * TypeScript types for database models
 */

export interface User {
  user_id: number;
  created_at: Date;
  updated_at: Date;
  name: string | null;
  bio: string | null;
  persona_json: any | null;
  locality_id: number | null;
  conversation_id: string | null;
}

export interface Group {
  group_id: string;
  created_at: Date;
  title: string;
  description: string | null;
  added_by: number | null;
}

export interface GroupParticipant {
  id: number;
  created_at: Date;
  group_id: string;
  user_id: number;
  role: string | null;
}

export interface ConnectionGraph {
  id: number;
  created_at: Date;
  user1: number;
  user2: number;
}

export interface Activity {
  activity_id: number;
  created_at: Date;
  name: string;
  description: string;
  quorum: number;
}

export interface CreateUserInput {
  user_id: number;
  name?: string | null;
  bio?: string | null;
  persona_json?: any | null;
  locality_id?: number | null;
  conversation_id?: string | null;
}

export interface CreateActivityInput {
  activity_id: number;
  name: string;
  description: string;
  quorum: number;
}

export interface City {
  city_id: number;
  created_at: Date;
  country: string;
  name: string;
}

export interface CityRegion {
  city_region_id: number;
  created_at: Date;
  city_id: number;
  name: string;
}

export interface Locality {
  locality_id: number;
  created_at: Date;
  name: string;
  pincode: string;
  address: string;
  latitude: number;
  longitude: number;
  city_region_id: number;
}

export interface Venue {
  venue_id: number;
  created_at: Date;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_location: string;
  directions_to_reach: string | null;
  address: string;
  is_public: boolean;
  is_active: boolean;
  is_verified: boolean;
  is_approved: boolean;
  price_point: number | null;
  open_time: string;
  close_time: string;
  updated_at: Date;
  locality_id: number;
}

export interface ActivityVenueMap {
  id: number;
  created_at: Date;
  activity_id: number;
  venue_id: number;
  start_time: Date;
  end_time: Date;
  is_active: boolean;
  is_public: boolean;
  max_people: number;
  parallel_slots: number;
  is_hosted: boolean;
  date: Date;
  is_ticketed: boolean;
  ticket_price: number;
  description: string;
  img_url: string | null;
  booking_link: string;
}

export interface Plan {
  id: string; // uuid
  created_at: Date;
  start_time: Date;
  prompted_by: number;
  status: number;
  is_public: boolean;
}

export interface PlanParticipant {
  id: number;
  created_at: Date;
  plan_id: string; // uuid
  user_id: number;
  status: number;
  invited_by: number;
  interest_tier: number;
  friend_tier: number;
}

export interface CreatePlanInput {
  start_time: Date | string;
  prompted_by: number;
  status: number;
  is_public: boolean;
}

export interface UpdatePlanInput {
  start_time?: Date | string;
  status?: number;
  is_public?: boolean;
}

export interface CreatePlanParticipantInput {
  plan_id: string; // uuid
  user_id: number;
  status: number;
  invited_by: number;
  interest_tier: number;
  friend_tier: number;
}

export interface UpdatePlanParticipantInput {
  status?: number;
  interest_tier?: number;
  friend_tier?: number;
}

export interface PlanAvm {
  id: number;
  created_at: Date;
  plan_id: string; // uuid
  avm_id: number;
}

export interface CreatePlanAvmInput {
  plan_id: string; // uuid
  avm_id: number;
}

export interface UpdatePlanAvmInput {
  plan_id?: string; // uuid
  avm_id?: number;
}

export interface UserView extends User {
  connections: User[];
}

export interface PlanView extends Plan {
  participants: User[];
  avms: Array<{
    avm: ActivityVenueMap;
    activity: Activity;
    venue: Venue;
  }>;
}

