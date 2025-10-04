import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import gameRoutes from './game.routes';

const router = Router();

// Health check (no /api prefix)
router.use(healthRoutes);

// API routes
router.use('/api', authRoutes);
router.use('/api', gameRoutes);

export default router;
