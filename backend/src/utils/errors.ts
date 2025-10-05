/**
 * @module backend/utils/errors
 * @description Custom error classes for Buck Euchre backend
 */

import { ErrorCode, ErrorCodeToStatusMap, ErrorMessages } from '@buck-euchre/shared';

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message || ErrorMessages[code]);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = ErrorCodeToStatusMap[code];
    this.details = details;
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error (4xx)
 */
export class ValidationError extends AppError {
  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(code, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Game error (4xx)
 */
export class GameError extends AppError {
  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(code, message, details);
    this.name = 'GameError';
  }
}

/**
 * Authentication error (401)
 */
export class AuthError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.UNAUTHORIZED, message, details);
    this.name = 'AuthError';
  }
}

/**
 * Database error (5xx)
 */
export class DatabaseError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.DATABASE_ERROR, message, details);
    this.name = 'DatabaseError';
  }
}

/**
 * Internal server error (5xx)
 */
export class InternalError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.INTERNAL_ERROR, message, details);
    this.name = 'InternalError';
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper to create validation errors
 */
export function createValidationError(message: string, details?: unknown): ValidationError {
  return new ValidationError(ErrorCode.INVALID_INPUT, message, details);
}

/**
 * Helper to create game errors
 */
export function createGameError(code: ErrorCode, message?: string, details?: unknown): GameError {
  return new GameError(code, message, details);
}
