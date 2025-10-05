/**
 * @module server
 * @description Express server setup with Socket.IO
 */

import express, { Express } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import apiRoutes from './api';
import { handleConnection } from './sockets/connection';
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

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging (development only)
  if (process.env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
      console.log(`${req.method} ${req.path}`);
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

  return { app, httpServer, io };
}
