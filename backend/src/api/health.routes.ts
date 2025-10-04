import { Router, Request, Response } from 'express';
import { isDatabaseHealthy } from '../db/client';

const router = Router();

/**
 * Health check endpoint
 * Returns server status and database connectivity
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbHealthy = await isDatabaseHealthy();
    
    res.status(200).json({
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: Date.now(),
      database: dbHealthy ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: Date.now(),
      database: 'error'
    });
  }
});

export default router;
