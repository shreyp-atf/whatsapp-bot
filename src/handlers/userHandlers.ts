/**
 * User API Handlers
 * Handlers for user-related endpoints
 */

import { Request, Response } from 'express';
import { getUserById, createUser, getUserPersona } from '../db/user';

/**
 * Create a new user
 * POST /api/users
 * Body: { mobileNumber: number, persona: object }
 */
export async function handleCreateUser(req: Request, res: Response): Promise<void> {
  try {
    const { mobileNumber, persona } = req.body;

    if (typeof mobileNumber !== 'number' || isNaN(mobileNumber)) {
      res.status(400).json({
        success: false,
        error: 'mobileNumber must be a valid number'
      });
      return;
    }

    if (persona === undefined || persona === null) {
      res.status(400).json({
        success: false,
        error: 'persona is required and must be a valid JSON object'
      });
      return;
    }

    if (typeof persona !== 'object' || Array.isArray(persona)) {
      res.status(400).json({
        success: false,
        error: 'persona must be a valid JSON object'
      });
      return;
    }

    console.log(`[API] Creating user`, {
      mobileNumber,
      hasPersona: !!persona
    });

    // Check if user already exists
    const existingUser = await getUserById(mobileNumber);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: `User with mobile number ${mobileNumber} already exists`,
        userId: mobileNumber
      });
      return;
    }

    // Create the user
    const newUser = await createUser({
      user_id: mobileNumber,
      persona_json: persona
    });

    console.log(`[API] User created successfully`, {
      userId: newUser.user_id
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        user_id: newUser.user_id,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at,
        name: newUser.name,
        bio: newUser.bio,
        persona_json: newUser.persona_json,
        locality_id: newUser.locality_id,
        conversation_id: newUser.conversation_id
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get user by mobile number
 * POST /api/users/get
 * Body: { mobile_number: string }
 */
export async function handleGetUser(req: Request, res: Response): Promise<void> {
  try {
    const { mobile_number } = req.body;
    
    if (mobile_number === undefined || mobile_number === null) {
      res.status(400).json({
        success: false,
        error: 'mobile_number is required'
      });
      return;
    }

    if (typeof mobile_number !== 'string') {
      res.status(400).json({
        success: false,
        error: 'mobile_number must be a string'
      });
      return;
    }

    const userId = parseInt(mobile_number, 10);
    
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: 'mobile_number must be a valid numeric string'
      });
      return;
    }

    console.log(`[API] Fetching user`, {
      mobile_number: userId
    });

    const user = await getUserById(userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: `User with mobile number ${userId} not found`,
        mobile_number: userId
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        user_id: user.user_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        name: user.name,
        bio: user.bio,
        persona_json: user.persona_json,
        locality_id: user.locality_id,
        conversation_id: user.conversation_id
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get user persona by user ID
 * GET /api/users/:userId/persona
 */
export async function handleGetUserPersona(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.params.userId, 10);
    
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: 'userId must be a valid number'
      });
      return;
    }

    const persona = await getUserPersona(userId);
    
    if (persona === null) {
      res.status(404).json({
        success: false,
        message: `No persona found for user ID: ${userId}`,
        userId
      });
      return;
    }

    res.status(200).json({
      success: true,
      userId,
      persona
    });
  } catch (error) {
    console.error('Error fetching user persona:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
