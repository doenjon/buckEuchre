/**
 * @module api/bugs
 * @description Bug report API routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { submitBugReport } from '../services/bugs.service';
import { authenticateToken } from '../auth/middleware';
import { getUserById } from '../services/user.service';

const router = Router();

// Validation schema
const BugReportSchema = z.object({
  description: z.string().min(1, 'Description is required').max(5000, 'Description too long'),
  logs: z.string().max(50000, 'Logs too large'),
  userAgent: z.string(),
  url: z.string(),
  timestamp: z.string(),
});

/**
 * POST /api/bugs/report
 * Submit a bug report
 */
router.post('/report', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('[POST /api/bugs/report] Received bug report');

    // Validate request body
    const validation = BugReportSchema.safeParse(req.body);

    if (!validation.success) {
      console.error('[POST /api/bugs/report] Validation failed:', validation.error.errors);
      return res.status(400).json({
        error: 'Invalid request',
        message: validation.error.errors[0].message,
        details: validation.error.errors,
      });
    }

    const { description, logs, userAgent, url, timestamp } = validation.data;

    // Get user info if authenticated
    let userId: string | undefined;
    let username: string | undefined;
    let email: string | undefined;

    if (req.user && req.user.id) {
      userId = req.user.id;
      try {
        const user = await getUserById(userId);
        username = user?.username;
        email = user?.email || undefined;
      } catch (error) {
        console.error('[POST /api/bugs/report] Error fetching user info:', error);
        // Continue without user info
      }
    }

    // Submit the bug report
    await submitBugReport({
      description,
      logs,
      userAgent,
      url,
      timestamp,
      userId,
      username,
      email,
    });

    console.log('[POST /api/bugs/report] Bug report submitted successfully');

    res.status(200).json({
      success: true,
      message: 'Bug report submitted successfully',
    });
  } catch (error) {
    console.error('[POST /api/bugs/report] Error submitting bug report:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to submit bug report',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
