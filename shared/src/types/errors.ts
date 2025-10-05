/**
 * @module shared/types/errors
 * @description Standardized error codes for Buck Euchre
 */

/**
 * Error codes for Buck Euchre application
 * 4xx codes = Client/validation errors
 * 5xx codes = Server errors
 */
export enum ErrorCode {
  // Validation Errors (4xx)
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_MOVE = 'INVALID_MOVE',
  OUT_OF_TURN = 'OUT_OF_TURN',
  GAME_FULL = 'GAME_FULL',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Game State Errors (4xx)
  WRONG_PHASE = 'WRONG_PHASE',
  ALREADY_FOLDED = 'ALREADY_FOLDED',
  CANNOT_FOLD = 'CANNOT_FOLD',
  INVALID_BID = 'INVALID_BID',
  MUST_FOLLOW_SUIT = 'MUST_FOLLOW_SUIT',
  ALREADY_IN_GAME = 'ALREADY_IN_GAME',
  NOT_IN_GAME = 'NOT_IN_GAME',
  GAME_ALREADY_STARTED = 'GAME_ALREADY_STARTED',
  GAME_NOT_STARTED = 'GAME_NOT_STARTED',
  
  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Maps error codes to HTTP status codes
 */
export const ErrorCodeToStatusMap: Record<ErrorCode, number> = {
  // 400 - Bad Request
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.INVALID_MOVE]: 400,
  [ErrorCode.INVALID_BID]: 400,
  [ErrorCode.WRONG_PHASE]: 400,
  [ErrorCode.MUST_FOLLOW_SUIT]: 400,
  [ErrorCode.ALREADY_FOLDED]: 400,
  [ErrorCode.CANNOT_FOLD]: 400,
  [ErrorCode.ALREADY_IN_GAME]: 400,
  [ErrorCode.GAME_ALREADY_STARTED]: 400,
  [ErrorCode.GAME_NOT_STARTED]: 400,
  
  // 401 - Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  
  // 403 - Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.OUT_OF_TURN]: 403,
  [ErrorCode.NOT_IN_GAME]: 403,
  
  // 404 - Not Found
  [ErrorCode.GAME_NOT_FOUND]: 404,
  
  // 409 - Conflict
  [ErrorCode.GAME_FULL]: 409,
  
  // 500 - Internal Server Error
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * Standardized error response format
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * User-friendly error messages
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // Validation Errors
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.INVALID_MOVE]: 'Invalid move',
  [ErrorCode.OUT_OF_TURN]: 'Not your turn',
  [ErrorCode.GAME_FULL]: 'Game is full',
  [ErrorCode.GAME_NOT_FOUND]: 'Game not found',
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized',
  [ErrorCode.FORBIDDEN]: 'Forbidden',
  
  // Game State Errors
  [ErrorCode.WRONG_PHASE]: 'Wrong game phase for this action',
  [ErrorCode.ALREADY_FOLDED]: 'Player has already folded',
  [ErrorCode.CANNOT_FOLD]: 'Cannot fold at this time',
  [ErrorCode.INVALID_BID]: 'Invalid bid amount',
  [ErrorCode.MUST_FOLLOW_SUIT]: 'Must follow suit',
  [ErrorCode.ALREADY_IN_GAME]: 'Already in a game',
  [ErrorCode.NOT_IN_GAME]: 'Not in this game',
  [ErrorCode.GAME_ALREADY_STARTED]: 'Game has already started',
  [ErrorCode.GAME_NOT_STARTED]: 'Game has not started',
  
  // Server Errors
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.DATABASE_ERROR]: 'Database error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
};
