/**
 * @module backend/middleware/errorHandler
 * @description Express error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError } from '../utils/errors.js';
import { ErrorCode, ErrorResponse } from '@buck-euchre/shared';

/**
 * Express error handling middleware
 * Converts all errors to standardized ErrorResponse format
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // Handle AppError instances
  if (isAppError(err)) {
    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: process.env.NODE_ENV === 'development' ? err.details : undefined,
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    },
  };

  res.status(500).json(response);
}

/**
 * Async route handler wrapper
 * Catches promise rejections and passes to error handler
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    error: {
      code: ErrorCode.GAME_NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
    },
  };

  res.status(404).json(response);
}
