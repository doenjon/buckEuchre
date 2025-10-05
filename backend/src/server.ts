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
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:5173'];
  app.use(cors({
    origin: corsOrigins,
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
