/**
 * @module server
 * @description Express server setup with Socket.IO
 */

import express, { Express } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './api';
import { handleConnection } from './sockets/connection';
import { setSocketServer } from './utils/socketManager';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Create and configure Express + Socket.IO server
 */
export function createAppServer(): {
  app: Express;
  httpServer: HTTPServer;
  io: SocketIOServer;
} {
  // Create Express app
  const app = express();

  // Create HTTP server
  const httpServer = createServer(app);

  // Create Socket.IO server
  let socketCorsOrigin: string | RegExp;
  if (process.env.CORS_ORIGIN) {
    socketCorsOrigin = process.env.CORS_ORIGIN.split(',')[0].trim();
  } else if (process.env.NODE_ENV === 'development') {
    socketCorsOrigin = /^http:\/\/localhost:\d+$/;
  } else {
    // Production: allow all origins when CORS_ORIGIN not set (nginx proxies both)
    socketCorsOrigin = /.*/;
  }
  
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: socketCorsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Allow WebSocket connections
    crossOriginEmbedderPolicy: false
  }));

  // CORS configuration
  // In development, allow any localhost port for easier local testing
  const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (e.g., mobile apps, Postman, same-origin requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // If CORS_ORIGIN is explicitly set, use it
    if (process.env.CORS_ORIGIN) {
      const allowedOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
    }
    
    // In development, allow any localhost port
    if (process.env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
      return;
    }
    
    // In production, if CORS_ORIGIN is not set, allow requests from same origin
    // (since nginx proxies both frontend and backend, they appear same-origin)
    // This handles cases where frontend is accessed via IP or domain
    if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
      // Allow any origin in production if CORS_ORIGIN not explicitly set
      // This is less secure but works when frontend/backend are proxied together
      callback(null, true);
      return;
    }
    
    // Default: only allow localhost:5173
    if (origin === 'http://localhost:5173') {
      callback(null, true);
      return;
    }
    
    // Reject all other origins
    callback(new Error('Not allowed by CORS'));
  };
  
  app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  if (process.env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  } else if (process.env.NODE_ENV === 'production') {
    // Production logging (could integrate with external logging service)
    app.use((req, _res, next) => {
      const timestamp = new Date().toISOString();
      console.log(JSON.stringify({
        timestamp,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }));
      next();
    });
  }

  // API routes
  app.use('/', apiRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  // Initialize WebSocket handlers
  handleConnection(io);
  setSocketServer(io);

  return { app, httpServer, io };
}
