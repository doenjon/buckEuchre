import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import gameRoutes from './game.routes';
import testRoutes from './test.routes';

const router = Router();

// Health check (no /api prefix)
router.use(healthRoutes);

// API routes
router.use('/api/auth', authRoutes);
router.use('/api/games', gameRoutes);

const enableTestRoutes = process.env.ENABLE_TEST_CONTROLS !== 'false';

if (enableTestRoutes) {
  router.use('/api/test', testRoutes);
}

export default router;
