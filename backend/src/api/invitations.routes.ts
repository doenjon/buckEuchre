import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  sendInvitation,
  acceptInvitation,
  declineInvitation,
  getInvitations,
  getGameInvitations,
  cancelInvitation,
} from '../services/invitations.service';
import { authenticateToken } from '../auth/middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const SendInvitationSchema = z.object({
  inviteeId: z.string().uuid('Invalid user ID'),
});

/**
 * POST /api/games/:gameId/invite
 * Send a game invitation to a friend
 */
router.post('/games/:gameId/invite', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const validation = SendInvitationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        message: validation.error.errors[0].message,
      });
    }

    const { inviteeId } = validation.data;
    const inviterId = req.user!.id;

    const invitation = await sendInvitation(gameId, inviterId, inviteeId);

    res.status(201).json({
      invitation,
      message: 'Invitation sent',
    });
  } catch (error) {
    console.error('Error sending invitation:', error);

    if (error instanceof Error) {
      if (
        error.message === 'Game not found' ||
        error.message === 'User not found'
      ) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (
        error.message === 'Cannot invite yourself' ||
        error.message === 'Game is not accepting players' ||
        error.message === 'Game is full' ||
        error.message === 'Can only invite friends' ||
        error.message === 'Invitation already sent'
      ) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to send invitation',
    });
  }
});

/**
 * GET /api/invitations
 * Get my pending game invitations
 */
router.get('/invitations', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const invitations = await getInvitations(userId);

    res.status(200).json({
      invitations,
    });
  } catch (error) {
    console.error('Error getting invitations:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get invitations',
    });
  }
});

/**
 * GET /api/games/:gameId/invitations
 * Get invitations sent for a specific game
 */
router.get('/games/:gameId/invitations', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const inviterId = req.user!.id;

    const invitations = await getGameInvitations(gameId, inviterId);

    res.status(200).json({
      invitations,
    });
  } catch (error) {
    console.error('Error getting game invitations:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get game invitations',
    });
  }
});

/**
 * POST /api/invitations/:invitationId/accept
 * Accept a game invitation
 */
router.post('/invitations/:invitationId/accept', async (req: Request, res: Response) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user!.id;

    const invitation = await acceptInvitation(invitationId, userId);

    res.status(200).json({
      invitation,
      message: 'Invitation accepted',
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);

    if (error instanceof Error) {
      if (error.message === 'Invitation not found') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (
        error.message === 'Unauthorized' ||
        error.message === 'Invitation is not pending' ||
        error.message === 'Invitation has expired' ||
        error.message === 'Game is no longer accepting players' ||
        error.message === 'Game is full'
      ) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to accept invitation',
    });
  }
});

/**
 * POST /api/invitations/:invitationId/decline
 * Decline a game invitation
 */
router.post('/invitations/:invitationId/decline', async (req: Request, res: Response) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user!.id;

    await declineInvitation(invitationId, userId);

    res.status(200).json({
      message: 'Invitation declined',
    });
  } catch (error) {
    console.error('Error declining invitation:', error);

    if (error instanceof Error) {
      if (error.message === 'Invitation not found') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (
        error.message === 'Unauthorized' ||
        error.message === 'Invitation is not pending'
      ) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to decline invitation',
    });
  }
});

/**
 * DELETE /api/invitations/:invitationId
 * Cancel a game invitation (by inviter)
 */
router.delete('/invitations/:invitationId', async (req: Request, res: Response) => {
  try {
    const { invitationId } = req.params;
    const inviterId = req.user!.id;

    await cancelInvitation(invitationId, inviterId);

    res.status(200).json({
      message: 'Invitation cancelled',
    });
  } catch (error) {
    console.error('Error cancelling invitation:', error);

    if (error instanceof Error) {
      if (error.message === 'Invitation not found') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (
        error.message === 'Unauthorized' ||
        error.message === 'Invitation is not pending'
      ) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to cancel invitation',
    });
  }
});

export default router;

