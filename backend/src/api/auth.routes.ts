import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createPlayer } from '../services/player.service';

const router = Router();

// Validation schema for join request
const JoinRequestSchema = z.object({
  playerName: z.string().min(2, 'Name must be at least 2 characters').max(20, 'Name must be at most 20 characters')
});

/**
 * POST /api/auth/join
 * Create a new player session with just a name
 */
router.post('/join', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = JoinRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        message: validation.error.errors[0].message
      });
    }

    const { playerName } = validation.data;

    // Create player and generate token
    const { player, token } = await createPlayer(playerName);

    // Calculate expiration timestamp (24 hours from now)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);

    res.status(201).json({
      playerId: player.id,
      playerName: player.name,
      token,
      expiresAt
    });
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to create player session'
    });
  }
});

export default router;
