import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import gameRoutes from './game.routes';
import friendsRoutes from './friends.routes';
import invitationsRoutes from './invitations.routes';
import leaderboardRoutes from './leaderboard.routes';
import testRoutes from './test.routes';

const router = Router();

// Health check (no /api prefix)
router.use(healthRoutes);

// API routes
router.use('/api/auth', authRoutes);
router.use('/api/games', gameRoutes);
router.use('/api/friends', friendsRoutes);
router.use('/api', invitationsRoutes); // Handles /api/invitations and /api/games/:gameId/invite
router.use('/api/leaderboard', leaderboardRoutes);

const enableTestRoutes = process.env.ENABLE_TEST_CONTROLS !== 'false';

if (enableTestRoutes) {
  router.use('/api/test', testRoutes);
}

export default router;
