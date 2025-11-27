import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingRequests,
  getSentRequests,
  removeFriend,
  blockUser,
} from '../services/friends.service';
import { searchUsers } from '../services/user.service';
import { authenticateToken } from '../auth/middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const SendRequestSchema = z.object({
  receiverId: z.string().uuid('Invalid user ID'),
});

const SearchSchema = z.object({
  query: z.string().trim().min(1, 'Search query required'),
});

/**
 * POST /api/friends/request
 * Send a friend request
 */
router.post('/request', async (req: Request, res: Response) => {
  try {
    const validation = SendRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        message: validation.error.errors[0].message,
      });
    }

    const { receiverId } = validation.data;
    const requesterId = req.user!.id;

    const friendship = await sendFriendRequest(requesterId, receiverId);

    res.status(201).json({
      friendship,
      message: 'Friend request sent',
    });
  } catch (error) {
    console.error('Error sending friend request:', error);

    if (error instanceof Error) {
      if (
        error.message === 'User not found' ||
        error.message === 'Cannot send friend request to guest users' ||
        error.message === 'Cannot send friend request to yourself' ||
        error.message === 'Friend request already sent' ||
        error.message === 'Already friends'
      ) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }

      if (error.message === 'Cannot send friend request') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot send friend request to this user',
        });
      }
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to send friend request',
    });
  }
});

/**
 * POST /api/friends/:friendshipId/accept
 * Accept a friend request
 */
router.post('/:friendshipId/accept', async (req: Request, res: Response) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user!.id;

    const friendship = await acceptFriendRequest(friendshipId, userId);

    res.status(200).json({
      friendship,
      message: 'Friend request accepted',
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);

    if (error instanceof Error) {
      if (error.message === 'Friend request not found') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (error.message === 'Unauthorized' || error.message === 'Friend request is not pending') {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to accept friend request',
    });
  }
});

/**
 * POST /api/friends/:friendshipId/decline
 * Decline a friend request
 */
router.post('/:friendshipId/decline', async (req: Request, res: Response) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user!.id;

    await declineFriendRequest(friendshipId, userId);

    res.status(200).json({
      message: 'Friend request declined',
    });
  } catch (error) {
    console.error('Error declining friend request:', error);

    if (error instanceof Error) {
      if (error.message === 'Friend request not found') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (error.message === 'Unauthorized' || error.message === 'Friend request is not pending') {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to decline friend request',
    });
  }
});

/**
 * GET /api/friends
 * Get all friends
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const friends = await getFriends(userId);

    res.status(200).json({
      friends,
    });
  } catch (error) {
    console.error('Error getting friends:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get friends',
    });
  }
});

/**
 * GET /api/friends/pending
 * Get pending friend requests (received)
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const requests = await getPendingRequests(userId);

    res.status(200).json({
      requests,
    });
  } catch (error) {
    console.error('Error getting pending requests:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get pending requests',
    });
  }
});

/**
 * GET /api/friends/sent
 * Get sent friend requests (pending)
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const requests = await getSentRequests(userId);

    res.status(200).json({
      requests,
    });
  } catch (error) {
    console.error('Error getting sent requests:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get sent requests',
    });
  }
});

/**
 * DELETE /api/friends/:friendId
 * Remove a friend
 */
router.delete('/:friendId', async (req: Request, res: Response) => {
  try {
    const { friendId } = req.params;
    const userId = req.user!.id;

    await removeFriend(userId, friendId);

    res.status(200).json({
      message: 'Friend removed',
    });
  } catch (error) {
    console.error('Error removing friend:', error);

    if (error instanceof Error && error.message === 'Friendship not found') {
      return res.status(404).json({
        error: 'Not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to remove friend',
    });
  }
});

/**
 * POST /api/friends/:userId/block
 * Block a user
 */
router.post('/:userId/block', async (req: Request, res: Response) => {
  try {
    const { userId: blockedUserId } = req.params;
    const userId = req.user!.id;

    await blockUser(userId, blockedUserId);

    res.status(200).json({
      message: 'User blocked',
    });
  } catch (error) {
    console.error('Error blocking user:', error);

    if (error instanceof Error && error.message === 'Cannot block yourself') {
      return res.status(400).json({
        error: 'Bad request',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to block user',
    });
  }
});

/**
 * GET /api/friends/search
 * Search users by username
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Search query required',
      });
    }

    const users = await searchUsers(query, 20);

    res.status(200).json({
      users,
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to search users',
    });
  }
});

export default router;



