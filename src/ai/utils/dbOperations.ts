/**
 * Database Operations Abstraction
 * 
 * Provides generic helpers for common database patterns like find-or-create
 * with similarity matching. Used by both OpenAI and xAI agents.
 */

import { PoolClient } from 'pg';
import { logger } from './logging';
import { AgentError, AgentErrorType } from './errorHandling';

/**
 * Similarity matching result
 */
export interface SimilarityResult {
  closest_match_id: number | null;
  confidence_score: number;
  reasoning: string;
  should_create_new: boolean;
}

/**
 * Similarity matcher interface
 */
export interface SimilarityMatcher<TEntity, TExistingEntity> {
  findClosestMatch(
    newEntity: TEntity,
    existingEntities: TExistingEntity[],
    options?: { enableLogging?: boolean }
  ): Promise<SimilarityResult>;
}

/**
 * Options for find-or-create operations
 */
export interface FindOrCreateOptions {
  similarityThreshold?: number;
  enableLogging?: boolean;
  client?: PoolClient;
}

/**
 * Result of find-or-create operation
 */
export interface FindOrCreateResult<TEntity> {
  entity: TEntity;
  id: number;
  created: boolean;
  matchedId?: number;
  confidenceScore?: number;
}

/**
 * Generic find-or-create with similarity matching
 * 
 * @param entity - The new entity to find or create
 * @param findFn - Function to find existing entity by direct lookup
 * @param getAllFn - Function to get all existing entities for similarity matching
 * @param similarityFn - Function to perform similarity matching
 * @param createFn - Function to create new entity
 * @param options - Options including similarity threshold and transaction client
 */
export async function findOrCreateWithSimilarity<TEntity, TExistingEntity extends { [key: string]: any }>(
  entity: TEntity,
  findFn: (entity: TEntity, client?: PoolClient) => Promise<TExistingEntity | null>,
  getAllFn: (client?: PoolClient) => Promise<TExistingEntity[]>,
  similarityFn: SimilarityMatcher<TEntity, TExistingEntity>,
  createFn: (entity: TEntity, client?: PoolClient) => Promise<TExistingEntity>,
  getIdFn: (entity: TExistingEntity) => number,
  options: FindOrCreateOptions = {}
): Promise<FindOrCreateResult<TExistingEntity>> {
  const {
    similarityThreshold = 0.8,
    enableLogging = false,
    client
  } = options;

  try {
    // First, try direct lookup
    const existing = await findFn(entity, client);
    if (existing) {
      if (enableLogging) {
        logger.debug('Found existing entity via direct lookup', {
          id: getIdFn(existing)
        });
      }
      return {
        entity: existing,
        id: getIdFn(existing),
        created: false
      };
    }

    // If not found, get all entities for similarity matching
    const allEntities = await getAllFn(client);
    
    if (allEntities.length === 0) {
      // No existing entities, create new one
      if (enableLogging) {
        logger.debug('No existing entities found, creating new entity');
      }
      const newEntity = await createFn(entity, client);
      return {
        entity: newEntity,
        id: getIdFn(newEntity),
        created: true
      };
    }

    // Perform similarity matching
    const similarityStart = enableLogging ? Date.now() : 0;
    const similarityResult = await similarityFn.findClosestMatch(entity, allEntities, { enableLogging });
    
    if (enableLogging) {
      const similarityTime = Date.now() - similarityStart;
      logger.debug('Similarity matching completed', {
        duration: similarityTime,
        confidenceScore: similarityResult.confidence_score,
        closestMatchId: similarityResult.closest_match_id
      });
    }

    // Check if similarity match is good enough
    if (
      similarityResult.closest_match_id !== null &&
      similarityResult.confidence_score >= similarityThreshold
    ) {
      const matchedEntity = allEntities.find(e => getIdFn(e) === similarityResult.closest_match_id);
      if (matchedEntity) {
        if (enableLogging) {
          logger.debug('Using similar entity', {
            id: getIdFn(matchedEntity),
            confidenceScore: similarityResult.confidence_score
          });
        }
        return {
          entity: matchedEntity,
          id: getIdFn(matchedEntity),
          created: false,
          matchedId: similarityResult.closest_match_id,
          confidenceScore: similarityResult.confidence_score
        };
      }
    }

    // No good match found, create new entity
    if (enableLogging) {
      logger.debug('No good similarity match found, creating new entity', {
        bestConfidenceScore: similarityResult.confidence_score
      });
    }
    const newEntity = await createFn(entity, client);
    return {
      entity: newEntity,
      id: getIdFn(newEntity),
      created: true
    };
  } catch (error) {
    const dbError = error instanceof Error
      ? new AgentError(
          `Database operation failed: ${error.message}`,
          AgentErrorType.DATABASE,
          false,
          undefined,
          error
        )
      : new AgentError(
          'Database operation failed',
          AgentErrorType.DATABASE
        );
    
    logger.error('Database operation failed', dbError.originalError || dbError, {
      operation: 'findOrCreateWithSimilarity'
    });
    
    throw dbError;
  }
}

/**
 * Simple find-or-create without similarity matching
 * 
 * @param entity - The new entity to find or create
 * @param findFn - Function to find existing entity
 * @param createFn - Function to create new entity
 * @param getIdFn - Function to extract ID from entity
 * @param options - Options including transaction client
 */
export async function findOrCreate<TEntity, TExistingEntity extends { [key: string]: any }>(
  entity: TEntity,
  findFn: (entity: TEntity, client?: PoolClient) => Promise<TExistingEntity | null>,
  createFn: (entity: TEntity, client?: PoolClient) => Promise<TExistingEntity>,
  getIdFn: (entity: TExistingEntity) => number,
  options: { enableLogging?: boolean; client?: PoolClient } = {}
): Promise<FindOrCreateResult<TExistingEntity>> {
  const { enableLogging = false, client } = options;

  try {
    const existing = await findFn(entity, client);
    if (existing) {
      if (enableLogging) {
        logger.debug('Found existing entity', {
          id: getIdFn(existing)
        });
      }
      return {
        entity: existing,
        id: getIdFn(existing),
        created: false
      };
    }

    // Create new entity
    if (enableLogging) {
      logger.debug('Creating new entity');
    }
    const newEntity = await createFn(entity, client);
    return {
      entity: newEntity,
      id: getIdFn(newEntity),
      created: true
    };
  } catch (error) {
    const dbError = error instanceof Error
      ? new AgentError(
          `Database operation failed: ${error.message}`,
          AgentErrorType.DATABASE,
          false,
          undefined,
          error
        )
      : new AgentError(
          'Database operation failed',
          AgentErrorType.DATABASE
        );
    
    logger.error('Database operation failed', dbError.originalError || dbError, {
      operation: 'findOrCreate'
    });
    
    throw dbError;
  }
}
