/**
 * Plan Optimizer Module
 * 
 * This module optimizes plans for users by:
 * 1. Fetching user view
 * 2. Fetching all activities
 * 3. Evaluating each activity against user persona using AI
 * 4. Finding suitable venues near user's locality for approved activities
 * 5. Creating plans with participants from user's connection graph
 */

import * as fs from 'fs';
import * as path from 'path';
import { getUserView } from '../../db/userView';
import { getAllActivities } from '../../db/activity';
import { getActivityVenueMapsByActivityId } from '../../db/activityVenueMap';
import { getLocalitiesNearCoordinates, getLocalityById } from '../../db/locality';
import { createPlan } from '../../db/plan';
import { createPlanAvm } from '../../db/planAvm';
import { createPlanParticipant } from '../../db/planParticipant';
import { query } from '../../db/connection';
import { aiClient } from '../index';
import { UserView, Activity, ActivityVenueMap, Locality } from '../../types/database';

/**
 * Load the user emulation prompt template
 */
function loadPromptTemplate(): string {
  const promptPath = path.join(__dirname, 'user_emulation_prompt.md');
  return fs.readFileSync(promptPath, 'utf-8');
}

/**
 * Replace placeholders in prompt template with actual values
 */
function formatPrompt(template: string, user: UserView, plan: Activity): string {
  // Format user data as JSON string for the prompt
  const userData = JSON.stringify({
    user_id: user.user_id,
    name: user.name,
    bio: user.bio,
    persona_json: user.persona_json,
    locality_id: user.locality_id,
  }, null, 2);

  // Format activity/plan data as JSON string
  const planData = JSON.stringify({
    activity_id: plan.activity_id,
    name: plan.name,
    description: plan.description,
    quorum: plan.quorum,
  }, null, 2);

  return template
    .replace('{user}', userData)
    .replace('{plan}', planData);
}

/**
 * Parse AI response to determine if it's a YES, DEPENDS, or NO
 */
function parseAIResponse(response: string): 'YES' | 'DEPENDS' | 'NO' {
  const upperResponse = response.trim().toUpperCase();
  
  if (upperResponse.includes('YES') && !upperResponse.includes('NO')) {
    return 'YES';
  }
  
  if (upperResponse.includes('DEPENDS')) {
    return 'DEPENDS';
  }
  
  return 'NO';
}

/**
 * Find activity venue maps near user's locality
 * Returns AVMs for the given activity that are in localities near the user's locality
 */
async function findAVMsNearUserLocality(
  activityId: number,
  userLocalityId: number | null
): Promise<ActivityVenueMap[]> {
  if (!userLocalityId) {
    // If user has no locality, return all active AVMs for the activity
    const allAVMs = await getActivityVenueMapsByActivityId(activityId);
    return allAVMs.filter(avm => avm.is_active);
  }

  // Get user's locality to find nearby localities
  const userLocality = await getLocalityById(userLocalityId);
  if (!userLocality) {
    // If locality not found, return all active AVMs for the activity
    const allAVMs = await getActivityVenueMapsByActivityId(activityId);
    return allAVMs.filter(avm => avm.is_active);
  }

  // Find nearby localities (within 10km radius)
  const nearbyLocalities = await getLocalitiesNearCoordinates(
    userLocality.latitude,
    userLocality.longitude,
    10 // 10km radius
  );

  const localityIds = nearbyLocalities.map(l => l.locality_id);

  if (localityIds.length === 0) {
    // No nearby localities found, return all active AVMs for the activity
    const allAVMs = await getActivityVenueMapsByActivityId(activityId);
    return allAVMs.filter(avm => avm.is_active);
  }

  // Query AVMs for this activity where venues are in nearby localities
  const placeholders = localityIds.map((_, index) => `$${index + 1}`).join(', ');
  
  const result = await query(
    `SELECT avm.* 
     FROM public.activity_venue_map avm
     INNER JOIN public.venue v ON avm.venue_id = v.venue_id
     WHERE avm.activity_id = $${localityIds.length + 1}
     AND v.locality_id IN (${placeholders})
     AND avm.is_active = true
     ORDER BY avm.date ASC, avm.start_time ASC`,
    [...localityIds, activityId]
  );

  return result.rows;
}

