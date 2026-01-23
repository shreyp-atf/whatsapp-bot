/**
 * xAI Activity Agent
 * 
 * Extracts activity information from a URL and creates activity entry if it doesn't exist.
 */

import { BaseXaiAgent } from './baseAgent';
import { ActivityRowSchema, type ActivityRow } from '../../utils/schemas';
import {
  getActivityExtractionPrompt,
  getActivityExtractionUserMessage
} from '../../utils/extractionPrompts';
import { getAllActivities, searchActivitiesByName, createActivity } from '../../../db/activity';
import { logger } from '../../utils/logging';

export interface ActivityAgentInput {
  url: string;
}

export interface ActivityAgentOutput {
  activity_id: number;
  activity_row: ActivityRow;
  created: boolean;
}

/**
 * Activity extraction agent
 */
class ActivityExtractionAgent extends BaseXaiAgent<ActivityAgentInput, ActivityRow> {
  getName(): string {
    return 'Activity Extraction Agent (xAI)';
  }

  getInstructions(): string {
    return getActivityExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract activity information.';
  }

  buildUserMessage(input: ActivityAgentInput): string {
    return getActivityExtractionUserMessage(input.url);
  }
}

/**
 * Singleton xAI Activity Agent instance
 */
export const xaiActivityAgent = new ActivityExtractionAgent(
  'Activity Extraction Agent (xAI)',
  ActivityRowSchema
);

/**
 * Extract activity from URL and create if not exists
 */
export async function extractAndCreateActivity(
  input: ActivityAgentInput,
  options?: { enableLogging?: boolean; client?: any }
): Promise<ActivityAgentOutput> {
  const { enableLogging = false, client } = options || {};

  try {
    // Extract activity information from URL
    if (enableLogging) {
      logger.info('Extracting activity information from URL', {
        url: input.url
      });
    }

    const extractionResult = await xaiActivityAgent.execute(input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw extractionResult.error || new Error('Activity extraction failed');
    }

    const activityRow = extractionResult.data;

    // Check if activity exists
    const existingActivities = await searchActivitiesByName(activityRow.name);
    
    let activityId: number;
    let created = false;

    if (existingActivities.length > 0) {
      // Use existing activity
      activityId = existingActivities[0].activity_id;
    } else {
      // Create new activity
      const allActivities = await getAllActivities();
      const maxActivityId = allActivities.length > 0 
        ? Math.max(...allActivities.map(a => a.activity_id)) 
        : 0;
      const newActivityId = maxActivityId + 1;

      const newActivity = await createActivity({
        activity_id: newActivityId,
        name: activityRow.name,
        description: activityRow.description,
        quorum: activityRow.quorum
      });
      activityId = newActivity.activity_id;
      created = true;
    }

    if (enableLogging) {
      logger.info('Activity processed', {
        activityId,
        created,
        name: activityRow.name
      });
    }

    return {
      activity_id: activityId,
      activity_row: activityRow,
      created
    };
  } catch (error) {
    logger.error('Failed to extract and create activity', error instanceof Error ? error : new Error(String(error)), {
      url: input.url
    });
    throw error;
  }
}
