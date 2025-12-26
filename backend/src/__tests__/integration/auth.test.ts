/**
 * Integration Tests for Authentication API
 * 
 * Tests all authentication-related REST endpoints
 */

import request from 'supertest';
import express from 'express';
import authRouter from '../../api/auth.routes.js';

// Create a test app with just auth routes
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
};

describe('Authentication API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/join', () => {
    it('should create a new player with valid name', async () => {
      const response = await request(app)
        .post('/api/auth/join')
        .send({ playerName: 'TestPlayer' })
        .expect(201);

      expect(response.body).toHaveProperty('playerId');
      expect(response.body).toHaveProperty('playerName', 'TestPlayer');
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('should create unique player IDs for different players', async () => {
      const response1 = await request(app)
        .post('/api/auth/join')
        .send({ playerName: 'Player1' })
        .expect(201);

      const response2 = await request(app)
        .post('/api/auth/join')
        .send({ playerName: 'Player2' })
        .expect(201);

      expect(response1.body.playerId).not.toBe(response2.body.playerId);
      expect(response1.body.token).not.toBe(response2.body.token);
    });

    it('should create unique tokens for same player name', async () => {
      const response1 = await request(app)
        .post('/api/auth/join')
        .send({ playerName: 'SameName' })
        .expect(201);

      const response2 = await request(app)
        .post('/api/auth/join')
        .send({ playerName: 'SameName' })
        .expect(201);

      expect(response1.body.playerId).not.toBe(response2.body.playerId);
      expect(response1.body.token).not.toBe(response2.body.token);
    });

    it('should reject empty player name', async () => {
      const response = await request(app)
        .post('/api/auth/join')
        .send({ playerName: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing player name', async () => {
      await request(app)
        .post('/api/auth/join')
        .send({})
        .expect(400);
    });

    it('should reject player name that is too long (>50 chars)', async () => {
      const longName = 'A'.repeat(51);
      const response = await request(app)
        .post('/api/auth/join')
        .send({ playerName: longName })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should trim whitespace from player names', async () => {
      const response = await request(app)
        .post('/api/auth/join')
        .send({ playerName: '  TestPlayer  ' })
        .expect(201);

      expect(response.body.playerName).toBe('TestPlayer');
    });

    it('should reject player name with only whitespace', async () => {
      await request(app)
        .post('/api/auth/join')
        .send({ playerName: '   ' })
        .expect(400);
    });

    it('should handle special characters in player names', async () => {
      const response = await request(app)
        .post('/api/auth/join')
        .send({ playerName: 'Test-Player_123' })
        .expect(201);

      expect(response.body.playerName).toBe('Test-Player_123');
    });

    it('should reject invalid JSON', async () => {
      await request(app)
        .post('/api/auth/join')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('Token Validation', () => {
    it('should create valid JWT tokens', async () => {
      const response = await request(app)
        .post('/api/auth/join')
        .send({ playerName: 'TokenTest' })
        .expect(201);

      const token = response.body.token;
      
      // JWT should have 3 parts separated by dots
      const tokenParts = token.split('.');
      expect(tokenParts).toHaveLength(3);
    });

    it('should include player information in token', async () => {
      const response = await request(app)
        .post('/api/auth/join')
        .send({ playerName: 'TokenInfoTest' })
        .expect(201);

      const token = response.body.token;
      const playerId = response.body.playerId;

      // Decode the JWT payload (base64 decode the middle part)
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );

      expect(payload).toHaveProperty('playerId', playerId);
      expect(payload).toHaveProperty('playerName', 'TokenInfoTest');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent player creation requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/auth/join')
          .send({ playerName: `Player${i}` })
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('playerId');
        expect(response.body).toHaveProperty('token');
      });

      // All should have unique IDs
      const playerIds = responses.map(r => r.body.playerId);
      const uniqueIds = new Set(playerIds);
      expect(uniqueIds.size).toBe(10);

      // All should have unique tokens
      const tokens = responses.map(r => r.body.token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);
    });
  });
});
