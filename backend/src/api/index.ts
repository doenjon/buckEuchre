import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import gameRoutes from './game.routes.js';
import friendsRoutes from './friends.routes.js';
import invitationsRoutes from './invitations.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import testRoutes from './test.routes.js';
import arenaRoutes from './arena.routes.js';
import settingsRoutes from './settings.routes.js';
import bugsRoutes from './bugs.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

// Health check (no /api prefix)
router.use(healthRoutes);

// API routes
router.use('/api/auth', authRoutes);
router.use('/api/games', gameRoutes);
router.use('/api/friends', friendsRoutes);
router.use('/api', invitationsRoutes); // Handles /api/invitations and /api/games/:gameId/invite
router.use('/api/leaderboard', leaderboardRoutes);
router.use('/api/arena', arenaRoutes);
router.use('/api/settings', settingsRoutes);
router.use('/api/bugs', bugsRoutes);
router.use('/api/admin', adminRoutes);

const enableTestRoutes = process.env.ENABLE_TEST_CONTROLS !== 'false';

if (enableTestRoutes) {
  router.use('/api/test', testRoutes);
}

export default router;