/**
 * Get all users in the connection graph starting from the given user
 * This includes the user themselves and all their connections
 */
function getAllUsersInConnectionGraph(userView: UserView): number[] {
  const userIds = new Set<number>();
  
  // Add the user themselves
  userIds.add(userView.user_id);
  
  // Add all connected users
  userView.connections.forEach(connection => {
    userIds.add(connection.user_id);
  });
  
  return Array.from(userIds);
}

/**
 * Create a plan with all necessary entries
 */
async function createPlanWithDetails(
  activityId: number,
  avmId: number,
  userView: UserView,
  avm: ActivityVenueMap
): Promise<string> {
  // Get all users in connection graph
  const participantUserIds = getAllUsersInConnectionGraph(userView);
  
  // Create the plan
  const plan = await createPlan({
    start_time: avm.start_time,
    prompted_by: userView.user_id,
    status: 0, // Default status (you may want to adjust this)
    is_public: false, // Default to private (you may want to adjust this)
  });

  // Create plan_avm entry
  await createPlanAvm({
    plan_id: plan.id,
    avm_id: avmId,
  });

  // Create plan_participant entries for all users in connection graph
  for (const userId of participantUserIds) {
    await createPlanParticipant({
      plan_id: plan.id,
      user_id: userId,
      status: 0, // Default status (pending/invited)
      invited_by: userView.user_id,
      interest_tier: userId === userView.user_id ? 10 : 5, // Higher tier for the user themselves
      friend_tier: userId === userView.user_id ? 10 : 5, // Higher tier for the user themselves
    });
  }

  return plan.id;
}

/**
 * Main optimization function
 * Optimizes plans for a given user
 */
export async function optimizePlansForUser(userId: number): Promise<{
  plansCreated: number;
  activitiesEvaluated: number;
  activitiesApproved: number;
  planIds: string[];
}> {
  const planIds: string[] = [];
  let activitiesEvaluated = 0;
  let activitiesApproved = 0;

  try {
    // Step 1: Fetch user view
    const userView = await getUserView(userId);
    if (!userView) {
      throw new Error(`User with id ${userId} not found`);
    }

    // Step 2: Fetch all activities
    const activities = await getAllActivities();

    // Load prompt template
    const promptTemplate = loadPromptTemplate();

    // Step 3: Evaluate each activity
    for (const activity of activities) {
      activitiesEvaluated++;

      // Format prompt with user and activity data
      const prompt = formatPrompt(promptTemplate, userView, activity);

      // Get AI response
      const aiResponse = await aiClient.getResponse(prompt, {
        temperature: 0.3, // Lower temperature for more consistent responses
        maxTokens: 10, // Short response expected
      });

      // Parse response
      const decision = parseAIResponse(aiResponse);

      // Step 4: If YES, find suitable AVM and create plan
      if (decision === 'YES') {
        activitiesApproved++;

        // Find AVMs near user's locality
        const suitableAVMs = await findAVMsNearUserLocality(
          activity.activity_id,
          userView.locality_id
        );

        // Create a plan for the first suitable AVM found
        if (suitableAVMs.length > 0) {
          const selectedAVM = suitableAVMs[0]; // Select first suitable AVM
          
          const planId = await createPlanWithDetails(
            activity.activity_id,
            selectedAVM.id,
            userView,
            selectedAVM
          );

          planIds.push(planId);
        }
      }
    }

    return {
      plansCreated: planIds.length,
      activitiesEvaluated,
      activitiesApproved,
      planIds,
    };
  } catch (error) {
    console.error('Error optimizing plans for user:', error);
    throw error;
  }
}
